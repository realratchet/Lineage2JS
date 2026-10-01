import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x7a092c/0x7a096a: negative DesiredRotation X * radius*2/3; 0x7a097e/0x7a0988: rate1; 0x7a09e4: m_u038_a.
    { phase: "casting", effectClass: "LineageEffect.m_u038_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius", speedRate: 1 },
    // 0x7a09f4..0x7a0b45: caster center + target direction*radius, m_u038_b; 0x7a0b62..0x7a0b74: ShotTime and relative X=radius.
    // 0x7a0aea/0x7a0aed: rate1; 0x7a0aec/0x7a0b55/0x7a0b56: no trailer, caster owner, null host.
    { phase: "casting", effectClass: "LineageEffect.m_u038_b", host: "caster", position: "center", radiusOffset: 1, offsetRotation: "targetDirection", relativeTrailOffset: 1, lifeSpan: "shotTime", speedRate: 1 },
    // Shot 0x7ade54..0x7adf1d: m_u038_c at caster center + caster forward*radius; null owner/host and no projectile setup.
    { phase: "shot", effectClass: "LineageEffect.m_u038_c", host: "caster", owner: "none", position: "center", radiusOffset: 1, rotation: "caster" },
    // 0x7adf22/0x7adf28: caster center + height*float[0xaae3b0]=height/3; 0x7adf55: second m_u038_c; 0x7ae011..0x7ae046: projectile/context.
    { phase: "shot", effectClass: "LineageEffect.m_u038_c", host: "caster", position: "center", heightOffset: 1 / 3, rotation: "caster", projectile: { target: "target" } },
    // 0x7906e9..0x790722: actual-hit Pawn light precedes m_u038_d; mode-0 defaults at 0x8b5193..0x8b51e8.
    { phase: "explosion", effectClass: "LineageEffect.m_u038_d", host: "impactActor", hitActor: true, pawnLightOnly: true, pawnLight: { color: [1, 1, 1], radius: 30, lifeTime: 0.2, spot: true, position: "lastTarget", rotation: "hit", radiusOffset: -1.2 } },
    // 0x79065a/0x79068c/0x79075e: actual-hit radius and Owner; incoming-direction factor 1.2 at 0x790620.
    { phase: "explosion", effectClass: "LineageEffect.m_u038_d", host: "impactActor", owner: "impactActor", position: "lastTarget", rotation: "hit", radiusOffset: -1.2, hitActor: true },
    // 0x790670..0x790687/0x79075e: no-hit uses unadjusted LastTargetLocation, null Owner, no pawn light.
    { phase: "explosion", effectClass: "LineageEffect.m_u038_d", host: "source", owner: "none", position: "lastTarget", rotation: "hit", hitActor: false }
];

export default effects;
