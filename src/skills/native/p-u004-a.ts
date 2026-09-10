import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Shot 0x7ae35e: target-caster rotation; 0x7ae411: target radius / 2; class 0x7ae48b.
const effects: NativeSkillEffect_T[] = [{ phase: "shot", effectClass: "LineageEffect.p_u004_a", host: "target", position: "center", rotation: "targetDirection", radiusOffset: -0.5 }];

export default effects;
