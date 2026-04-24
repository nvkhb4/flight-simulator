1. deltaTime = time since last frame
2. handleInput(deltaTime)
   - Read keys
   - Calculate rotation deltas: ROTATION_SPEED * deltaTime
   - Rotate vectors using Rodrigues formula
   - Clamp pitch/yaw/roll
3. updateCameraVectors()
   - Gram-Schmidt orthonormalization (fix floating-point drift)
4. updateCamera(deltaTime)
   - Move: position += forward * speed * deltaTime
   - Clamp: Y ∈ [2.5, 3.5]
5. Build matrices
   - proj = frustumMatrix(left, right, top, bottom, near, far)
   - view = lookAt(position, position + forward, up)
6. Render
   - Send matrices to GPU
   - Draw terrain
7. requestAnimationFrame(render)
   - Loop