import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x79bc21..0x79bcb1: s_u001_a, PHYS_None, ShotTime; GetRHandBoneName at 0x79bccb, NAME_None bone 2 at 0x79bce3.
    { phase: "casting", effectClass: "LineageEffect.s_u001_a", host: "caster", position: "center", physics: "none", lifeSpan: "shotTime", boneProperty: "RightHandBone", boneFallback: 2, speedRate: 1 },
    // Engine.dll Shot 0x7a57b8..0x7a586b: RightHandBone coords, NAME_None bone 2; 0x7a58a9..0x7a590a: caster rotation, rate1, caster owner, null host.
    { phase: "shot", effectClass: "LineageEffect.s_u001_b", host: "caster", positionBoneProperty: "RightHandBone", boneFallback: 2, rotation: "caster", speedRate: 1 }
];

export default effects;
