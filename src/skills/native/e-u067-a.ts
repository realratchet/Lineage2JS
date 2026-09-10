import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll 0x7abc6b: target Location.XY rotation; 0x7abcd9: target feet; class 0xab16ac.
const effects: NativeSkillEffect_T[] = [{ phase: "shot", effectClass: "LineageEffect.e_u067_a", host: "target", rotation: "targetPosition" }];

export default effects;
