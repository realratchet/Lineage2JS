import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x79ff2a; Shot 0x7adb2c -> 0x7ac0c6, location mode 2.
const effects: NativeSkillEffect_T[] = [
    { phase: "casting", effectClass: "LineageEffect.m_u004_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -0.6666666865348816, scale: "casterRadius" },
    { phase: "shot", effectClass: "LineageEffect.m_u004_b", host: "target", owner: "target", attach: "trail", position: "center" }
];

export default effects;
