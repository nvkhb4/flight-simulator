const canvas = document.getElementById("simCanvas");
const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");

if (!gl) {
    throw new Error("WebGL not supported in browser.");
}

const GRID_SIZE = 50;
const HEIGHT_MAX = 2;
const HEIGHT_MIN = -2;
const FREQUENCY = 0.25;

//view mode: 0=points, 1=wireframe, 2=faces
let viewMode = 1;

//shading mode: 0=flat, 1=smooth, 2=Phong
let shadingMode = 1;

//for smoother terrain (out of hw scope)
const noise = new PerlinNoise(90); // seed of 20 for reproducible terrain

//shader sources (loaded from files)
let vertex_sh = '';
let fragment_sh = '';

//load shaders from external files
async function loadShaders() {
    try {
        const vertResp = await fetch('shaders/vertex.glsl');
        vertex_sh = await vertResp.text();
        
        const fragResp = await fetch('shaders/fragment.glsl');
        fragment_sh = await fragResp.text();
        
        console.log('Shaders loaded successfully');
    } catch (error) {
        console.error('Failed to load shaders:', error);
        throw error;
    }
}

//helper functions
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const msg = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error("Shader compile error: " + msg);
    }
    return shader;
}

function createProgram(gl, vsSource, fsSource) {
    const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        const msg = gl.getProgramInfoLog(prog);
        gl.deleteProgram(prog);
        throw new Error("Program link error: " + msg);
    }

    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return prog;
}

//height to color function
//takes y coordinate and colors terrain accordingly
function height_to_color(y) {
    //colors
    const blue = [0,0,1];
    const green = [0,1,0];
    const brown = [0.6,0.4,0.2];
    const white = [1,1,1];

    if (y<0) return blue;
    if (y<0.5) return interpolated_color(blue, green, y/0.5);
    if (y<1.5) return interpolated_color(green, brown, (y-1.5)/0.5);
    return interpolated_color(brown, white, (y-1.5)/0.5);
}

//interpolate between colors (smoother transitions)
function interpolated_color(c1, c2, t) {
    return[
        c1[0] + (c2[0] - c1[0]) * t,
        c1[1] + (c2[1] - c1[1]) * t,
        c1[2] + (c2[2] - c1[2]) * t
    ];
}

//get_patch function
function get_patch(xmin, xmax, zmin, zmax) {
    const positions = [];
    const indices = [];
    const colorData = [];

    //map grid coords (i, j) to world coords (x, y, z)
    for (let i = 0; i <= GRID_SIZE; i++) {
        for (let j = 0; j <= GRID_SIZE; j++) {
            const x = xmin + (i/GRID_SIZE) * (xmax-xmin);
            const z = zmin + (j/GRID_SIZE) * (zmax-zmin);
            const y = noise.noise2D(x * FREQUENCY, z * FREQUENCY) * HEIGHT_MAX;
            positions.push(x, y, z);

            //color information
            const color = height_to_color(y);
            colorData.push(color[0], color[1], color[2]);
        }
    }

    //triangulate the grid, 2 triangles per cell
    const row = GRID_SIZE + 1;
    for (let i = 0; i < GRID_SIZE; i++) {
        for (let j = 0; j < GRID_SIZE; j++) {
            const a = i * row + j; //top-left
            const b = (i + 1) * row + j; //bottom-left
            const c = i * row + (j + 1); //top-right
            const d = (i + 1) * row + (j + 1); //bottom-right

            //triangle 1
            indices.push(a, b, c);
            //triangle 2
            indices.push(b, d, c);
        }
    }

    //wireframe mode
    const lineIndices = [];
    for (let i = 0; i < GRID_SIZE; i++) {
        for (let j = 0; j < GRID_SIZE; j++) {
            const a = i * row + j;
            const b = (i + 1) * row + j;
            const c = i * row + (j + 1);
            const d = (i + 1) * row + (j + 1);

            // horizontal, vertical, and one diagonal per cell
            lineIndices.push(a, c); // top edge
            lineIndices.push(a, b); // left edge
            lineIndices.push(a, d); // diagonal
        }
    }
    // close the last row and column
    for (let i = 0; i < GRID_SIZE; i++) {
        lineIndices.push(i * row + GRID_SIZE, (i+1) * row + GRID_SIZE); // right edge
    }
    for (let j = 0; j < GRID_SIZE; j++) {
        lineIndices.push(GRID_SIZE * row + j, GRID_SIZE * row + j + 1); // bottom edge
    }

    return {
        positions: new Float32Array(positions),
        indices: new Uint32Array(indices),   
        lineIndices: new Uint32Array(lineIndices),
        colors: new Float32Array(colorData),
    };
}

//gl state
let program;
let positionBuffer;
let indexBuffer;
let lineIndexBuffer;
let indexCount = 0;
let lineIndexCount = 0;

//uniform locations
let uProjLoc, uViewLoc;

//initialise the mesh
function initMesh() {
    program = createProgram(gl, vertex_sh, fragment_sh);

    uProjLoc = gl.getUniformLocation(program, "uProj");
    uViewLoc = gl.getUniformLocation(program, "uView");

    const patch = get_patch(-20, 20, -40, 0);
    indexCount = patch.indices.length;

    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, patch.positions, gl.STATIC_DRAW);

    indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, patch.indices, gl.STATIC_DRAW);

    lineIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, patch.lineIndices, gl.STATIC_DRAW); // ← correct
    lineIndexCount = patch.lineIndices.length; // ← also missing!

    const aPosition = gl.getAttribLocation(program, "aPosition");
    gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aPosition);

    //color
    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, patch.colors, gl.STATIC_DRAW);

    const aColor = gl.getAttribLocation(program, "aColor");
    gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aColor);

    gl.enable(gl.DEPTH_TEST);
}

let lastTime = Date.now();

function render() {
    const now = Date.now();
    const deltaTime = (now - lastTime) / 1000;
    lastTime = now;
    
    handleInput(deltaTime);
    
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(program);

    const proj = frustumMatrix(frustum.left, frustum.right, frustum.top, frustum.bottom, frustum.near, frustum.far);
    const view = lookAt(camera.position, add(camera.position, camera.forward), camera.up);

    gl.uniformMatrix4fv(uProjLoc, false, proj);
    gl.uniformMatrix4fv(uViewLoc, false, view);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    
    if (viewMode === 0) {
        //points
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.drawElements(gl.POINTS, indexCount, gl.UNSIGNED_INT, 0);
    } else if (viewMode === 1) {
        //wireframe
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineIndexBuffer);
        gl.drawElements(gl.LINES, lineIndexCount, gl.UNSIGNED_INT, 0);
    } else {
        //faces
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_INT, 0);
    }
    
    requestAnimationFrame(render);
}

//resize
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
    render();
}

//start
(async () => {
    await loadShaders();
    initMesh();
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();
    requestAnimationFrame(render);
})();