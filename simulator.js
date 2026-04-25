const canvas = document.getElementById("simCanvas");
const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");

if (!gl) {
    throw new Error("WebGL not supported in browser.");
}

const GRID_SIZE = 80;
const HEIGHT_MAX = 4;
const FREQUENCY = 0.5;

//view mode: 0=points, 1=wireframe, 2=faces
let viewMode = 1;

//shading mode: 0=flat, 1=smooth, 2=Phong
let shadingMode = 0;

//for smoother terrain (out of hw scope)
const noise = new PerlinNoise(90); // seed of 20 for reproducible terrain

//shader sources (loaded from files)
let vertexSrc = '';
let fragmentFlat = '';
let fragmentSmooth = '';
let fragmentPhong = '';
let fragmentWater = '';

//water plane setup
let programWater;
let waterIndexBuffer, waterIndexCount;

//shader programs
let programFlat;
let programSmooth;
let programPhong;
let currentProgram;

//load shaders from external files
async function loadShaders() {
    try {
        //vertex
        const vertResp = await fetch('shaders/vertex.glsl');
        vertexSrc = await vertResp.text();

        const waterResp = await fetch('shaders/fragment_water.glsl');
        fragmentWater = await waterResp.text();
        
        //fragment
        const fragFlatResp = await fetch('shaders/fragment_flat.glsl');
        fragmentFlat = await fragFlatResp.text();
        
        const fragSmoothResp = await fetch('shaders/fragment_smooth.glsl');
        fragmentSmooth = await fragSmoothResp.text();
        
        const fragPhongResp = await fetch('shaders/fragment_phong.glsl');
        fragmentPhong = await fragPhongResp.text();
        
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

//water plane
function createWaterPlane(xmin, xmax, zmin, zmax) {
    const positions = new Float32Array([
        xmin, 0, zmin,
        xmax, 0, zmin,
        xmin, 0, zmax,
        xmax, 0, zmax,
    ]);
    const indices = new Uint32Array([
        0, 1, 2,
        1, 3, 2,
    ]);
    // Provide dummy colors and normals for vertex shader
    const colors = new Float32Array([
        0.0, 0.3, 0.8,
        0.0, 0.3, 0.8,
        0.0, 0.3, 0.8,
        0.0, 0.3, 0.8,
    ]);
    const normals = new Float32Array([
        0, 1, 0,
        0, 1, 0,
        0, 1, 0,
        0, 1, 0,
    ]);
    return { positions, indices, colors, normals };
}

//height to color function
//takes y coordinate and colors terrain accordingly
function height_to_color(y) {
    const blue  = [0.0, 0.2, 0.8];   // water — deeper, less saturated
    const green = [0.1, 0.6, 0.1];   // ground level
    const brown = [0.5, 0.3, 0.1];   // mid altitude
    const white = [1.0, 1.0, 1.0];   // peaks

    // below ground → water color
    if (y <= 0) return blue;

    // y in (0, 0.5]  → green at ground, starting to brown
    if (y < 0.5) return interpolated_color(green, green, y / 0.5);

    // y in [0.5, 1.2] → green to brown
    if (y < 1.2) return interpolated_color(green, brown, (y - 0.5) / 0.7);

    // y in [1.2, 2.0] → brown to white (peaks)
    return interpolated_color(brown, white, Math.min((y - 1.2) / 0.8, 1.0));
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
    const normalData = [];
    
    //helper function to get vertex position by index
    const getPos = (idx) => [
        positions[idx * 3],
        positions[idx * 3 + 1],
        positions[idx * 3 + 2]
    ];
    
    //initialize vertex normals (one per vertex, starts at [0,0,0])
    let vertexNormals = [];

    //map grid coords (i, j) to world coords (x, y, z)
    for (let i = 0; i <= GRID_SIZE; i++) {
        for (let j = 0; j <= GRID_SIZE; j++) {
            const x = xmin + (i/GRID_SIZE) * (xmax-xmin);
            const z = zmin + (j/GRID_SIZE) * (zmax-zmin);

            let height = 0;
            let amplitude = 1;
            let frequency = FREQUENCY;
            let maxValue = 0;

            for (let oct = 0; oct < 4; oct++) {
                height += noise.noise2D(x * frequency, z * frequency) * amplitude;
                maxValue += amplitude;
                frequency *= 2;
                amplitude *= 0.5;
            }

            const y = (height / maxValue) * HEIGHT_MAX;

            ///const y = noise.noise2D(x * FREQUENCY, z * FREQUENCY) * HEIGHT_MAX;
            positions.push(x, y, z);
            vertexNormals.push([0, 0, 0]);  //initialize normal for this vertex

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

            //horizontal, vertical, and one diagonal per cell
            lineIndices.push(a, c); //top edge
            lineIndices.push(a, b); //left edge
            lineIndices.push(a, d); //diagonal
        }
    }
    //close the last row and column
    for (let i = 0; i < GRID_SIZE; i++) {
        lineIndices.push(i * row + GRID_SIZE, (i+1) * row + GRID_SIZE); // right edge
    }
    for (let j = 0; j < GRID_SIZE; j++) {
        lineIndices.push(GRID_SIZE * row + j, GRID_SIZE * row + j + 1); // bottom edge
    }

    //compute face normals and accumulate to vertices
    for (let triIdx = 0; triIdx < indices.length; triIdx += 3) {
        const i0 = indices[triIdx];
        const i1 = indices[triIdx + 1];
        const i2 = indices[triIdx + 2];
        
        const v0 = getPos(i0);
        const v1 = getPos(i1);
        const v2 = getPos(i2);
        
        //edge vectors
        const edge1 = subtract(v1, v0);
        const edge2 = subtract(v2, v0);
        
        //face normal (cross product)
        const faceNormal = normalize(cross(edge1, edge2));
        
        //add this face normal to all 3 vertices
        vertexNormals[i0] = add(vertexNormals[i0], faceNormal);
        vertexNormals[i1] = add(vertexNormals[i1], faceNormal);
        vertexNormals[i2] = add(vertexNormals[i2], faceNormal);
    }
    
    //normalize all vertex normals (smooth shading)
    for (let i = 0; i < vertexNormals.length; i++) {
        vertexNormals[i] = normalize(vertexNormals[i]);
        normalData.push(vertexNormals[i][0], vertexNormals[i][1], vertexNormals[i][2]);
    }

    return {
        positions: new Float32Array(positions),
        indices: new Uint32Array(indices),   
        lineIndices: new Uint32Array(lineIndices),
        colors: new Float32Array(colorData),
        normals: new Float32Array(normalData),
    };
}

//gl state
let positionBuffer;
let indexBuffer;
let lineIndexBuffer;
let indexCount = 0;
let lineIndexCount = 0;
let colorBuffer;
let normalBuffer;
let waterPositionBuffer;
let waterColorBuffer;
let waterNormalBuffer;
let terrainVAO;  // Vertex Array Object for terrain faces
let terrainLineVAO;  // Vertex Array Object for terrain wireframe
let waterVAO;    // Vertex Array Object for water
let uniformLocs = {};  // Cache uniform locations

function initMesh() {
    // ── Shader programs ──────────────────────────────────────────
    programFlat   = createProgram(gl, vertexSrc, fragmentFlat);
    programSmooth = createProgram(gl, vertexSrc, fragmentSmooth);
    programPhong  = createProgram(gl, vertexSrc, fragmentPhong);
    programWater  = createProgram(gl, vertexSrc, fragmentWater); // new

    currentProgram = programSmooth;

    // ── Terrain patch ────────────────────────────────────────────
    const patch = get_patch(-20, 20, -60, 0);
    indexCount = patch.indices.length;

    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, patch.positions, gl.STATIC_DRAW);

    indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, patch.indices, gl.STATIC_DRAW);

    lineIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, patch.lineIndices, gl.STATIC_DRAW);
    lineIndexCount = patch.lineIndices.length;

    colorBuffer = gl.createBuffer();             // make this a global like positionBuffer
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, patch.colors, gl.STATIC_DRAW);

    normalBuffer = gl.createBuffer();            // same here
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, patch.normals, gl.STATIC_DRAW);

    // ── Water plane ──────────────────────────────────────────────
    const water = createWaterPlane(-20, 20, -40, 0); // same bounds as terrain patch
    waterIndexCount = water.indices.length;

    waterPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, waterPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, water.positions, gl.STATIC_DRAW);

    waterColorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, waterColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, water.colors, gl.STATIC_DRAW);

    waterNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, waterNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, water.normals, gl.STATIC_DRAW);

    waterIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, waterIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, water.indices, gl.STATIC_DRAW);

    // ── Create Terrain VAO ──────────────────────────────────────────
    terrainVAO = gl.createVertexArray();
    gl.bindVertexArray(terrainVAO);
    
    // Position
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const aPos = gl.getAttribLocation(programFlat, "aPosition");
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aPos);
    
    // Color
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    const aCol = gl.getAttribLocation(programFlat, "aColor");
    gl.vertexAttribPointer(aCol, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aCol);
    
    // Normal
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    const aNorm = gl.getAttribLocation(programFlat, "aNormal");
    gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aNorm);
    
    // Bind index buffer to VAO
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    
    // ── Create Terrain Line VAO ──────────────────────────────────────
    terrainLineVAO = gl.createVertexArray();
    gl.bindVertexArray(terrainLineVAO);
    
    // Position
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aPos);
    
    // Color
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.vertexAttribPointer(aCol, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aCol);
    
    // Normal
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aNorm);
    
    // Bind line index buffer to VAO
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineIndexBuffer);
    
    // ── Create Water VAO ────────────────────────────────────────────
    waterVAO = gl.createVertexArray();
    gl.bindVertexArray(waterVAO);
    
    // Position
    gl.bindBuffer(gl.ARRAY_BUFFER, waterPositionBuffer);
    const aWaterPos = gl.getAttribLocation(programWater, "aPosition");
    gl.vertexAttribPointer(aWaterPos, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aWaterPos);
    
    // Color
    gl.bindBuffer(gl.ARRAY_BUFFER, waterColorBuffer);
    const aWaterCol = gl.getAttribLocation(programWater, "aColor");
    gl.vertexAttribPointer(aWaterCol, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aWaterCol);
    
    // Normal
    gl.bindBuffer(gl.ARRAY_BUFFER, waterNormalBuffer);
    const aWaterNorm = gl.getAttribLocation(programWater, "aNormal");
    gl.vertexAttribPointer(aWaterNorm, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aWaterNorm);
    
    // Bind index buffer to VAO
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, waterIndexBuffer);
    
    gl.bindVertexArray(null);  // Unbind VAO

    // ── Cache uniform locations for ALL programs (use string keys, not program objects) ───────────────────────────────
    const programs = {
        flat:   programFlat,
        smooth: programSmooth,
        phong:  programPhong,
        water:  programWater,
    };

    for (const [name, prog] of Object.entries(programs)) {
        gl.useProgram(prog);
        uniformLocs[name] = {
            uProj:     gl.getUniformLocation(prog, "uProj"),
            uView:     gl.getUniformLocation(prog, "uView"),
            uLightPos: gl.getUniformLocation(prog, "uLightPos"),
            uViewPos:  gl.getUniformLocation(prog, "uViewPos"),
        };
    }

    gl.enable(gl.DEPTH_TEST);
}

