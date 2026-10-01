import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x79e041/0x79e07f: negative X * radius * float[0xab0d1c]=2/3; class push 0x79e0f3; Location override 0x79e568..0x79e581.
    { phase: "casting", effectClass: "LineageEffect.m_u014_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius", initialPosition: "center" },
    // Shot 0x7a8626..0x7a86e7: bTargetExcepted selects ordered nonnull targets; 0x7a8663/0x7a8667 copy rate1, 0x7a86bb selects mode1.
    // Primary 0x7a86ec..0x7a8780 uses the same target-owned trailer; 0x7b0e26 gates Shot sound on a spawned effect.
    { phase: "shot", effectClass: "LineageEffect.m_u014_b", host: "target", owner: "target", attach: "trail", speedRate: 1, associatedActors: "targetExcepted" }
];

export default effects;
