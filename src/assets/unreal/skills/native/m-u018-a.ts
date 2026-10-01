import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x79f5c8: DesiredRotation; radius factor 0x79f61d; class 0x79f691.
// 0x79f5df: negative X; float[0xab0d1c]=2/3; radius scaling in SpawnSkillEffect 0x7986b5..0x7986f0.
// 0x79f631/0x79f635: copy supplied speed 1, not caster SkillSpeedRate (SpawnSkillEffect 0x798683..0x79868d).
const effects: NativeSkillEffect_T[] = [{ phase: "casting", effectClass: "LineageEffect.m_u018_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius", speedRate: 1 }];

export default effects;
