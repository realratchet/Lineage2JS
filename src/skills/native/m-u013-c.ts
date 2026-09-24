import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll 0x7af786..0x7af8c6: bTargetExcepted selects nonnull list entries or TargetPawn; target host/owner, mode2.
const effects: NativeSkillEffect_T[] = [{ phase: "shot", effectClass: "LineageEffect.m_u013_c", host: "target", owner: "target", attach: "trail", position: "center", associatedActors: "targetExcepted" }];

export default effects;
