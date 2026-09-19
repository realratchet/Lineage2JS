import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x79e114/0x79e152: negative X * radius * float[0xab0d1c]=2/3; class 0x79e1c6; caster host/owner 0x79c4c8/0x79c4c9.
    { phase: "casting", effectClass: "LineageEffect.m_u010_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius" },
    // Shot 0x7a859f: trailer=true; 0x7a85f5: location mode 2; class 0x7a8602; target host/owner 0x7a860d..0x7a8617.
    { phase: "shot", effectClass: "LineageEffect.m_u010_c", host: "target", owner: "target", attach: "trail", position: "center" }
];

export default effects;
