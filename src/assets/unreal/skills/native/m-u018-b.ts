import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Shot 0x7b0811 -> 0x7a9753: target host/owner, location mode 2.
// 0x7b0821/0x7b0825: copy supplied speed 1; 0x7b0823: trailer; 0x7b0879: mode 2 preserves the template pivot.
// Engine.dll 0x7b0749..0x7b0811: bTargetExcepted selects ordered nonnull list entries; empty/all-null lists skip Shot sound.
const effects: NativeSkillEffect_T[] = [{ phase: "shot", effectClass: "LineageEffect.m_u018_b", host: "target", owner: "target", attach: "trail", position: "center", speedRate: 1, associatedActors: "targetExcepted" }];

export default effects;
