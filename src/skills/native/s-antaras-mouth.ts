import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll 0x7aacc7..0x7aad18: target direction; 0x7aad8f/0x7aada4/0x7aadb8: multiply by float[0xab1844]=950.
// 0x7aad9e..0x7aae22: target mesh height or cylinder fallback; 0x7aae27/0x7aae2b: SpeedRate1; 0x7aae70/0x7aae71: caster owner, null host.
const effects: NativeSkillEffect_T[] = [
    { phase: "shot", effectClass: "LineageEffect.e_u044_b", host: "caster", rotation: "caster", offsetRotation: "targetDirection", forwardOffset: 950, height: "targetMeshOriginOrFeet", targetRequired: "position", speedRate: 1 },
    // Engine.dll 0x7aaf9c..0x7ab061: VST_UPDOWN, fixed Y, V1*100, V2*200, V3(100,100,0), duration10, scale1, frequencies5000/100, strength100, range2000.
    // Engine.dll 0x7ab066..0x7ab0dd: antarascave_smoke, same impact position, radius 2000.
    { phase: "shot", effectClass: "LineageEffect.e_u044_b", host: "caster", rotation: "caster", offsetRotation: "targetDirection", forwardOffset: 950, height: "targetMeshOriginOrFeet", targetRequired: "position", viewShake: { type: "upDown", duration: 10, rotationScale: 1, rotationFrequency: 5000, positionFrequency: 100, direction: "fixedY", rotationAmplitude: 100, rotationVelocity: 200, positionAmplitude: [100, 100, 0], strength: 100, range: 2000, event: { name: "antarascave_smoke", radius: 2000 } } }
];

export default effects;
