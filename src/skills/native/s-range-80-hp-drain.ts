import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x7a1404: negative X; 0x7a1442: radius*float[0xab0d1c]=radius*2/3; class push 0x7a14b6.
    { phase: "casting", effectClass: "LineageEffect.s_u019_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius" },
    // Shot 0x7b03d6..0x7b0422: target Location minus caster Location; 0x7b04ab/0x7b04db: radius/2; class push 0x7b054c.
    // Engine.dll 0x7b0002..0x7b03d0: bTargetExcepted list pairs precede the primary pair; null list entries are invalid.
    { phase: "shot", effectClass: "LineageEffect.s_u019_b", host: "target", owner: "target", position: "center", rotation: "targetDisplacement", radiusOffset: -0.5, associatedActors: "targetExceptedAndPrimary" },
    // 0x7b0577/0x7b05b9: target Location/caster Rotation; 0x7b0663/0x7b066f: speed .1/acceleration 450; path 0x7b06a8..0x7b06d0.
    { phase: "shot", effectClass: "LineageEffect.s_u019_c", host: "target", position: "center", rotation: "caster", associatedActors: "targetExceptedAndPrimary", projectile: { target: "caster", speed: 0.1, acceleration: 450, path: [[-0.2, 0, 40], [1, 0, 0]] } }
];

export default effects;
