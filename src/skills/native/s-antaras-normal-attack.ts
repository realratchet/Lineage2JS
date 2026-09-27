import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll 0x7aa600..0x7aa62d: right-hand coords; 0x7aa66b..0x7aa684: Z = target.Location.Z - CollisionHeight; 0x7aa6cf: SpawnSkillEffect.
// 0x7aa638/0x7aa664: explicit SpeedRate1; 0x7aa6ca/0x7aa6cb: caster owner, null host.
const effects: NativeSkillEffect_T[] = [
    { phase: "shot", effectClass: "LineageEffect.e_u049_a", host: "caster", positionBone: "bip01 r hand", missingBoneStopsPhase: true, height: "targetFeet", targetRequired: "position", speedRate: 1 },
    // Engine.dll 0x7aa7e1..0x7aa8a4: V1*100, V2*560, V3(120,120,0), duration6, scale1, frequencies14000/120, strength280, range2000.
    // Engine.dll 0x7aa8a9..0x7aa923: antarascave_smoke, same impact position, radius 2000.
    { phase: "shot", effectClass: "LineageEffect.e_u049_a", host: "caster", positionBone: "bip01 r hand", missingBoneStopsPhase: true, height: "targetFeet", targetRequired: "position", rotation: "zero", viewShake: { duration: 6, rotationScale: 1, rotationFrequency: 14000, positionFrequency: 120, direction: "y", rotationAmplitude: 100, rotationVelocity: 560, positionAmplitude: [120, 120, 0], strength: 280, range: 2000, event: { name: "antarascave_smoke", radius: 2000 } } }
];

export default effects;
