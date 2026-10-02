import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x79e1f6/0x79e215: caster Location, s_u007_a; 0x79e264: PHYS_None; 0x79e273: ShotTime; 0x79e27e/0x79e29c: RightHandBone or bone 2.
    { phase: "casting", effectClass: "LineageEffect.s_u007_a", host: "caster", position: "center", physics: "none", lifeSpan: "shotTime", boneProperty: "RightHandBone", boneFallback: 2, speedRate: 1 },
    // Shot 0x7a88f0/0x7a8a68: associated/primary split; 0x7a8a27/0x7a8b7b: target owner; 0x7a8a53/0x7a8ba1: caster mesh Origin.Z into TrailerPrePivot.Z.
    { phase: "shot", effectClass: "LineageEffect.s_u007_b", host: "target", owner: "target", position: "center", rotation: "targetDirection", associatedActors: "targetExcepted", trailerPrePivot: { meshOriginScale: 1 } }
];

export default effects;
