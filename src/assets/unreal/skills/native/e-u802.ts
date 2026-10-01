import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Shot 0x7b0c15..0x7b0cae / 0x7b0d14..0x7b0d89.
const effects: NativeSkillEffect_T[] = [
    // 0x7b0be6..0x7b0c15: null host, zero location/rotation; 0x7b0cae ignores AttachToBone failure.
    { phase: "shot", effectClass: "LineageEffect.e_u802_fallback", host: "caster", location: [0, 0, 0], rotation: "zero", physics: "none", bone: "Dummy05", boneFallback: 2, boneOptional: true },
    // Engine.dll 0x7b0d23 pushes float 1 as SpawnSkillEffect's speed-rate argument.
    { phase: "shot", effectClass: "LineageEffect.e_u802_refract", host: "caster", positionBone: "Dummy05", missingBoneStopsPhase: true, rotation: "caster", speedRate: 1 }
];

export default effects;
