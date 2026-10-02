import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x79c5fb..0x79c6c7: s_u513_a, PHYS_None, ShotTime, RelativeRotation(0,-16384,0); RightHandBone, NAME_None bone 2.
    { phase: "casting", effectClass: "LineageEffect.s_u513_a", host: "caster", position: "center", physics: "none", lifeSpan: "shotTime", boneProperty: "RightHandBone", boneFallback: 2, relativeRotation: [0, -16384, 0], speedRate: 1 },
    // Engine.dll Shot 0x7a6578..0x7a6624: caster Owner, null host, RightHandBone; NAME_None bone 2.
    { phase: "shot", effectClass: "LineageEffect.s_u513_b", host: "caster", boneProperty: "RightHandBone", boneFallback: 2 },
    // 0x7a6629..0x7a67d9: non-self target, Location - (target - caster) direction * radius / 2, target Owner, rate1; IsRendered, AssociateAttackedNotify.
    { phase: "shot", effectClass: "LineageEffect.s_u513_c", host: "target", owner: "target", targetIsCaster: false, position: "center", rotation: "targetDisplacement", radiusOffset: -1 / 2, speedRate: 1, damageEffect: "associated" }
];

export default effects;
