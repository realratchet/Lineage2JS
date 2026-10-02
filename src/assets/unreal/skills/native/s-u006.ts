import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x79bd1b..0x79bdaf: s_u006_a, PHYS_None, ShotTime; GetRHandBoneName at 0x79bdc9, NAME_None bone 2 at 0x79e29c.
    { phase: "casting", effectClass: "LineageEffect.s_u006_a", host: "caster", position: "center", physics: "none", lifeSpan: "shotTime", boneProperty: "RightHandBone", boneFallback: 2, speedRate: 1 },
    // Engine.dll Shot 0x7a4e62..0x7a4ecc: target mode-1 trailer, rate1; 0x7a4ed1..0x7a4f07: IsRendered, AssociateAttackedNotify.
    { phase: "shot", effectClass: "LineageEffect.s_u006_b", host: "target", owner: "target", attach: "trail", speedRate: 1, damageEffect: "associated" }
];

export default effects;
