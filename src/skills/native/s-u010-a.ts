import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x7a1220: DesiredRotation; 0x7a1275: radius * float[0xab0d1c]=2/3; 0x7a1289..0x7a128d: SpeedRate=1; class 0x7a12e9.
const effects: NativeSkillEffect_T[] = [{ phase: "casting", effectClass: "LineageEffect.s_u010_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius", speedRate: 1 }];

export default effects;
