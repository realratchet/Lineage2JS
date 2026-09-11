import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Shot 0x7b0811 -> 0x7a9753: target host/owner, location mode 2.
const effects: NativeSkillEffect_T[] = [{ phase: "shot", effectClass: "LineageEffect.m_u018_b", host: "target", owner: "target", attach: "trail", position: "center" }];

export default effects;
