import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll SkillEffectShot 0x7ab3af: target Location.XY rotation, target feet; class 0xab1764.
const effects: NativeSkillEffect_T[] = [{ phase: "shot", effectClass: "LineageEffect.e_u066_a", host: "target", rotation: "targetPosition" }];

export default effects;
