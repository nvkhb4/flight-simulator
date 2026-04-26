#version 300 es
precision mediump float;

layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aColor;
layout(location = 2) in vec3 aNormal;

uniform mat4 uProj;
uniform mat4 uView;
uniform vec3 uLightPos;
uniform vec3 uViewPos;

out vec3 vColor;
flat out vec3 vLitColor;
out vec3 vNormal;
out vec3 vPosition;

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
    
    // Ambient and diffuse
    vec3 ambient = 0.3 * aColor;
    vec3 diffuse = diff * aColor;
    
    // Specular (smooth shading)
    vec3 viewDir = normalize(uViewPos - aPosition);
    vec3 reflectDir = reflect(-lightDir, norm);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
    vec3 specular = 0.5 * spec * vec3(1.0);
    
    vLitColor = ambient + diffuse + specular;
}
