import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x79f23b..0x79f2c5: right-hand effect, LifeSpan=ShotTime; NAME_None uses bone 2 at 0x79e29c.
const effects: NativeSkillEffect_T[] = [
    { phase: "casting", effectClass: "LineageEffect.e_u058_r", host: "caster", owner: "none", position: "center", boneProperty: "RightHandBone", boneFallback: 2, lifeSpan: "shotTime" },
    // 0x7aca4a/0x7acabc/0x7acaf2: hand-name getter, bone coordinates, bone rotation; 0x7acaa9: missing bone -> 2.
    { phase: "shot", effectClass: "LineageEffect.e_u058_a", host: "caster", positionBoneProperty: "RightHandBone", boneFallback: 2, rotation: "bone", projectile: { target: "target" } },
    // 0x7901fb..0x790235: actual-hit Pawn light precedes e_u058_b; mode-0 defaults at 0x8b5193..0x8b51e8.
    { phase: "explosion", effectClass: "LineageEffect.e_u058_b", host: "impactActor", hitActor: true, pawnLightOnly: true, pawnLight: { color: [1, 1, 1], radius: 30, lifeTime: 0.2, spot: true, position: "lastTarget", rotation: "hit", radiusOffset: -1.2 } },
    // 0x79016d/0x79019f/0x790271: actual-hit radius and Owner; rotated radius factor 1.2 at 0x790133.
    { phase: "explosion", effectClass: "LineageEffect.e_u058_b", host: "impactActor", owner: "impactActor", position: "lastTarget", rotation: "hit", radiusOffset: -1.2, hitActor: true },
    // 0x790183..0x79019a/0x790271: no-hit uses unadjusted LastTargetLocation, null Owner, no pawn light.
    { phase: "explosion", effectClass: "LineageEffect.e_u058_b", host: "source", owner: "none", position: "lastTarget", rotation: "hit", hitActor: false }
];

export default effects;
