import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Shot 0x7aebd3: target-caster rotation; 0x7aec8c: target radius / 2; class 0x7aecfd.
// 0x7ae996..0x7aeb82: bTargetExcepted selects ordered nonnull list entries; 0x7aea24/0x7aebd3 have no self-rotation fallback.
const effects: NativeSkillEffect_T[] = [{ phase: "shot", effectClass: "LineageEffect.m_u019_b", host: "target", owner: "target", position: "center", rotation: "targetDisplacement", radiusOffset: -0.5, associatedActors: "targetExcepted" }];

export default effects;
