import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Shot 0x7a49e1..0x7a4a11: skill 6 adds CollisionHeight*float[0xaae3b0]=1/3, others the full height.
// 0x7a4a2b..0x7a4a3f: caster Rotation with Roll = appFrand()*float[0xaa13f8]=16384; 0x7a4a53..0x7a4a57: projectile, rate1.
const shot: NativeSkillEffect_T = { phase: "shot", effectClass: "LineageEffect.s_u015_a", host: "caster", position: "center", rotation: "caster", randomRoll: 16384, speedRate: 1, projectile: { target: "target" } };

export const blasterShot: NativeSkillEffect_T[] = [{ ...shot, heightOffset: 1 / 3 }];
export const stormShot: NativeSkillEffect_T[] = [{ ...shot, heightOffset: 1 }];

export const blasterExplosion: NativeSkillEffect_T[] = [
    // Engine.dll Explosion 0x78de2c..0x78df63: LastTargetLocation - HitRot*1.2*hit radius; hit Pawn white spot before the particle.
    { phase: "explosion", effectClass: "LineageEffect.s_u015_b", host: "impactActor", hitActor: true, pawnLightOnly: true, pawnLight: { color: [1, 1, 1], radius: 30, lifeTime: 0.2, spot: true, position: "lastTarget", rotation: "hit", radiusOffset: -1.2 } },
    // 0x78df68..0x78dfe2: SpawnActor with hit actor Owner; a miss spawns unowned at LastTargetLocation without an Owner gate.
    { phase: "explosion", effectClass: "LineageEffect.s_u015_b", host: "impactActor", owner: "impactActor", hitActor: true, position: "lastTarget", rotation: "hit", radiusOffset: -1.2 },
    { phase: "explosion", effectClass: "LineageEffect.s_u015_b", host: "source", owner: "none", hitActor: false, position: "lastTarget", rotation: "hit" }
];

export const stormExplosion: NativeSkillEffect_T[] = [
    // Engine.dll Explosion 0x78e07b..0x78e0db: Owner-gated miss at LastTargetLocation/HitRot, null host/owner, rate1.
    { phase: "explosion", effectClass: "LineageEffect.s_u015_b", host: "source", owner: "none", hitActor: false, sourceOwner: true, position: "lastTarget", rotation: "hit", speedRate: 1 },
    // 0x78e100..0x78e1d0: retained list entries, target host/owner, absolute bone 0.
    { phase: "explosion", effectClass: "LineageEffect.s_u015_b", host: "target", owner: "target", bone: 0, isAbsolute: true, speedRate: 1, hitActor: false, sourceOwner: true, associatedActors: "all" },
    // 0x78e1f0..0x78e2da: hit Location + HitRot*hit radius*float[0xaaef80]=-2, hit actor Owner, null host.
    { phase: "explosion", effectClass: "LineageEffect.s_u015_b", host: "impactActor", owner: "impactActor", hitActor: true, sourceOwner: true, position: "center", rotation: "hit", radiusOffset: -2, speedRate: 1 },
    // 0x78e2df..0x78e357: hit actor mode-1 trailer, rate1.
    { phase: "explosion", effectClass: "LineageEffect.m_u006_d", host: "impactActor", owner: "impactActor", hitActor: true, sourceOwner: true, attach: "trail", speedRate: 1 },
    // 0x78e36f..0x78e4f4: other list entries, Owner-to-entry rotation, entry radius*-2.
    { phase: "explosion", effectClass: "LineageEffect.s_u015_b", host: "target", owner: "target", hitActor: true, sourceOwner: true, position: "center", rotation: "targetDisplacement", radiusOffset: -2, speedRate: 1, associatedActors: "primaryAndSecondary", secondaryTargetOnly: true },
    // 0x78e4f9..0x78e702: ownerless hit requires the retained TargetActor; absolute bone 0, trailer, then other entries at bone 0.
    { phase: "explosion", effectClass: "LineageEffect.s_u015_b", host: "impactActor", owner: "impactActor", hitActor: true, sourceOwner: false, sourceTarget: true, location: [0, 0, 0], rotation: "zero", bone: 0, isAbsolute: true, speedRate: 1 },
    { phase: "explosion", effectClass: "LineageEffect.m_u006_d", host: "impactActor", owner: "impactActor", hitActor: true, sourceOwner: false, sourceTarget: true, attach: "trail", speedRate: 1 },
    { phase: "explosion", effectClass: "LineageEffect.s_u015_b", host: "target", owner: "target", hitActor: true, sourceOwner: false, sourceTarget: true, bone: 0, isAbsolute: true, speedRate: 1, associatedActors: "primaryAndSecondary", secondaryTargetOnly: true }
];
