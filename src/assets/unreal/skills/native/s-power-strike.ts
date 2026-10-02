import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init selector 0x7a1c6a -> 0x79e2c5; class 0x79e30a, Physics 0x79e359, ShotTime 0x79e35f..0x79e368.
    // 0x79e373: GetRHandBoneName; NAME_None uses bone 2 at 0x79bce3, named attachment at 0x79e3a6.
    { phase: "casting", effectClass: "LineageEffect.s_u002_a", host: "caster", position: "center", physics: "none", lifeSpan: "shotTime", boneProperty: "RightHandBone", boneFallback: 2, speedRate: 1 }
];

export default effects;
