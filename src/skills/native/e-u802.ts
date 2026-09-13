import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Shot 0x7b0c15..0x7b0cae / 0x7b0d14..0x7b0d89.
const effects: NativeSkillEffect_T[] = [
    { phase: "shot", effectClass: "LineageEffect.e_u802_fallback", host: "caster", physics: "none", bone: "Dummy05", boneFallback: 2 },
    { phase: "shot", effectClass: "LineageEffect.e_u802_refract", host: "caster", positionBone: "Dummy05", rotation: "caster", speedRate: 1 }
];

export default effects;
