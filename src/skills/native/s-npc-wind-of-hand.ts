import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x79f23b..0x79f2c5: right-hand effect, LifeSpan=ShotTime; NAME_None uses bone 2 at 0x79e29c.
const effects: NativeSkillEffect_T[] = [
    { phase: "casting", effectClass: "LineageEffect.e_u058_r", host: "caster", owner: "none", position: "center", boneProperty: "RightHandBone", boneFallback: 2, lifeSpan: "shotTime" },
    // 0x7aca4a/0x7acabc/0x7acaf2: hand-name getter, bone coordinates, bone rotation; 0x7acaa9: missing bone -> 2.
    { phase: "shot", effectClass: "LineageEffect.e_u058_a", host: "caster", positionBoneProperty: "RightHandBone", boneFallback: 2, rotation: "bone", projectile: { target: "target" } },
    // 0x790133..0x7901ef: LastTargetLocation - hit direction * radius * 1.2; 0x790249/0x790271: e_u058_b, target owner.
    { phase: "explosion", effectClass: "LineageEffect.e_u058_b", host: "target", owner: "target", position: "lastTarget", rotation: "hit", radiusOffset: -1.2 }
];

export default effects;
