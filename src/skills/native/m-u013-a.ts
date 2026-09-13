import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x79fd84: DesiredRotation; radius factor 0x79fdd9; class 0x79fe4d.
const effects: NativeSkillEffect_T[] = [{ phase: "casting", effectClass: "LineageEffect.m_u013_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius" }];

export default effects;
