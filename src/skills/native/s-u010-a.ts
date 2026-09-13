import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x7a1220: DesiredRotation; 0x7a1275: radius * float at 0xab0d1c; class 0x7a12e9.
const effects: NativeSkillEffect_T[] = [{ phase: "casting", effectClass: "LineageEffect.s_u010_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius" }];

export default effects;
