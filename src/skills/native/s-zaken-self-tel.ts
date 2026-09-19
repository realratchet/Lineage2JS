import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x79ddc5/0x79de03: negative X * radius * float[0xab0d1c]=2/3; 0x79de74: e_u031_a; 0x79de93..0x79de99: ShotTime lifespan.
    // 0x79de14/0x79de18: speed-copy flag and supplied rate 1; 0x79de16: trailer enabled.
    { phase: "casting", effectClass: "LineageEffect.e_u031_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, lifeSpan: "shotTime", scale: "casterRadius", speedRate: 1 },
    // Shot 0x7abea8: e_u005_a; 0x7abef0: caster Location.Z - unscaled mesh Origin.Z; 0x7abf0c: caster owner; 0x7abf13..0x7abf1f: zero rotation.
    { phase: "shot", effectClass: "LineageEffect.e_u005_a", host: "caster", position: "meshOrigin" }
];

export default effects;
