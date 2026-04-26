# Flight Simulator

A WebGL 2.0 flight simulator with dynamic terrain generation, multiple shading modes, and real-time camera controls.

## Running the Program

1. Open `simulator.html` in a web server (recommended: VS Code Live Server extension)
2. The simulator will load shaders and initialize terrain automatically
3. You should see a wireframe terrain with a flight camera positioned above it

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

- **Height Field**: Procedurally generated using Perlin noise
- **Coloring**: Height-mapped colors
  - Blue: Below ground level (water)
  - Green: Ground level (y = 0)
  - Brown: Mid altitude
  - White: Peaks (high altitude)
- **Normals**: Per-vertex normals computed from face normals for smooth shading

## Browser Requirements

- WebGL 2.0 support (Chrome, Firefox, Safari, Edge)
- Tested on Windows 11
