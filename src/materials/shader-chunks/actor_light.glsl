const int LE_STATIC_SPOT = 8;
const int LE_SPOTLIGHT = 12;
const int LE_NON_INCIDENCE = 13;
const int LE_CYLINDER = 17;
const int LE_SUNLIGHT = 19;
const int LE_QUADRATIC_NON_INCIDENCE = 20;

struct ActorLight {
    vec3 position;
    vec3 direction;
    vec3 color;
    float radius;
    float cone;
    int effect;
    bool isHardwareLight;
    vec2 attenuation;
};

float actorLightAttenuation(float distance, float radius, vec3 delta, vec3 normal) {
    float incidence = dot(delta, normal);

    if (incidence <= 0.0 || distance > radius) return 0.0;

    float a = distance / radius;
    float b = 2.0 * a * a * a - 3.0 * a * a + 1.0;

    return b / a * abs(incidence / radius) * 2.0;
}

// port of DynamicLight.sampleIntensity (dynamic-light.ts)
float actorLightIntensity(ActorLight light, vec3 position, vec3 normal) {
    // 0x903da8 bails when N.Direction >= 0 and scales by flt_AAEF80 = -2.0 otherwise
    if (light.effect == LE_SUNLIGHT) return max(-dot(light.direction, normal), 0.0) * 2.0;

    vec3 delta = light.position - position;
    float distanceSquared = dot(delta, delta);
    float distance = sqrt(distanceSquared);
    float radiusSquared = light.radius * light.radius;

    if (light.isHardwareLight) {
        if (distance >= light.radius || distance == 0.0) return 0.0;
        // D3DDrv RVA 0x1c99b..0x1c9a5: Theta=0, Phi=PI/2, Falloff=0.
        if (light.cone >= 0.0 && -dot(delta, light.direction) <= light.cone * distance) return 0.0;

        return 2.0 * max(dot(delta / distance, normal), 0.0) / (light.attenuation.x + light.attenuation.y * distance);
    }

    if (light.effect == LE_CYLINDER) {
        if (distance >= light.radius) return 0.0;

        return max(0.0, 1.0 - (delta.x * delta.x + delta.y * delta.y) / radiusSquared) * 2.0;
    }

    if (light.effect == LE_NON_INCIDENCE) {
        if (dot(delta, normal) <= 0.0 || distance >= light.radius) return 0.0;

        return sqrt(1.02 - distance / light.radius) * 2.0;
    }

    if (light.effect == LE_QUADRATIC_NON_INCIDENCE) {
        if (dot(delta, normal) <= 0.0 || distanceSquared >= radiusSquared) return 0.0;

        return (1.02 - distanceSquared / radiusSquared) * 2.0;
    }

    float attenuation = actorLightAttenuation(distance, light.radius, delta, normal);

    if (light.effect == LE_SPOTLIGHT || light.effect == LE_STATIC_SPOT) {
        if (attenuation <= 0.0) return 0.0;

        float sine = 1.0 - light.cone / 256.0;
        float rSine = 1.0 / (1.0 - sine);
        float vDotV = -dot(delta, light.direction);

        if (vDotV <= 0.0 || vDotV * vDotV <= sine * sine * distanceSquared) return 0.0;

        float cone = vDotV * rSine / distance - sine * rSine;

        return cone * cone * attenuation;
    }

    return attenuation;
}
