attribute vec3 aPosition;
uniform mat4 uProj;
uniform mat4 uView;

void main() {
    gl_Position = uProj * uView * vec4(aPosition, 1.0);
    gl_PointSize = 3.0;
}
