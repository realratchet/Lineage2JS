import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll 0x7abc6b: target Location.XY rotation; 0x7abcd9: target feet; class 0xab16ac.
// 0x7abd1c..0x7abd22 supplies NULL Owner; 0x7abc65 skips only this actor for a null target.
const effects: NativeSkillEffect_T[] = [{ phase: "shot", effectClass: "LineageEffect.e_u067_a", host: "target", owner: "none", rotation: "targetPosition", targetRequired: "position" }];

export default effects;
