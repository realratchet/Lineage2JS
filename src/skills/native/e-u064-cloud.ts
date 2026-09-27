import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x79e8c5 rejects a null target; 0x79e918..0x79e922 supplies target as host and Owner.
const effects: NativeSkillEffect_T[] = [{ phase: "casting", effectClass: "LineageEffect.e_u064_cloud", host: "target", owner: "target", attach: "trail", scale: "casterRadius", targetRequired: "phase" }];

export default effects;
