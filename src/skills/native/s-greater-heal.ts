import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x79cc0d/0x79cc4b: negative X * radius * float[0xab0d1c]=2/3; class 0x79ccbf; caster host/owner 0x7a12f4/0x7a12f5.
    { phase: "casting", effectClass: "LineageEffect.m_u032_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius" },
    // Shot 0x7a6f14/0x7a6f6a: trailer, mode 1; class 0x7a6f77; target host/owner 0x7a6f82..0x7a6f89; speed flag remains zero at 0x7a6f12.
    { phase: "shot", effectClass: "LineageEffect.m_u032_b", host: "target", owner: "target", attach: "trail" }
];

export default effects;
