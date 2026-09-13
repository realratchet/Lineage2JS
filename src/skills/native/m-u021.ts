import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x79fabf -> 0x7a12f8; Shot 0x7ac606..0x7ac69f: target feet, null host, target owner.
const effects: NativeSkillEffect_T[] = [
    { phase: "casting", effectClass: "LineageEffect.m_u021_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius" },
    { phase: "shot", effectClass: "LineageEffect.m_u021_b", host: "target", owner: "target" }
];

export default effects;
