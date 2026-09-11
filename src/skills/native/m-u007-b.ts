import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Shot 0x7ac501..0x7ac505: target owner; AttachToBone(target, effect, 0, 1) at 0x7ac51d.
const effects: NativeSkillEffect_T[] = [{ phase: "shot", effectClass: "LineageEffect.m_u007_b", host: "target", owner: "target", bone: 0, isAbsolute: true }];

export default effects;
