import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Shot 0x7ae31b..0x7ae35e: target-caster rotation; 0x7ae411: divide target radius by 2; 0x7ae48b: p_u004_a.
// 0x7ae444/0x7ae44d enables copying supplied rate 1; SpawnSkillEffect 0x798683..0x79868d writes it to SpeedRate.
// 0x7a67d3/0x7a4df0: target IsRendered, then AssociateAttackedNotify before Shot sound.
// 0x7ae0ea..0x7ae308: bTargetExcepted selects ordered nonnull list entries without primary-target fallthrough.
const effects: NativeSkillEffect_T[] = [{ phase: "shot", effectClass: "LineageEffect.p_u004_a", host: "target", owner: "target", position: "center", rotation: "targetDisplacement", radiusOffset: -1 / 2, speedRate: 1, damageEffect: "associated", associatedActors: "targetExcepted" }];

export default effects;
