import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x79d3dd..0x79d4a0: target direction * caster radius * 2; 0x79d547..0x79d55d: ShotTime and relative trailer X=radius*2.
    { phase: "casting", effectClass: "LineageEffect.m_u028_a", host: "caster", attach: "trail", position: "center", radiusOffset: 2, offsetRotation: "targetDirection", relativeTrailOffset: 2, lifeSpan: "shotTime" },
    // Engine.dll Shot 0x7a6f9b..0x7a70d8: caster center + target direction * radius * float[0xa9cec8]=5, caster rotation; 0x7a7069..0x7a706d: projectile, rate1.
    { phase: "shot", effectClass: "LineageEffect.m_u028_b", host: "caster", position: "center", radiusOffset: 5, offsetRotation: "targetDirection", rotation: "caster", speedRate: 1, projectile: { target: "target" } },
    // Engine.dll Explosion 0x78ef60..0x78efd2: hit actor mode-1 trailer, rate1; 0x78efd7..0x78f14c: red spot at LastTargetLocation - HitRot*1.2*radius*2, .3s.
    { phase: "explosion", effectClass: "LineageEffect.m_u028_c", host: "impactActor", owner: "impactActor", hitActor: true, attach: "trail", speedRate: 1 },
    { phase: "explosion", effectClass: "LineageEffect.m_u028_c", host: "impactActor", hitActor: true, pawnLightOnly: true, pawnLight: { color: [1, 0, 0], radius: 30, lifeTime: 0.3, spot: true, position: "lastTarget", rotation: "hit", radiusOffset: -2.4 } },
    // 0x78eefe..0x78ef4e: Owner-gated miss at LastTargetLocation/HitRot, null host/owner, rate1.
    { phase: "explosion", effectClass: "LineageEffect.m_u028_c", host: "source", owner: "none", hitActor: false, sourceOwner: true, position: "lastTarget", rotation: "hit", speedRate: 1 }
];

export default effects;
