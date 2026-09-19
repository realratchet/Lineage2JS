import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll 0x79e838..0x79e874: LifeSpan=ShotTime, RelativeLocation=(245,-120,0); 0x79e860..0x79e87f: rotation=(0,16384,0); 0x79e8b3: AttachToBone.
const effects: NativeSkillEffect_T[] = [
    // 0x79e7cb/0x79e7cf: explicit SpeedRate1; 0x79e824/0x79e825: caster owner, null host.
    { phase: "casting", effectClass: "LineageEffect.e_u046_a", host: "caster", bone: "bone01", relativeLocation: [245, -120, 0], relativeRotation: [0, 16384, 0], lifeSpan: "shotTime", speedRate: 1 },
    // Engine.dll 0x7ab19e..0x7ab234: (245,-120,0) rotated by GetBoneRotation(bone01,1), added to bone origin; 0x7ab23f: caster Rotation.
    // 0x7ab222/0x7ab22f: explicit SpeedRate1; 0x7ab289/0x7ab28a: caster host/owner.
    { phase: "shot", effectClass: "LineageEffect.e_u046_b", host: "caster", positionBone: "bone01", boneOffset: [245, -120, 0], rotation: "caster", projectile: { target: "target" }, speedRate: 1 },
    // ANSkillProjectile::SkillEffectExplosion 0x78dd90 case 4111: SpawnSkillEffect("LineageEffect.e_u046_c", hit location).
    { phase: "explosion", effectClass: "LineageEffect.e_u046_c", host: "source", position: "source", owner: "none" }
];

export default effects;
