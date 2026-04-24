attribute vec3 aPosition;
attribute vec3 aColor;
uniform mat4 uProj;
uniform mat4 uView;
varying vec3 vColor;

void main() {
    gl_Position = uProj * uView * vec4(aPosition, 1.0);
    gl_PointSize = 3.0;
    vColor = aColor; //pass color to frag shader
}
