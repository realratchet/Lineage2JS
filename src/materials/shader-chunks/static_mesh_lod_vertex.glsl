attribute float lodFade;
attribute vec3 lodBillboard;
flat varying float vLodFade;

vec3 applyStaticMeshLod(vec3 pos) {
    vLodFade = lodFade;
    if (lodBillboard.z != 0.0) {
        vec2 towardCamera = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xy - lodBillboard.xy;
        vec2 right = vec2(-towardCamera.y, towardCamera.x) / max(length(towardCamera), 0.0001);
        pos.xy = lodBillboard.xy + right * lodBillboard.z;
    }
    return pos;
}
