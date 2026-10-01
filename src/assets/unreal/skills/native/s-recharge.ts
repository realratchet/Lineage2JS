import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x79e49a/0x79e4d8: negative X * radius * float[0xab0d1c]=2/3; class 0x79e54c; Location override 0x79e568..0x79e581.
    { phase: "casting", effectClass: "LineageEffect.m_u022_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius", initialPosition: "center" },
    // Shot 0x7a8f08: trailer=true; 0x7a8f5e: location mode 1; class 0x7a8f6b; target host/owner 0x7a8f76..0x7a8f80.
    { phase: "shot", effectClass: "LineageEffect.m_u022_b", host: "target", owner: "target", attach: "trail" }
];

export default effects;
