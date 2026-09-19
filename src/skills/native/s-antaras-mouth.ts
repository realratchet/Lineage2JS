import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll 0x7aacc7..0x7aad18: target direction; 0x7aad8f/0x7aada4/0x7aadb8: multiply by float[0xab1844]=950.
// 0x7aad9e..0x7aae22: target mesh height or cylinder fallback; 0x7aae27/0x7aae2b: SpeedRate1; 0x7aae70/0x7aae71: caster owner, null host.
const effects: NativeSkillEffect_T[] = [
    { phase: "shot", effectClass: "LineageEffect.e_u044_b", host: "caster", rotation: "caster", offsetRotation: "targetDirection", forwardOffset: 950, height: "targetMeshOriginOrFeet", speedRate: 1 }
];

export default effects;
