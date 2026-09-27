import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll 0x7abc17 -> GetRHandBoneName 0x60b950 reads Pawn+0x410; 0x7abc4e attaches by name, NAME_None uses bone 2 at 0x7abc58.
const effects: NativeSkillEffect_T[] = [{ phase: "shot", effectClass: "LineageEffect.e_u067_hand", host: "caster", boneProperty: "RightHandBone", boneFallback: 2 }];

export default effects;
