import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll SkillEffectShot 0x7ab3af: target Location.XY rotation, target feet; class 0xab1764.
// 0x7ab46e..0x7ab474 supplies NULL Owner; 0x7ab3b7 keeps Shot sound without a target.
const effects: NativeSkillEffect_T[] = [{ phase: "shot", effectClass: "LineageEffect.e_u066_a", host: "target", owner: "none", rotation: "targetPosition", targetRequired: "position" }];

export default effects;
