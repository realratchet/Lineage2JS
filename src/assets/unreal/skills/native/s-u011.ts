import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Shot 0x7a7df6..0x7a7eb4 / 0x7a7fe0..0x7a806a: bTargetExcepted list or primary target, mode-2 trailer, rate1.
const effects: NativeSkillEffect_T[] = [{ phase: "shot", effectClass: "LineageEffect.s_u011_a", host: "target", owner: "target", attach: "trail", position: "center", speedRate: 1, associatedActors: "targetExcepted" }];

export default effects;
