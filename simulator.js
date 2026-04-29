const canvas = document.getElementById("simCanvas");
const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");

if (!gl) {
    throw new Error("WebGL not supported in browser.");
}

const GRID_SIZE = 80;
const HEIGHT_MAX = 4;
const FREQUENCY = 0.5;

//for infinite terrain
const PATCH_SIZE = 40; 
const MAX_PATCHES = 9; 
const patches = [];

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

//VAO helper functions for patch slots
function createTerrainVAO(slot) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    
    const aPos = gl.getAttribLocation(programFlat, "aPosition");
    const aCol = gl.getAttribLocation(programFlat, "aColor");
    const aNorm = gl.getAttribLocation(programFlat, "aNormal");
    
    //position
    gl.bindBuffer(gl.ARRAY_BUFFER, slot.positionBuffer);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aPos);
    
    //color
    gl.bindBuffer(gl.ARRAY_BUFFER, slot.colorBuffer);
    gl.vertexAttribPointer(aCol, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aCol);
    
    //normal
    gl.bindBuffer(gl.ARRAY_BUFFER, slot.normalBuffer);
    gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aNorm);
    
    //index buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, slot.indexBuffer);
    
    gl.bindVertexArray(null);
    return vao;
}

function createTerrainLineVAO(slot) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    
    const aPos = gl.getAttribLocation(programFlat, "aPosition");
    const aCol = gl.getAttribLocation(programFlat, "aColor");
    const aNorm = gl.getAttribLocation(programFlat, "aNormal");
    
    //position
    gl.bindBuffer(gl.ARRAY_BUFFER, slot.positionBuffer);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aPos);
    
    //color
    gl.bindBuffer(gl.ARRAY_BUFFER, slot.colorBuffer);
    gl.vertexAttribPointer(aCol, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aCol);
    
    //normal
    gl.bindBuffer(gl.ARRAY_BUFFER, slot.normalBuffer);
    gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aNorm);
    
    //line index buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, slot.lineIndexBuffer);
    
    gl.bindVertexArray(null);
    return vao;
}

function createWaterVAO(slot) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    
    const aPos = gl.getAttribLocation(programWater, "aPosition");
    const aCol = gl.getAttribLocation(programWater, "aColor");
    const aNorm = gl.getAttribLocation(programWater, "aNormal");
    
    //position
    gl.bindBuffer(gl.ARRAY_BUFFER, slot.waterPositionBuffer);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aPos);
    
    //color
    gl.bindBuffer(gl.ARRAY_BUFFER, slot.waterColorBuffer);
    gl.vertexAttribPointer(aCol, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aCol);
    
    //normal
    gl.bindBuffer(gl.ARRAY_BUFFER, slot.waterNormalBuffer);
    gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aNorm);
    
    //water index buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, slot.waterIndexBuffer);
    
    gl.bindVertexArray(null);
    return vao;
}

//height to color function
//takes y coordinate and colors terrain accordingly
function height_to_color(y) {
    const blue  = [0.0, 0.45, 0.98];   // water — deeper, less saturated
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

//upload patch data into a slot's pre-allocated buffers
function uploadPatch(slot, patchX, patchZ) {
    const xmin = patchX * PATCH_SIZE;
    const xmax = xmin + PATCH_SIZE;
    const zmin = patchZ * PATCH_SIZE;
    const zmax = zmin + PATCH_SIZE;

    const patch = get_patch(xmin, xmax, zmin, zmax);
    const water = createWaterPlane(xmin, xmax, zmin, zmax);

    //upload terrain data into slot buffers (DYNAMIC_DRAW allows rewriting)
    gl.bindBuffer(gl.ARRAY_BUFFER, slot.positionBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, patch.positions);

    gl.bindBuffer(gl.ARRAY_BUFFER, slot.colorBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, patch.colors);

    gl.bindBuffer(gl.ARRAY_BUFFER, slot.normalBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, patch.normals);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, slot.indexBuffer);
    gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, patch.indices);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, slot.lineIndexBuffer);
    gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, patch.lineIndices);

    //upload water data
    gl.bindBuffer(gl.ARRAY_BUFFER, slot.waterPositionBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, water.positions);

    gl.bindBuffer(gl.ARRAY_BUFFER, slot.waterColorBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, water.colors);

    gl.bindBuffer(gl.ARRAY_BUFFER, slot.waterNormalBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, water.normals);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, slot.waterIndexBuffer);
    gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, water.indices);

    //update slot metadata
    slot.patchX = patchX;
    slot.patchZ = patchZ;
    slot.active = true;
    slot.indexCount = patch.indices.length;
    slot.lineIndexCount = patch.lineIndices.length;
    slot.waterIndexCount = water.indices.length;
}

//get the grid coordinates of the patch the camera is currently in
function getCurrentPatchCoords() {
    return {
        px: Math.floor(camera.position[0] / PATCH_SIZE),
        pz: Math.floor(camera.position[2] / PATCH_SIZE),
    };
}

