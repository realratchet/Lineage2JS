import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x79f1d7/0x79f20c: trailer, mode 1; class 0x79f223; target host/owner 0x79f22e..0x79f235; ShotTime lifespan 0x79de93..0x79de99.
    { phase: "casting", effectClass: "LineageEffect.e_u031_a", host: "target", owner: "target", attach: "trail", lifeSpan: "shotTime", scale: "casterRadius" },
    // Shot 0x7abd65: e_u005_a; 0x7abdd6..0x7abdd9: target Location.Z - unscaled mesh Origin.Z; target owner 0x7abdfb, zero rotation 0x7abe04..0x7abe0e.
    { phase: "shot", effectClass: "LineageEffect.e_u005_a", host: "target", owner: "target", position: "meshOrigin" }
];

export default effects;
