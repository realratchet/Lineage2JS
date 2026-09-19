import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x79ebae: DesiredRotation; class 0x79ec74.
// 0x79ebc5/0x79ec03: negative X * radius * float[0xab0d1c]=2/3; 0x79eccc/0x79ecdc/0x79eceb: light radius 30, RGB .9/.2/.2.
const effects: NativeSkillEffect_T[] = [{ phase: "casting", effectClass: "LineageEffect.m_u007_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius", pawnLight: { color: [0.9, 0.2, 0.2], radius: 30 } }];

export default effects;
