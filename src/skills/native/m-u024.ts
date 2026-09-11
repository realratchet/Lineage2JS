import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x79f76e..0x79f9ba; Shot 0x7aef96..0x7af281; physTrailer 0x8ce483.
const effects: NativeSkillEffect_T[] = [
    { phase: "casting", effectClass: "LineageEffect.m_u024_a", host: "caster", attach: "trail", position: "center", radiusOffset: 2, offsetRotation: "targetDirection", relativeTrailOffset: 2, lifeSpan: "shotTime", pawnLight: { color: [0.7, 0.3, 0.3], radius: 30, spot: true, target: "caster" } },
    { phase: "shot", effectClass: "LineageEffect.m_u024_b", host: "caster", position: "center", radiusOffset: 2, offsetRotation: "targetDirection" },
    { phase: "shot", effectClass: "LineageEffect.m_u024_c", host: "target", owner: "target", attach: "trail", position: "center" }
];

export default effects;
