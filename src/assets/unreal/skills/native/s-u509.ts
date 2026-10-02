import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x79c505..0x79c5b3: s_u509_a, PHYS_None, ShotTime, LeftHandBone; NAME_None bone 2 at 0x79e29c.
    // 0x79c5eb -> 0x7a199b..0x7a19ba: only named attachment sets RelativeRotation(0,16384,16384).
    { phase: "casting", effectClass: "LineageEffect.s_u509_a", host: "caster", position: "center", physics: "none", lifeSpan: "shotTime", boneProperty: "LeftHandBone", boneFallback: 2, relativeRotation: [0, 16384, 16384], relativeRotationOnNamedBone: true, speedRate: 1 },
    // Engine.dll PreShot 0x7a3f25..0x7a406e: target Location - (target - caster) direction * radius / 2, null host/owner, rate1.
    { phase: "preshot", effectClass: "LineageEffect.s_u509_d", host: "target", owner: "none", position: "center", rotation: "targetDisplacement", radiusOffset: -1 / 2, speedRate: 1 },
    // Engine.dll Shot 0x7a67de..0x7a68a6: releases the last prepared projectile; s_u509_c trails it.
    { phase: "shot", effectClass: "LineageEffect.s_u509_c", host: "source", owner: "source", attach: "trail", position: "location", releaseProjectile: true },
    // 0x7a68ae..0x7a69e2: s_u509_b, PHYS_None, LeftHandBone; NAME_None bone 2, named RelativeRotation(0,16384,0).
    { phase: "shot", effectClass: "LineageEffect.s_u509_b", host: "caster", position: "center", physics: "none", boneProperty: "LeftHandBone", boneFallback: 2, relativeRotation: [0, 16384, 0], relativeRotationOnNamedBone: true, speedRate: 1 },
    // Engine.dll Explosion 0x78e755 rejects null hits; 0x78e83d..0x78e86a hit-Pawn white light, then s_u509_e and DamageEffect with hit actor Owner.
    { phase: "explosion", effectClass: "LineageEffect.s_u509_e", host: "impactActor", hitActor: true, pawnLightOnly: true, pawnLight: { color: [1, 1, 1], radius: 30, lifeTime: 0.2, spot: true, position: "lastTarget", rotation: "hit", radiusOffset: -1.2 } },
    { phase: "explosion", effectClass: "LineageEffect.s_u509_e", host: "impactActor", owner: "impactActor", hitActor: true, position: "lastTarget", rotation: "hit", radiusOffset: -1.2 },
    { phase: "explosion", effectClass: "LineageEffect.s_u509_e", host: "impactActor", owner: "impactActor", hitActor: true, position: "lastTarget", rotation: "hit", radiusOffset: -1.2, damageEffect: "only" }
];

export default effects;
