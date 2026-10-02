import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Shot 0x7a9104; Explosion 0x78f4aa, target attachment 0x78f6eb.
const effects: NativeSkillEffect_T[] = [
    { phase: "shot", effectClass: "LineageEffect.e_u033_a", host: "caster", position: "center", rotation: "caster" },
    { phase: "shot", effectClass: "LineageEffect.e_u033_b", host: "caster", position: "center", rotation: "caster", radiusOffset: 2 / 3, offsetRotation: "desiredCaster", projectile: { target: "target" } },
    // Engine.dll 0x78f63c..0x78f6eb: Owner-gated particle, Owner Pawn rate (else 1), actual hit host/owner, mode 0 trailer, optional absolute bone 0.
    { phase: "explosion", effectClass: "LineageEffect.e_u033_c", host: "impactActor", owner: "impactActor", hitActor: true, sourceOwner: true, location: [0, 0, 0], bone: 0, boneOptional: true, isAbsolute: true, useSkillSpeed: "sourceOwner" },
    // 0x78f5ee..0x78f639 / 0x78f6f0..0x78f790: hit-Pawn light survives absent Owner; incoming direction * radius * 2.4, red, radius 30, lifetime .3.
    { phase: "explosion", effectClass: "LineageEffect.e_u033_c", host: "impactActor", hitActor: true, pawnLightOnly: true, pawnLight: { color: [1, 0, 0], radius: 30, lifeTime: 0.3, spot: true, position: "lastTarget", rotation: "hit", radiusOffset: -2.4 } },
    // 0x78f556..0x78f5e7: Owner-gated miss at LastTargetLocation/HitRot, null host/owner, Owner Pawn rate (else 1), no light.
    { phase: "explosion", effectClass: "LineageEffect.e_u033_c", host: "source", owner: "none", hitActor: false, sourceOwner: true, position: "lastTarget", rotation: "hit", useSkillSpeed: "sourceOwner" }
];

export default effects;
