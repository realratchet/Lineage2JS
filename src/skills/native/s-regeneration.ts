import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x79e041/0x79e07f: negative X * radius * float[0xab0d1c]=2/3; class push 0x79e0f3; Location override 0x79e568..0x79e581.
    { phase: "casting", effectClass: "LineageEffect.m_u014_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius", initialPosition: "center" },
    // Shot 0x7a8754/0x7a875f: trailer=true, location mode 1; 0x7a8761: class; 0x7a876c..0x7a8776: target host/owner.
    { phase: "shot", effectClass: "LineageEffect.m_u014_b", host: "target", owner: "target", attach: "trail" }
];

export default effects;
