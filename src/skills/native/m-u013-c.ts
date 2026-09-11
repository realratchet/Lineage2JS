import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Shot 0x7af84c -> 0x7ac0c6: target host/owner, location mode 2.
const effects: NativeSkillEffect_T[] = [{ phase: "shot", effectClass: "LineageEffect.m_u013_c", host: "target", owner: "target", attach: "trail", position: "center" }];

export default effects;
