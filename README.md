# Flight Simulator

A WebGL 2.0 flight simulator with **infinite procedural terrain**, dynamic patch streaming, multiple shading modes, and real-time camera controls.

## Features

- **Infinite Terrain**: Dynamic streaming system generates terrain on-demand as the camera moves
- **Procedural Generation**: Perlin-noise-based heightmaps with smooth interpolation
- **Multiple Shading Modes**: Flat, Smooth (Gouraud), and Phong shading
- **Flexible View Modes**: Points cloud, wireframe, and solid mesh rendering
- **Real-time Camera Control**: Full 6-DOF flight dynamics with rotation constraints
- **Water Rendering**: Separate shader for water surfaces below ground level
- **Frustum Control**: Real-time adjustment of viewing volume parameters

## Running the Program

1. Open `simulator.html` in a web server (recommended: VS Code Live Server extension)

## How Infinite Terrain Works

The terrain is organized as a grid of 40×40-unit patches. The simulator maintains a sliding window of **9 patches (3×3 grid)** around the camera's current position:

- Patches are **pre-allocated once** at startup with GPU buffers
- As the camera moves, `updateTerrain()` detects which patches are needed
- New terrain data is generated and **uploaded into recycled buffers** (instead of creating/destroying GPU memory)
- Old patches behind the camera are marked inactive and available for reuse
- This approach keeps GPU memory usage constant while supporting infinite terrain

## Controls

### Camera Movement & Rotation

| Key | Action |
|-----|--------|
| **W** | Pitch up (nose down) |
| **S** | Pitch down (nose up) |
| **A** | Yaw left (turn left) |
| **D** | Yaw right (turn right) |
| **Q** | Roll left |
| **E** | Roll right |
| **↑** | Increase speed |
| **↓** | Decrease speed |

**Constraints:**
- Pitch, Yaw, Roll: all constrained to (-90°, 90°)
- Speed: [0, max speed]
- Altitude (Y): [2.5, 3.5]

### Frustum Controls (Viewing Volume)

| Key | Action |
|-----|--------|
| **1** | Decrease left plane |
| **!** (Shift+1) | Increase left plane |
| **2** | Decrease right plane |
| **@** (Shift+2) | Increase right plane |
| **3** | Decrease top plane |
| **#** (Shift+3) | Increase top plane |
| **4** | Decrease bottom plane |
| **$** (Shift+4) | Increase bottom plane |
| **5** | Decrease near plane |
| **%** (Shift+5) | Increase near plane |
| **6** | Decrease far plane |
| **^** (Shift+6) | Increase far plane |

**Constraints:**
- Left/Right: [-50, 50], left < right
- Top/Bottom: [-50, 50], bottom < top  
- Near: (0.01, far - 0.1]
- Far: [near + 0.1, ∞)

### View & Shading Modes

| Key | Action |
|-----|--------|
| **V** | Toggle view mode: Points → Wireframe → Faces → (repeat) |
| **C** | Toggle shading mode: Flat → Smooth (Gouraud) → Phong → (repeat) |

**View Modes:**
- **Points**: Display terrain as point cloud
- **Wireframe**: Display terrain edges only
- **Faces**: Display filled triangles (includes water plane)

**Shading Modes:**
- **Flat**: Per-face color (height-mapped)
- **Smooth (Gouraud)**: Per-vertex lighting interpolated across triangles
- **Phong**: Per-fragment lighting (most realistic)

### Other

| Key | Action |
|-----|--------|
| **Escape** | Quit simulator |

## Terrain Features

- **Height Field**: Procedurally generated using Perlin noise with multi-octave interpolation
- **Infinite Canvas**: Terrain extends indefinitely; new terrain patches stream in as you fly
- **Height-mapped Coloring**: 
  - Blue: Below ground level (water covered)
  - Green: Ground level (y = 0)
  - Brown: Mid altitude (mountains)
  - White: Peaks (high altitude)
- **Normals**: Per-vertex normals computed from face geometry for smooth shading
- **Water**: Flat water surface at y = 0 with separate shader rendering

## Performance Notes

- Terrain patches are generated on CPU as needed and uploaded to GPU
- Uses DYNAMIC_DRAW buffers that are recycled rather than recreated
- Patch generation occurs every frame by default; can be throttled to every N frames if hitching occurs
- GPU memory usage is constant (9 patches × 2 VAOs per patch + water)

## Browser Requirements

- WebGL 2.0 support (Chrome, Firefox, Safari, Edge)
- Tested on Windows 11
