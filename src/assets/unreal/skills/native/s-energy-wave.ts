import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll SkillEffectInit 0x79e92e; 0x79e99a..0x79e9a0: HitTime - float[0xaa9550]=.2; inverse scale 0x79e9cc.
const effects: NativeSkillEffect_T[] = [{ phase: "casting", effectClass: "LineageEffect.e_u065_a", host: "caster", attach: "trail", scale: "cancelCasterRadius", hitDelay: -0.2 }];

export default effects;
