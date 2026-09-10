import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll SkillEffectInit 0x79e8bf; class string 0xab063c.
const effects: NativeSkillEffect_T[] = [{ phase: "casting", effectClass: "LineageEffect.e_u064_cloud", host: "target", attach: "trail", scale: "casterRadius" }];

export default effects;
