import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Shot 0x7ae35e: target-caster rotation; 0x7ae411: target radius / 2; class 0x7ae48b.
// 0x7ae496 -> 0x7a67d3/0x7a4df0: target IsRendered, then AssociateAttackedNotify before Shot sound.
// 0x7ae0ea..0x7ae308 / 0x7ae4a8..0x7ae6c8: bTargetExcepted selects ordered nonnull list entries, each followed by its damage effect.
const effects: NativeSkillEffect_T[] = [{ phase: "shot", effectClass: "LineageEffect.p_u004_a", host: "target", owner: "target", position: "center", rotation: "targetDisplacement", radiusOffset: -1 / 2, speedRate: 1, damageEffect: "associated", associatedActors: "targetExcepted" }];

export default effects;
