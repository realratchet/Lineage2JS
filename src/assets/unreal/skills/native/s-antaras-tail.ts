import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll 0x7aa02b/0x7aa03a/0x7aa046: forward vector * float[0xab1934]=600, subtracted from caster Location at 0x7aa04f..0x7aa064.
// 0x7aa070..0x7aa0b3: target mesh height; 0x7aa0b1/0x7aa0b8: SpeedRate1; 0x7aa0f5/0x7aa0f6: caster owner, null host.
const effects: NativeSkillEffect_T[] = [
    { phase: "shot", effectClass: "LineageEffect.e_u051_a", host: "caster", rotation: "caster", forwardOffset: -600, height: "targetMeshOrigin", targetRequired: "position", speedRate: 1 },
    // Engine.dll 0x7aa1ca..0x7aa28c: V1*100, V2*560, V3(120,120,0), duration6, scale1, frequencies14000/120, strength280, range3000.
    // Engine.dll 0x7aa291..0x7aa2ff: antarascave_smoke, same impact position, radius 3000.
    { phase: "shot", effectClass: "LineageEffect.e_u051_a", host: "caster", rotation: "caster", forwardOffset: -600, height: "targetMeshOrigin", targetRequired: "position", viewShake: { duration: 6, rotationScale: 1, rotationFrequency: 14000, positionFrequency: 120, direction: "y", rotationAmplitude: 100, rotationVelocity: 560, positionAmplitude: [120, 120, 0], strength: 280, range: 3000, event: { name: "antarascave_smoke", radius: 3000 } } },
    // Engine.dll 0x7aa2ff..0x7aa343 -> Action_Attack 0x8bde58..0x8bdf44 (-2*radius); AddPawnLight 0x8b518f..0x8b51e8 (white, 30, 0.2).
    { phase: "shot", effectClass: "LineageEffect.e_u051_a", host: "target", associatedActors: "primaryPerAssociated", pawnLightOnly: true, attackSounds: true, pawnLight: { color: [1, 1, 1], radius: 30, lifeTime: 0.2, spot: true, position: "center", rotation: "targetDisplacement", radiusOffset: -2 } }
];

export default effects;
