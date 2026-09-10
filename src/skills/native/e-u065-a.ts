import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll SkillEffectInit 0x79e92e; hit delay 0x79e99a; inverse scale 0x79e9cc.
const effects: NativeSkillEffect_T[] = [{ phase: "casting", effectClass: "LineageEffect.e_u065_a", host: "caster", attach: "trail", scale: "cancelCasterRadius", hitDelay: -0.2 }];

export default effects;
