import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll 0x7aa600..0x7aa62d: right-hand coords; 0x7aa66b..0x7aa684: Z = target.Location.Z - CollisionHeight; 0x7aa6cf: SpawnSkillEffect.
// 0x7aa638/0x7aa664: explicit SpeedRate1; 0x7aa6ca/0x7aa6cb: caster owner, null host.
const effects: NativeSkillEffect_T[] = [
    { phase: "shot", effectClass: "LineageEffect.e_u049_a", host: "caster", positionBone: "bip01 r hand", height: "targetFeet", speedRate: 1 }
];

export default effects;
