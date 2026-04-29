# Flight Simulator - Implementation Overview

## Infinite Terrain System
The simulator uses a **dynamic patch-based streaming system** that generates terrain on-demand as the camera moves:

1. **Patch Grid**: Terrain is divided into a grid of 40×40 world-unit patches, each at integer coordinates (patchX, patchZ)
2. **Streaming Window**: Maintains 9 active patches in a 3×3 grid around the camera's current position
3. **Buffer Recycling**: Uses pre-allocated DYNAMIC_DRAW GPU buffers that are reused rather than destroyed, improving performance
4. **Seamless Generation**: New patches are automatically generated when the camera approaches boundaries; old patches are recycled

## Rendering Pipeline
1. **Load Shaders** (async)
   - vertex.glsl (WebGL 2.0 with layout locations)
   - fragment_flat.glsl, fragment_smooth.glsl, fragment_phong.glsl
   - fragment_water.glsl

2. **Initialize Mesh**
   - Pre-allocate 9 patch slot objects with DYNAMIC_DRAW buffers
   - Create VAOs for each slot: vao (faces), lineVao (wireframe), waterVao (water)
   - Load initial 3×3 patch grid around starting camera position
   - Cache uniform locations for all programs

3. **Main Render Loop** (deltaTime = time since last frame)
   - **Terrain Streaming:**
     - Call updateTerrain() to check camera position
     - Calculate current patch grid coordinates via getCurrentPatchCoords()
     - Load/recycle patches based on 3×3 grid around camera
     - Upload new terrain data into recycled buffer slots

   - **Input Handling:**
     - Rotation: W/S (pitch), A/D (yaw), Q/E (roll) - constrained to (-90°, 90°)
     - Speed: ↑/↓ - constrained to [0, maxSpeed]
     - Frustum: 1-6 keys with Shift variants - clamped to valid ranges
     - View mode: V key - toggles points → wireframe → faces
     - Shading mode: C key - toggles flat → smooth → Phong
     - Quit: Escape key

   - **Camera Update:**
     - Calculate rotation deltas: ROTATION_SPEED * deltaTime
     - Rotate vectors using Rodrigues formula
     - Apply altitude constraints: Y ∈ [2.5, 3.5]
     - Move: position += forward * speed * deltaTime
     - Gram-Schmidt orthonormalization to fix floating-point drift

   - **Matrix Construction:**
     - Projection: frustumMatrix(left, right, top, bottom, near, far)
     - View: lookAt(position, position + forward, up)

   - **Rendering:**
     - Select program based on shadingMode (flat/smooth/Phong)
     - Loop over all active patches and draw each one
     - Bind appropriate VAO for each patch (patch.vao, patch.lineVao, or patch.waterVao)
     - Bind uniform matrices and light position
     - Draw terrain based on viewMode (points, lines, or faces)
     - Draw all active water patches if viewMode == 2

4. **Terrain Features**
   - Height field: Perlin noise-based heightmap with grid triangulation
   - Colors: Height-mapped (blue water < green ground < brown < white peaks)
   - Normals: Per-vertex computed via face normal accumulation
   - Infinite canvas: Terrain extends infinitely as camera moves

5. **Frustum Constraints**
   - left/right: [-50, 50], left < right
   - top/bottom: [-50, 50], bottom < top
   - near: (0.01, far - 0.1]
   - far: [near + 0.1, ∞)