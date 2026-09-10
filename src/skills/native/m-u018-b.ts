import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Shot 0x7b0811 -> 0x7a9753: target trailer, location mode 2; size uses the calling caster at 0x7986b5.
const effects: NativeSkillEffect_T[] = [{ phase: "shot", effectClass: "LineageEffect.m_u018_b", host: "target", attach: "trail", position: "center" }];

export default effects;
