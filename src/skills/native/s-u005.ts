import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x79e67a -> 0x7a12ee; Shot 0x7a95fa -> 0x7a9753, location mode 1.
const effects: NativeSkillEffect_T[] = [
    { phase: "casting", effectClass: "LineageEffect.s_u005_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -0.6666666865348816, scale: "casterRadius" },
    { phase: "shot", effectClass: "LineageEffect.s_u005_b", host: "target", owner: "target", attach: "trail" }
];

export default effects;
