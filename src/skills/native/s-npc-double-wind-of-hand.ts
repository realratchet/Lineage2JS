import windOfHand from "./s-npc-wind-of-hand";
import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x79fffd/0x7a01c0: right/left casting effects; 0x7a012d..0x7a015d: first notify lifetime, ShotTime fallback.
const effects: NativeSkillEffect_T[] = [
    { ...windOfHand[0], lifeSpan: "firstShotTime" },
    { ...windOfHand[0], effectClass: "LineageEffect.e_u058_l", boneProperty: "LeftHandBone" },
    // Shot 0x7aca18..0x7aca4a: second shot uses GetLHandBoneName, otherwise GetRHandBoneName.
    { ...windOfHand[1], specificStage: 1 },
    { ...windOfHand[1], specificStage: 2, positionBoneProperty: "LeftHandBone" },
    windOfHand[2]
];

export default effects;
