import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x79e58b: DesiredRotation; 0x79e5a2/0x79e5e0: negative X * radius * float[0xab0d1c]=2/3.
// Class 0x79e654 -> 0x79c4c2: caster trailer, radius scale; sound-only tail 0x7a1ba8, no pawn light.
const effects: NativeSkillEffect_T[] = [{ phase: "casting", effectClass: "LineageEffect.m_u007_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius" }];

export default effects;
