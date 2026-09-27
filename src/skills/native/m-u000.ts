import type { NativeSkillEffect_T } from "../native-effects";

export const explosionEffects: NativeSkillEffect_T[] = [
    // Engine.dll 0x78f386/0x790963..0x79099c: LastTargetLocation - incoming direction*1.2*target radius.
    // 0x7909f9 -> 0x8b5193..0x8b51e8: mode-0 white spot, radius 30, lifetime 0.2, fixed impact position.
    { phase: "explosion", effectClass: "LineageEffect.m_u000_d", host: "target", owner: "target", position: "lastTarget", rotation: "hit", radiusOffset: -1.2, hitActor: true, pawnLight: { color: [1, 1, 1], radius: 30, lifeTime: 0.2, spot: true } },
    // 0x78f3da..0x78f3ee/0x790a37: no-hit uses unadjusted LastTargetLocation, null Owner, no pawn light.
    { phase: "explosion", effectClass: "LineageEffect.m_u000_d", host: "source", owner: "none", position: "lastTarget", rotation: "hit", hitActor: false }
];

// Engine.dll Init 0x7a0558..0x7a06ce; Shot 0x7adbab; Explosion 0x78f351/0x790963.
const effects: NativeSkillEffect_T[] = [
    { phase: "casting", effectClass: "LineageEffect.m_u000_a", host: "caster", attach: "trail", scale: "casterRadius" },
    { phase: "casting", effectClass: "LineageEffect.m_u000_b", host: "caster", position: "center", heightOffset: 1 / 3, radiusOffset: 1, offsetRotation: "desiredCaster", relativeTrailOffset: 1, lifeSpan: "shotTime", adjustParticleLife: false },
    { phase: "shot", effectClass: "LineageEffect.m_u000_c", host: "caster", position: "center", heightOffset: 1 / 3, rotation: "caster", projectile: { target: "target" } },
    ...explosionEffects
];

export default effects;
