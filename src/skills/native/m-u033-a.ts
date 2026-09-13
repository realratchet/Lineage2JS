import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x79fbde: DesiredRotation; radius factor 0x79fc33; class 0x79fca7.
const effects: NativeSkillEffect_T[] = [{ phase: "casting", effectClass: "LineageEffect.m_u033_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius" }];

export default effects;
