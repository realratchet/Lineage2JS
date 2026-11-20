flat varying float vLodFade;

void discardStaticMeshLod() {
    if (vLodFade == 0.0) return;
    float noise = fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(0.06711056, 0.00583715))));
    float threshold = (vLodFade > 0.0 ? vLodFade : 127.0 + vLodFade) / 127.0;
    if (vLodFade > 0.0 ? noise < threshold : noise >= threshold) discard;
}
