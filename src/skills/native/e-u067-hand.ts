import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll 0x7abbb4 class; 0x7abc17 GetRHandBoneName; 0x7abc4e AttachToBone.
const effects: NativeSkillEffect_T[] = [{ phase: "shot", effectClass: "LineageEffect.e_u067_hand", host: "caster", attach: "rightHand" }];

export default effects;
