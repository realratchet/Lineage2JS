import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Shot 0x7a5ac6 requires StageShot=2; 0x7a5ad3 splits bTargetExcepted list/primary.
    // 0x7a5d9c divides target radius by 2; class 0x7a5c9d/0x7a5e3d, target Owner and null host at 0x7a5e48..0x7a5e53.
    { phase: "shot", specificStage: 2, effectClass: "LineageEffect.s_u015_b", host: "target", owner: "target", position: "center", rotation: "targetDisplacement", radiusOffset: -1 / 2, speedRate: 1, associatedActors: "targetExcepted" }
];

export default effects;
