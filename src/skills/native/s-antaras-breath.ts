import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll 0x79e838..0x79e874: LifeSpan=ShotTime, RelativeLocation=(245,-120,0); 0x79e860..0x79e87f: rotation=(0,16384,0); 0x79e8b3: AttachToBone.
const effects: NativeSkillEffect_T[] = [
    // 0x79e7cb/0x79e7cf: explicit SpeedRate1; 0x79e824/0x79e825: caster owner, null host.
    { phase: "casting", effectClass: "LineageEffect.e_u046_a", host: "caster", bone: "bone01", relativeLocation: [245, -120, 0], relativeRotation: [0, 16384, 0], lifeSpan: "shotTime", speedRate: 1 },
    // Engine.dll 0x7ab19e..0x7ab234: (245,-120,0) rotated by GetBoneRotation(bone01,1), added to bone origin; 0x7ab23f: caster Rotation.
    // 0x7ab222/0x7ab22f: explicit SpeedRate1; 0x7ab289/0x7ab28a: caster host/owner.
    { phase: "shot", effectClass: "LineageEffect.e_u046_b", host: "caster", positionBone: "bone01", boneOffset: [245, -120, 0], rotation: "caster", projectile: { target: "target" }, speedRate: 1 },
    // Engine.dll 0x78fabc..0x78fac2: TargetActor.Location - CollisionHeight; 0x78fae1: Owner pawn rate; 0x78fb03/0x78fb4e: zero rotation, null host/owner.
    { phase: "explosion", effectClass: "LineageEffect.e_u046_c", host: "target", owner: "none", rotation: "zero", hitActor: true, sourceOwner: true, useSkillSpeed: "sourceOwner" },
    // 0x78fce0..0x78fd82: ownerless hit uses TargetActor feet and its SkillSpeedRate.
    { phase: "explosion", effectClass: "LineageEffect.e_u046_c", host: "target", owner: "none", rotation: "zero", hitActor: true, sourceOwner: false, useSkillSpeed: "target" },
    // 0x78f80b..0x78f879: LastTargetLocation minus rotated unit X; 0x78f87c: Owner required; 0x78f8ac/0x78f8fc: zero rotation, null host/owner.
    { phase: "explosion", effectClass: "LineageEffect.e_u046_c", host: "source", owner: "none", position: "lastTarget", rotation: "zero", forwardOffset: -1, offsetRotation: "hit", hitActor: false, sourceOwner: true, useSkillSpeed: "sourceOwner" }
];

export default effects;
