import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x79ed7e..0x79ee4c: DesiredRotation, negative two-thirds radius, caster trailer.
    { phase: "casting", effectClass: "LineageEffect.m_u009_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -0.6666666865348816, scale: "casterRadius" },
    // Engine.dll Shot 0x7ac778..0x7ac802: target host/owner, location mode 2.
    { phase: "shot", effectClass: "LineageEffect.m_u009_c", host: "target", owner: "target", attach: "trail", position: "center" }
];

export default effects;
