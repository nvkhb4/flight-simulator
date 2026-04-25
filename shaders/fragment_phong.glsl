precision mediump float;
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vPosition;

uniform vec3 uLightPos;
uniform vec3 uViewPos;

void main() {
    //ambient
    vec3 ambient = 0.3 * vColor;

    //diffuse (lambert's law)
    vec3 norm = normalize(vNormal);
    vec3 lightDir = normalize(uLightPos - vPosition);
    float diff = max(dot(norm, lightDir), 0.0);
    vec3 diffuse = diff * vColor;

    //specular
    vec3 viewDir = normalize(uViewPos - vPosition);
    vec3 reflectDir = reflect(-lightDir, norm);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
    vec3 specular = 0.5 * spec * vec3(1.0);

    gl_FragColor = vec4(ambient + diffuse + specular, 1.0);
}
