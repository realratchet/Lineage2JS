import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x79fe6e/0x79feac: negative X * radius * float[0xab0d1c]=2/3; class 0x79ff20, caster/owner 0x7a12f4..0x7a12f8.
    { phase: "casting", effectClass: "LineageEffect.m_u036_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius" },
    // Shot 0x7ad9f9: trailer; 0x7ada4f: location mode 1; class 0x7ada5c; target/owner 0x7ac0bc..0x7ac0c6.
    { phase: "shot", effectClass: "LineageEffect.m_u036_b", host: "target", owner: "target", attach: "trail" }
];

export default effects;
