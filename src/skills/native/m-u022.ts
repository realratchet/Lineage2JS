import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x79e483; Location override 0x79e568; Shot 0x7a8ef6.
const effects: NativeSkillEffect_T[] = [
    { phase: "casting", effectClass: "LineageEffect.m_u022_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius", initialPosition: "center" },
    { phase: "shot", effectClass: "LineageEffect.m_u022_b", host: "target", owner: "target", attach: "trail" }
];

export default effects;
