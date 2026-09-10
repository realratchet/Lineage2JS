import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Shot 0x7ac4f0; AttachToBone(target, effect, 0, 1) at 0x7ac51d.
const effects: NativeSkillEffect_T[] = [{ phase: "shot", effectClass: "LineageEffect.m_u007_b", host: "target", bone: 0, isAbsolute: true }];

export default effects;
