import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x7a0558..0x7a06ce; Shot 0x7adbab; Explosion 0x78f351/0x790963.
const effects: NativeSkillEffect_T[] = [
    { phase: "casting", effectClass: "LineageEffect.m_u000_a", host: "caster", attach: "trail", scale: "casterRadius" },
    { phase: "casting", effectClass: "LineageEffect.m_u000_b", host: "caster", position: "center", heightOffset: 1 / 3, radiusOffset: 1, offsetRotation: "desiredCaster", relativeTrailOffset: 1, lifeSpan: "shotTime", adjustParticleLife: false },
    { phase: "shot", effectClass: "LineageEffect.m_u000_c", host: "caster", position: "center", heightOffset: 1 / 3, rotation: "caster", projectile: { target: "target" } },
    { phase: "explosion", effectClass: "LineageEffect.m_u000_d", host: "target", owner: "target", position: "lastTarget", rotation: "hit", radiusOffset: -1.2, pawnLight: { color: [1, 1, 1], radius: 30, lifeTime: 0.2, spot: true } }
];

export default effects;
