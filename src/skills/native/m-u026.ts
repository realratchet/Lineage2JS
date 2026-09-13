import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x7a06db..0x7a0b79; Shot 0x7adcef; Explosion 0x79042a.
const effects: NativeSkillEffect_T[] = [
    { phase: "casting", effectClass: "LineageEffect.m_u026_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius" },
    { phase: "casting", effectClass: "LineageEffect.m_u026_b", host: "caster", position: "center", radiusOffset: 1, offsetRotation: "targetDirection", relativeTrailOffset: 1, lifeSpan: "shotTime" },
    { phase: "shot", effectClass: "LineageEffect.m_u026_c", host: "caster", position: "center", heightOffset: 1 / 3, rotation: "caster", projectile: { target: "target" } },
    { phase: "explosion", effectClass: "LineageEffect.m_u026_d", host: "target", owner: "target", position: "lastTarget", rotation: "hit", radiusOffset: -1.2, pawnLight: { color: [1, 1, 1], radius: 30, lifeTime: 0.2, spot: true } }
];

export default effects;
