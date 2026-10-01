import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x79c268/0x79c05e: s_u010_b; PHYS_None 0x79c2b9; ShotTime 0x79c2bf..0x79c2c5.
    // GetRHandBoneName 0x79c2d3; named attachment 0x79c304, NAME_None bone 2 at 0x79c30b.
    { phase: "casting", effectClass: "LineageEffect.s_u010_b", host: "caster", position: "center", physics: "none", lifeSpan: "shotTime", boneProperty: "RightHandBone", boneFallback: 2, speedRate: 1 }
];

// Engine.dll Shot 0x7a49aa..0x7a49bb: Action_Attack(target,1,0,0,1,0,0,1); no Shot skill sound.
export const attackEffects: NativeSkillEffect_T[] = [
    { phase: "shot", effectClass: "LineageEffect.s_u010_b", host: "target", owner: "target", pawnLightOnly: true, attackSounds: "critical", damageEffect: "associated", pawnLight: { color: [1, 1, 1], radius: 30, lifeTime: 0.2, spot: true, position: "center", rotation: "targetDisplacement", radiusOffset: -2 } }
];

export default effects;
