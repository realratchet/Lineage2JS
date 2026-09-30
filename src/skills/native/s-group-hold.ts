import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll 0x7abc17 -> GetRHandBoneName 0x60b950 reads Pawn+0x410; 0x7abc4e attaches by name, NAME_None uses bone 2 at 0x7abc58.
    { phase: "shot", effectClass: "LineageEffect.e_u067_hand", host: "caster", boneProperty: "RightHandBone", boneFallback: 2 },
    // Engine.dll 0x7abc6b: target Location.XY rotation; 0x7abcd9: target feet; class 0xab16ac.
    // 0x7abd1c..0x7abd22 supplies NULL Owner; 0x7abc65 skips only this actor for a null target.
    { phase: "shot", effectClass: "LineageEffect.e_u067_a", host: "target", owner: "none", rotation: "targetPosition", targetRequired: "position" }
];

export default effects;
