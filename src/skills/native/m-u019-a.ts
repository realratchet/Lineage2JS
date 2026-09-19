import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x79f4c7: DesiredRotation; 0x79f516: radius * float at 0xab0d1c; class 0x79f587.
// 0x79f5c3 -> 0x79dafe: light radius 30 at 0x79db12, RGBA=.5 at 0x79db20..0x79db2d.
// 0x79f527/0x79f52b: explicit speed-rate flag and float 1.
const effects: NativeSkillEffect_T[] = [{ phase: "casting", effectClass: "LineageEffect.m_u019_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius", speedRate: 1, pawnLight: { color: [0.5, 0.5, 0.5], radius: 30 } }];

export default effects;
