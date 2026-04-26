#version 300 es
precision mediump float;

flat in vec3 vLitColor;

out vec4 FragColor;

void main() {
    // Smooth/Gouraud shading - lighting was computed per vertex and interpolated
    FragColor = vec4(vLitColor, 1.0);
}
