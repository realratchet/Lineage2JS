import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x7a02f2; Shot 0x7ac80f; Explosion 0x790a86.
const effects: NativeSkillEffect_T[] = [
    { phase: "casting", effectClass: "LineageEffect.m_u006_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius" },
    { phase: "casting", effectClass: "LineageEffect.m_u006_b", host: "caster", position: "center", heightOffset: 1, physics: "none", adjustParticleLife: "shotTime", pawnLight: { color: [0.6, 0, 0], radius: 30, spot: true, target: "caster" } },
    { phase: "shot", effectClass: "LineageEffect.m_u006_c", host: "caster", position: "center", heightOffset: 1, rotation: "caster", projectile: { target: "target" } },
    { phase: "explosion", effectClass: "LineageEffect.m_u006_e", host: "target", owner: "target", bone: 0, isAbsolute: true, pawnLight: { color: [1, 0, 0], radius: 30, lifeTime: 0.3, spot: true, position: "center", rotation: "hit", radiusOffset: -2.4 } }
];

export default effects;
