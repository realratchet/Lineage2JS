import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll 0x7aa9a8..0x7aa9d5: left-hand coords; 0x7aaa03..0x7aaa23: Z = target.Location.Z - CollisionHeight; 0x7aaa71: SpawnSkillEffect.
// 0x7aa9de/0x7aaa15: explicit SpeedRate1; 0x7aaa6c/0x7aaa6d: caster owner, null host.
const effects: NativeSkillEffect_T[] = [
    // 0x7aa973/0x7aa98b skip particles without a skeletal mesh; 0x7aa9c1 exits the phase if the left-hand bone is missing.
    { phase: "shot", effectClass: "LineageEffect.e_u049_a", host: "caster", positionBone: "bip01 l hand", missingBoneStopsPhase: true, height: "targetFeet", speedRate: 1 },
    // Engine.dll 0x7aab67..0x7aac06: V1*100, V2*560, (120,120,0), duration6, scale1, frequencies14000/120, strength280, range2000.
    // 0x7aaa78 uses prologue-zero position without a skeletal mesh; 0x7aaa7e requires the local controller.
    // Engine.dll 0x7aac0b..0x7aac7e: antarascave_smoke, same impact position, radius 2000.
    { phase: "shot", effectClass: "LineageEffect.e_u049_a", host: "caster", location: [0, 0, 0], positionBone: "bip01 l hand", missingBoneStopsPhase: true, height: "targetFeet", rotation: "zero", viewShake: { duration: 6, rotationScale: 1, rotationFrequency: 14000, positionFrequency: 120, direction: "y", rotationAmplitude: 100, rotationVelocity: 560, positionAmplitude: [120, 120, 0], strength: 280, range: 2000, event: { name: "antarascave_smoke", radius: 2000 } } }
];

export default effects;
