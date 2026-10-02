import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x79e114/0x79e152: negative X * radius * float[0xab0d1c]=2/3; class 0x79e1c6; caster host/owner 0x79c4c8/0x79c4c9.
    { phase: "casting", effectClass: "LineageEffect.m_u010_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius" },
    // Shot 0x7a84c7..0x7a8588: bTargetExcepted selects ordered nonnull targets; 0x7a8504/0x7a8508 copy rate1, 0x7a855c selects mode2.
    // Primary 0x7a858d..0x7a8621 uses the same target-owned trailer; 0x7b0e26 gates Shot sound on a spawned effect.
    { phase: "shot", effectClass: "LineageEffect.m_u010_c", host: "target", owner: "target", attach: "trail", position: "center", speedRate: 1, associatedActors: "targetExcepted" }
];

export default effects;
