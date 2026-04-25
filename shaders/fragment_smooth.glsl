precision mediump float;
varying vec3 vLitColor;

void main() {
    // Smooth/Gouraud shading - lighting was computed per vertex and interpolated
    gl_FragColor = vec4(vLitColor, 1.0);
}
