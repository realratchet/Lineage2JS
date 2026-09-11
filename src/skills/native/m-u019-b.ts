import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Shot 0x7aebd3: target-caster rotation; 0x7aec8c: target radius / 2; class 0x7aecfd.
const effects: NativeSkillEffect_T[] = [{ phase: "shot", effectClass: "LineageEffect.m_u019_b", host: "target", owner: "target", position: "center", rotation: "targetDirection", radiusOffset: -0.5 }];

export default effects;
