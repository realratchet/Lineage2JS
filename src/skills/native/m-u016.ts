import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x79f3ee -> 0x7a12f8; Shot 0x7ae84c / 0x7ae917 -> 0x7ac0c6.
const effects: NativeSkillEffect_T[] = [
    { phase: "casting", effectClass: "LineageEffect.m_u016_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius" },
    { phase: "shot", effectClass: "LineageEffect.m_u016_b", host: "target", owner: "target", attach: "trail", position: "center" }
];

export default effects;
