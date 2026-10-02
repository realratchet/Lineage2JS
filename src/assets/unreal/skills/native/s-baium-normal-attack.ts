import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Shot 0x7ab2dc rejects a null target; 0x7ab3a2..0x7ab3aa supplies target as host and Owner.
const effects: NativeSkillEffect_T[] = [{ phase: "shot", effectClass: "LineageEffect.e_u063_a", host: "target", owner: "target", attach: "trail", targetRequired: "phase" }];

export default effects;
