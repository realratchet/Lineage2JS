import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x79ebae: DesiredRotation; class 0x79ec74.
const effects: NativeSkillEffect_T[] = [{ phase: "casting", effectClass: "LineageEffect.m_u007_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius", pawnLight: { color: [0.9, 0.2, 0.2], radius: 30 } }];

export default effects;
