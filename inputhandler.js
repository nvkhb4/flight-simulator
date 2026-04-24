const keys = {};

window.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;
    
    //frustum controls
    if (e.key === '1') frustum.left -= 1;
    if (e.key === '!' || (e.shiftKey && e.key === '1')) frustum.left += 1;
    if (e.key === '2') frustum.right -= 1;
    if (e.key === '@' || (e.shiftKey && e.key === '2')) frustum.right += 1;
    if (e.key === '3') frustum.top -= 1;
    if (e.key === '#' || (e.shiftKey && e.key === '3')) frustum.top += 1;
    if (e.key === '4') frustum.bottom -= 1;
    if (e.key === '$' || (e.shiftKey && e.key === '4')) frustum.bottom += 1;
    if (e.key === '5') frustum.near = Math.max(0.01, frustum.near - 0.5);
    if (e.key === '%' || (e.shiftKey && e.key === '5')) frustum.near += 0.5;
    if (e.key === '6') frustum.far -= 10;
    if (e.key === '^' || (e.shiftKey && e.key === '6')) frustum.far += 10;
    
    //quit
    if (e.key === 'Escape') window.close();
    
    //view mode toggle (V)
    if (e.key === 'v' || e.key === 'V') viewMode = (viewMode + 1) % 3;    
    // Shading mode toggle (C)
    if (e.key === 'c' || e.key === 'C') shadingMode = (shadingMode + 1) % 3;});

window.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
});

const ROTATION_SPEED = 30; //degrees per second

function handleInput(deltaTime) {
    
    //pitch (W/S) 
    if (keys['w']) {
        const delta = -ROTATION_SPEED * deltaTime;
        const newPitch = camera.pitch + delta;
        if (newPitch > -MAX_PITCH && newPitch < MAX_PITCH) {
            camera.pitch = newPitch;
            camera.forward = rotateByAxis(camera.forward, camera.right, delta);
        }
    }
    if (keys['s']) {
        const delta = ROTATION_SPEED * deltaTime;
        const newPitch = camera.pitch + delta;
        if (newPitch > -MAX_PITCH && newPitch < MAX_PITCH) {
            camera.pitch = newPitch;
            camera.forward = rotateByAxis(camera.forward, camera.right, delta);
        }
    }

    //yaw (A/D) 
    if (keys['a']) {
        const delta = -ROTATION_SPEED * deltaTime;
        const newYaw = camera.yaw + delta;
        if (newYaw > -90 && newYaw < 90) {
            camera.yaw = newYaw;
            camera.forward = rotateByAxis(camera.forward, camera.up, delta);
        }
    }
    if (keys['d']) {
        const delta = ROTATION_SPEED * deltaTime;
        const newYaw = camera.yaw + delta;
        if (newYaw > -90 && newYaw < 90) {
            camera.yaw = newYaw;
            camera.forward = rotateByAxis(camera.forward, camera.up, delta);
        }
    }

    //roll (Q/E) 
    if (keys['q']) {
        const delta = -ROTATION_SPEED * deltaTime;
        const newRoll = camera.roll + delta;
        if (newRoll > -90 && newRoll < 90) {
            camera.roll = newRoll;
            camera.up = rotateByAxis(camera.up, camera.forward, delta);
        }
    }
    if (keys['e']) {
        const delta = ROTATION_SPEED * deltaTime;
        const newRoll = camera.roll + delta;
        if (newRoll > -90 && newRoll < 90) {
            camera.roll = newRoll;
            camera.up = rotateByAxis(camera.up, camera.forward, delta);
        }
    }

    //speed (Arrow keys) 
    if (keys['arrowup'])   camera.speed = Math.min(camera.maxSpeed, camera.speed + 5 * deltaTime);
    if (keys['arrowdown']) camera.speed = Math.max(0, camera.speed - 5 * deltaTime);

    //apply movement
    updateCameraVectors();
    updateCamera(deltaTime);
}