import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Shot 0x7ad619..0x7ad71e: bTargetExcepted selects the nonnull target list; empty lists skip sound.
// 0x7ad71e -> 0x7ac0c6: target host/owner, location mode 1; class 0x7ad7cc.
const effects: NativeSkillEffect_T[] = [{ phase: "shot", effectClass: "LineageEffect.m_u033_b", host: "target", owner: "target", attach: "trail", associatedActors: "targetExcepted" }];

export default effects;