//update terrain patches based on camera position
function updateTerrain() {
    const { px, pz } = getCurrentPatchCoords();

    //build the set of patches we NEED (3x3 grid around current position)
    const needed = new Set();
    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            needed.add(`${px + dx},${pz + dz}`);
        }
    }

    //find which patches we already HAVE
    const have = new Set();
    for (const slot of patches) {
        if (slot.active) {
            have.add(`${slot.patchX},${slot.patchZ}`);
        }
    }

    //find what we need but don't have
    for (const key of needed) {
        if (!have.has(key)) {
            const [npx, npz] = key.split(',').map(Number);

            //find a slot to recycle — pick one that's NOT in the needed set
            const recycled = patches.find(s => 
                !s.active || !needed.has(`${s.patchX},${s.patchZ}`)
            );

            if (recycled) {
                uploadPatch(recycled, npx, npz);
            }
        }
    }

    //mark slots that are no longer needed as inactive
    for (const slot of patches) {
        if (slot.active && !needed.has(`${slot.patchX},${slot.patchZ}`)) {
            slot.active = false;
        }
    }
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
    //shader programs 
    programFlat   = createProgram(gl, vertexSrc, fragmentFlat);
    programSmooth = createProgram(gl, vertexSrc, fragmentSmooth);
    programPhong  = createProgram(gl, vertexSrc, fragmentPhong);
    programWater  = createProgram(gl, vertexSrc, fragmentWater);

    currentProgram = programSmooth;

    //generate sample patch to determine buffer sizes
    const samplePatch = get_patch(0, PATCH_SIZE, 0, PATCH_SIZE);
    const sampleWater = createWaterPlane(0, PATCH_SIZE, 0, PATCH_SIZE);

    //pre-allocate 9 patch slots with DYNAMIC_DRAW buffers
    for (let i = 0; i < MAX_PATCHES; i++) {
        const slot = {
            patchX: null,
            patchZ: null,
            active: false,
            indexCount: 0,
            lineIndexCount: 0,
            waterIndexCount: 0,
            
            //create buffers
            positionBuffer: gl.createBuffer(),
            colorBuffer: gl.createBuffer(),
            normalBuffer: gl.createBuffer(),
            indexBuffer: gl.createBuffer(),
            lineIndexBuffer: gl.createBuffer(),
            waterPositionBuffer: gl.createBuffer(),
            waterColorBuffer: gl.createBuffer(),
            waterNormalBuffer: gl.createBuffer(),
            waterIndexBuffer: gl.createBuffer(),
        };

        //pre-allocate buffer storage with DYNAMIC_DRAW
        gl.bindBuffer(gl.ARRAY_BUFFER, slot.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, samplePatch.positions.byteLength, gl.DYNAMIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, slot.colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, samplePatch.colors.byteLength, gl.DYNAMIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, slot.normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, samplePatch.normals.byteLength, gl.DYNAMIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, slot.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, samplePatch.indices.byteLength, gl.DYNAMIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, slot.lineIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, samplePatch.lineIndices.byteLength, gl.DYNAMIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, slot.waterPositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, sampleWater.positions.byteLength, gl.DYNAMIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, slot.waterColorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, sampleWater.colors.byteLength, gl.DYNAMIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, slot.waterNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, sampleWater.normals.byteLength, gl.DYNAMIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, slot.waterIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sampleWater.indices.byteLength, gl.DYNAMIC_DRAW);

        //create VAOs for this slot
        slot.vao = createTerrainVAO(slot);
        slot.lineVao = createTerrainLineVAO(slot);
        slot.waterVao = createWaterVAO(slot);

        patches.push(slot);
    }

    //uniform locations for ALL programs 
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

    //Initialize with starting 3×3 patch grid
    const startPX = Math.floor(camera.position[0] / PATCH_SIZE);
    const startPZ = Math.floor(camera.position[2] / PATCH_SIZE);

    let slotIdx = 0;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            uploadPatch(patches[slotIdx++], startPX + dx, startPZ + dz);
        }
    }
}

let lastTime = Date.now();

function render() {
    const now = Date.now();
    const deltaTime = (now - lastTime) / 1000;
    lastTime = now;

    handleInput(deltaTime);

    updateTerrain();

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const proj = frustumMatrix(frustum.left, frustum.right, frustum.top, frustum.bottom, frustum.near, frustum.far);
    const view = lookAt(camera.position, add(camera.position, camera.forward), camera.up);

    //shading mode selection
    const progName = shadingMode === 0 ? 'flat' : shadingMode === 1 ? 'smooth' : 'phong';
    if (shadingMode === 0) currentProgram = programFlat;
    else if (shadingMode === 1) currentProgram = programSmooth;
    else currentProgram = programPhong;

    gl.useProgram(currentProgram);

    //terrain uniforms (use cached locations with string key) 
    const locs = uniformLocs[progName];
    gl.uniformMatrix4fv(locs.uProj, false, proj);
    gl.uniformMatrix4fv(locs.uView, false, view);
    if (locs.uLightPos) gl.uniform3f(locs.uLightPos, 10, 15, 10);
    if (locs.uViewPos)  gl.uniform3f(locs.uViewPos, camera.position[0], camera.position[1], camera.position[2]);

    //draw all active terrain patches
    for (const slot of patches) {
        if (!slot.active) continue;

        if (viewMode === 0) {
            gl.bindVertexArray(slot.vao);
            gl.drawElements(gl.POINTS, slot.indexCount, gl.UNSIGNED_INT, 0);
        } else if (viewMode === 1) {
            gl.bindVertexArray(slot.lineVao);
            gl.drawElements(gl.LINES, slot.lineIndexCount, gl.UNSIGNED_INT, 0);
        } else {
            gl.bindVertexArray(slot.vao);
            gl.drawElements(gl.TRIANGLES, slot.indexCount, gl.UNSIGNED_INT, 0);
        }
    }

    //water draw (faces only, no wireframe/points for water)
    if (viewMode === 2) {
        gl.useProgram(programWater);

        const waterLocs = uniformLocs['water'];
        if (waterLocs.uProj) gl.uniformMatrix4fv(waterLocs.uProj, false, proj);
        if (waterLocs.uView) gl.uniformMatrix4fv(waterLocs.uView, false, view);

        //draw all active water patches
        for (const slot of patches) {
            if (!slot.active) continue;
            gl.bindVertexArray(slot.waterVao);
            gl.drawElements(gl.TRIANGLES, slot.waterIndexCount, gl.UNSIGNED_INT, 0);
        }
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