let lastTime = Date.now();
let renderCount = 0;

function render() {
    const now = Date.now();
    const deltaTime = (now - lastTime) / 1000;
    lastTime = now;

    renderCount++;
    if (renderCount === 1) {
        console.log('First render call - debugging info:');
        console.log('Canvas size:', canvas.width, 'x', canvas.height);
        console.log('Viewport:', gl.getParameter(gl.VIEWPORT));
        console.log('IndexCount (terrain):', indexCount);
        console.log('LineIndexCount:', lineIndexCount);
        console.log('ViewMode:', viewMode, '(0=pts, 1=wire, 2=faces)');
        console.log('Camera pos:', camera.position);
    }

    handleInput(deltaTime);

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const proj = frustumMatrix(frustum.left, frustum.right, frustum.top, frustum.bottom, frustum.near, frustum.far);
    const view = lookAt(camera.position, add(camera.position, camera.forward), camera.up);

    // ── Shading mode selection ────────────────────────────────────
    const progName = shadingMode === 0 ? 'flat' : shadingMode === 1 ? 'smooth' : 'phong';
    if (shadingMode === 0) currentProgram = programFlat;
    else if (shadingMode === 1) currentProgram = programSmooth;
    else currentProgram = programPhong;

    gl.useProgram(currentProgram);

    // ── Terrain uniforms (use cached locations with string key) ──────────────────────────────
    const locs = uniformLocs[progName];
    gl.uniformMatrix4fv(locs.uProj, false, proj);
    gl.uniformMatrix4fv(locs.uView, false, view);
    if (locs.uLightPos) gl.uniform3f(locs.uLightPos, 10, 15, 10);
    if (locs.uViewPos)  gl.uniform3f(locs.uViewPos, camera.position[0], camera.position[1], camera.position[2]);

    // ── Re-bind terrain attribs (use VAO) ────────────────────────────────
    // Terrain draw ──────────────────────────────────────────────
    if (viewMode === 0) {
        gl.bindVertexArray(terrainVAO);
        gl.drawElements(gl.POINTS, indexCount, gl.UNSIGNED_INT, 0);
    } else if (viewMode === 1) {
        gl.bindVertexArray(terrainLineVAO);
        gl.drawElements(gl.LINES, lineIndexCount, gl.UNSIGNED_INT, 0);
    } else {
        gl.bindVertexArray(terrainVAO);
        gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_INT, 0);
    }

    // ── Water draw (faces only, no wireframe/points for water) ────
    if (viewMode === 2) {
        gl.useProgram(programWater);

        const waterLocs = uniformLocs['water'];
        if (waterLocs.uProj) gl.uniformMatrix4fv(waterLocs.uProj, false, proj);
        if (waterLocs.uView) gl.uniformMatrix4fv(waterLocs.uView, false, view);

        gl.bindVertexArray(waterVAO);
        gl.drawElements(gl.TRIANGLES, waterIndexCount, gl.UNSIGNED_INT, 0);
    }

    requestAnimationFrame(render);
}

//resize
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
    // Don't call render() here - requestAnimationFrame already does that
}

//start
(async () => {
    await loadShaders();
    initMesh();
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();
    requestAnimationFrame(render);
})();