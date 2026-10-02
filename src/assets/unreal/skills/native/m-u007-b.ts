import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Shot 0x7ac39f..0x7ac522: bTargetExcepted selects the target list; both paths attach to absolute bone 0 and reach sound exit 0x7a653a.
// NPC Weakness Shot 0x7a8fa4..0x7a90e8 joins the shared target path at 0x7ac4e0.
const effects: NativeSkillEffect_T[] = [{ phase: "shot", effectClass: "LineageEffect.m_u007_b", host: "target", owner: "target", bone: 0, isAbsolute: true, associatedActors: "targetExcepted", soundWithoutEffect: true }];

export default effects;
