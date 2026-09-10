import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Shot 0x7af84c -> 0x7ac0c6: target trailer, location mode 2, caster-radius scaling.
const effects: NativeSkillEffect_T[] = [{ phase: "shot", effectClass: "LineageEffect.m_u013_c", host: "target", attach: "trail", position: "center" }];

export default effects;
