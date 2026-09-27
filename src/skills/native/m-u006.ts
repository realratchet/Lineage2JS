import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x7a02f2; Shot 0x7ac80f; Explosion 0x790a86.
const effects: NativeSkillEffect_T[] = [
    { phase: "casting", effectClass: "LineageEffect.m_u006_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius" },
    { phase: "casting", effectClass: "LineageEffect.m_u006_b", host: "caster", position: "center", heightOffset: 1, physics: "none", adjustParticleLife: "shotTime", pawnLight: { color: [0.6, 0, 0], radius: 30, spot: true, target: "caster" } },
    { phase: "shot", effectClass: "LineageEffect.m_u006_c", host: "caster", position: "center", heightOffset: 1, rotation: "caster", projectile: { target: "target" } },
    // 0x790b8d..0x790c12: actual hit actor, zero transform, rate1, optional absolute bone0; Owner is not required.
    { phase: "explosion", effectClass: "LineageEffect.m_u006_e", host: "impactActor", owner: "impactActor", hitActor: true, location: [0, 0, 0], rotation: "zero", speedRate: 1, bone: 0, boneOptional: true, isAbsolute: true },
    // 0x790c17..0x790cdf: hit-Pawn Location minus 2*radius*1.2 along HitRot; independent red light, radius30, .3s.
    { phase: "explosion", effectClass: "LineageEffect.m_u006_e", host: "impactActor", hitActor: true, pawnLightOnly: true, pawnLight: { color: [1, 0, 0], radius: 30, lifeTime: 0.3, spot: true, position: "center", rotation: "hit", radiusOffset: -2.4 } },
    // 0x790b04..0x790b88: Owner-gated miss, null actor arguments, LastTargetLocation/HitRot, rate1, no light.
    { phase: "explosion", effectClass: "LineageEffect.m_u006_e", host: "source", owner: "none", hitActor: false, sourceOwner: true, position: "lastTarget", rotation: "hit", speedRate: 1 }
];

// Engine.dll Shot 0x7a99b2..0x7a9bc8: primary pair, then secondary bone hits; all spawns use Pawn+0x600.
export const shotEffects: NativeSkillEffect_T[] = [
    { phase: "shot", effectClass: "LineageEffect.m_u006_e", host: "target", owner: "target", bone: 0, isAbsolute: true, useSkillSpeed: true, associatedActors: "primaryAndSecondary", soundWithoutEffect: true },
    { phase: "shot", effectClass: "LineageEffect.m_u006_d", host: "target", owner: "target", attach: "trail", useSkillSpeed: true, associatedActors: "primaryAndSecondary", primaryTargetOnly: true }
];

// Engine.dll Explosion 0x791295..0x79148e: primary pair, then secondary bone hits; 0x7912a1/0x791331/0x7913f8 copy rate 1.
export const explosionEffects: NativeSkillEffect_T[] = [
    // Engine.dll 0x791153..0x7911b2: owner-present world hit uses LastTargetLocation and incoming HitRot.
    { phase: "explosion", effectClass: "LineageEffect.m_u006_e", host: "source", owner: "none", position: "lastTarget", rotation: "hit", speedRate: 1, hitActor: false, sourceOwner: true },
    { phase: "explosion", effectClass: "LineageEffect.m_u006_e", host: "target", owner: "target", bone: 0, isAbsolute: true, speedRate: 1, hitActor: false, sourceOwner: true, associatedActors: "all" },
    { phase: "explosion", effectClass: "LineageEffect.m_u006_e", host: "target", owner: "target", bone: 0, isAbsolute: true, speedRate: 1, hitActor: true, associatedActors: "primaryAndSecondary" },
    { phase: "explosion", effectClass: "LineageEffect.m_u006_d", host: "target", owner: "target", attach: "trail", speedRate: 1, hitActor: true, associatedActors: "primaryAndSecondary", primaryTargetOnly: true }
];

export default effects;
