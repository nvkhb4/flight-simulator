precision mediump float;

attribute vec3 aPosition;
attribute vec3 aColor;
attribute vec3 aNormal;
uniform mat4 uProj;
uniform mat4 uView;
uniform vec3 uLightPos;
varying vec3 vColor;
varying vec3 vLitColor;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
    gl_Position = uProj * uView * vec4(aPosition, 1.0);
    gl_PointSize = 3.0;
    vColor = aColor;
    vNormal = aNormal;
    vPosition = aPosition;
    
    // Compute per-vertex lighting for Gouraud (smooth) shading
    vec3 norm = normalize(aNormal);
    vec3 lightDir = normalize(uLightPos - aPosition);
    float diff = max(dot(norm, lightDir), 0.0);
    
    vec3 ambient = 0.3 * aColor;
    vec3 diffuse = diff * aColor;
    vLitColor = ambient + diffuse;
}
