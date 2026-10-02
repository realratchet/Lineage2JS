import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x79c3f4..0x79c4cc: DesiredRotation, negative 2/3 radius (0x79c449), caster trailer/scale, s_u020_a (0x79c4b0).
    { phase: "casting", effectClass: "LineageEffect.s_u020_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius" },
    // Engine.dll Shot 0x7a5e62: null target exits; 0x7a5f30..0x7a5f7b: target radius/2; 0x7a5fe6/0x7a5ff7: s_u020_b, target Owner.
    { phase: "shot", effectClass: "LineageEffect.s_u020_b", host: "target", owner: "target", targetRequired: "phase", position: "center", rotation: "targetDisplacement", radiusOffset: -0.5, speedRate: 1 },
    // Engine.dll 0x7a601d/0x7a605e..0x7a60b2: s_u020_c, target Location/caster Rotation/Owner; 0x7a613e/0x7a6148: .1/450; 0x7a6184..0x7a61c0: path.
    { phase: "shot", effectClass: "LineageEffect.s_u020_c", host: "target", position: "center", rotation: "caster", projectile: { target: "caster", speed: 0.1, acceleration: 450, path: [[-0.2, 30, 30], [1, 0, 0]] } },
    // Engine.dll 0x7a6227..0x7a62ab: second s_u020_c; 0x7a6337/0x7a6341: .1/450; 0x7a637d..0x7a63b9: mirrored path.
    { phase: "shot", effectClass: "LineageEffect.s_u020_c", host: "target", position: "center", rotation: "caster", projectile: { target: "caster", speed: 0.1, acceleration: 450, path: [[-0.2, -30, 30], [1, 0, 0]] } }
];

export default effects;
