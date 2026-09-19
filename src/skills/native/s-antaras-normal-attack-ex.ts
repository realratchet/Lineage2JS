import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll 0x7aa9a8..0x7aa9d5: left-hand coords; 0x7aaa03..0x7aaa23: Z = target.Location.Z - CollisionHeight; 0x7aaa71: SpawnSkillEffect.
// 0x7aa9de/0x7aaa15: explicit SpeedRate1; 0x7aaa6c/0x7aaa6d: caster owner, null host.
const effects: NativeSkillEffect_T[] = [
    { phase: "shot", effectClass: "LineageEffect.e_u049_a", host: "caster", positionBone: "bip01 l hand", height: "targetFeet", speedRate: 1 }
];

export default effects;
