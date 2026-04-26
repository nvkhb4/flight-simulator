# Flight Simulator - Implementation Overview

## Rendering Pipeline
1. **Load Shaders** (async)
   - vertex.glsl (WebGL 2.0 with layout locations)
   - fragment_flat.glsl, fragment_smooth.glsl, fragment_phong.glsl
   - fragment_water.glsl

2. **Initialize Mesh**
   - Generate terrain patch: get_patch(-20, 20, -60, 0)
   - Create water plane with matching bounds: createWaterPlane(-20, 20, -60, 0)
   - Create VAOs: terrainVAO, terrainLineVAO, waterVAO
   - Cache uniform locations for all programs

3. **Main Render Loop** (deltaTime = time since last frame)
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
     - Bind appropriate VAO (terrainVAO or terrainLineVAO)
     - Bind uniform matrices and light position
     - Draw terrain based on viewMode
     - Draw water plane (faces only) if viewMode == 2

4. **Terrain Features**
   - Height field: Perlin noise-based heightmap with grid triangulation
   - Colors: Height-mapped (blue water < green ground < brown < white peaks)
   - Normals: Per-vertex computed via face normal accumulation

5. **Frustum Constraints**
   - left/right: [-50, 50], left < right
   - top/bottom: [-50, 50], bottom < top
   - near: (0.01, far - 0.1]
   - far: [near + 0.1, ∞)