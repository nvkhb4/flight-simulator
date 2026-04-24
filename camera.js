const camera = {
    position: [0, 3, 0],
    forward: [0, 0, -1],
    up: [0, 1, 0],
    right: [1, 0, 0],
    pitch: 0,
    yaw: 0,
    roll: 0,
    speed: 0,
    maxSpeed: 15
};

const frustum = {
    left: -10,
    right: 10,
    top: 7.5,
    bottom: -7.5,
    near: 0.1,
    far: 500
};

function frustumMatrix(left, right, top, bottom, near, far) {
    const result = new Float32Array(16);
    const rl = right - left; //width
    const tb = top - bottom; //height
    const fn = far - near; //depth
    
    result[0] = (2 * near) / rl; 
    result[5] = (2 * near) / tb;
    result[8] = (right + left) / rl; //offset
    result[9] = (top + bottom) / tb;
    result[10] = -(far + near) / fn; //look down in the -ve z axis hence the neg sign
    result[11] = -1; //perspective projection
    result[14] = -(2 * far * near) / fn;
    result[15] = 0;
    
    return result;
}

function rotateByAxis(v, axis, angle) {
    //rodrigues' rotation formula
    const rad = angle*Math.PI/180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);

    //skew symmetric matrix K 
    const K = [
        [0, -axis[2], axis[1]],
        [axis[2], 0, -axis[0]],
        [-axis[1], axis[0], 0]
    ];

    const result = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
        result[i] = v[i] * c + 
            (K[i][0] * v[0] + K[i][1] * v[1] + K[i][2] * v[2]) * s +
            axis[i] * dot(axis, v) * (1 - c);
    }
    return result;
}

//recompute orthogonal vectors due to fp errors accumulating
function orthonormalize(forward, up) {
    //gram-schmidt to keep vectors perpendicular
    forward = normalize(forward);
    //ensure up is perpendicular to forward
    up = normalize(subtract(up, scale(forward, dot(forward, up))));
    up = normalize(up);
    return { forward, up };
}

function updateCameraVectors() {
    const ortho = orthonormalize(camera.forward, camera.up);
    camera.forward = ortho.forward;
    camera.up = ortho.up;
    camera.right = normalize(cross(camera.forward, camera.up));
}

function updateCamera(deltaTime) {
    //update position based on speed
    camera.position = add(camera.position, scale(camera.forward, camera.speed * deltaTime));
    
    //clamp altitude
    camera.position[1] = Math.max(MIN_ALTITUDE, Math.min(MAX_ALTITUDE, camera.position[1]));
}

const MIN_ALTITUDE = 2.5;
const MAX_ALTITUDE = 3.5;
const MAX_PITCH = 90;