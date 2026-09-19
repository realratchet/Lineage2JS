import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Shot 0x7ae31b..0x7ae35e: target-caster rotation; 0x7ae411: divide target radius by 2; 0x7ae48b: p_u004_a.
// 0x7ae444/0x7ae44d enables copying supplied rate 1; SpawnSkillEffect 0x798683..0x79868d writes it to SpeedRate.
const effects: NativeSkillEffect_T[] = [{ phase: "shot", effectClass: "LineageEffect.p_u004_a", host: "target", owner: "target", position: "center", rotation: "targetDisplacement", radiusOffset: -1 / 2, speedRate: 1 }];

export default effects;
