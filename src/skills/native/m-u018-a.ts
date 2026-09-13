import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x79f5c8: DesiredRotation; radius factor 0x79f61d; class 0x79f691.
const effects: NativeSkillEffect_T[] = [{ phase: "casting", effectClass: "LineageEffect.m_u018_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius" }];

export default effects;
