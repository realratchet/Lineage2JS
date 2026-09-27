import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll 0x7a9c6b/0x7a9c7a/0x7a9c86: forward vector * float[0xab199c]=300, added to caster Location at 0x7a9c8f..0x7a9ca1.
// 0x7a9cb0..0x7a9cf3: target mesh height; 0x7a9cf1/0x7a9cf8: SpeedRate1; 0x7a9d35/0x7a9d36: caster owner, null host.
const effects: NativeSkillEffect_T[] = [
    { phase: "shot", effectClass: "LineageEffect.e_u043_a", host: "caster", rotation: "caster", forwardOffset: 300, height: "targetMeshOrigin", targetRequired: "position", speedRate: 1 },
    // Engine.dll 0x7a9e0a..0x7a9ecc: V1*100, V2*800, V3(120,120,0), duration6, scale1, frequencies20000/120, strength400, range3000.
    // Engine.dll 0x7a9ed1..0x7a9f3f: antarascave_smoke, same impact position, radius 3000.
    { phase: "shot", effectClass: "LineageEffect.e_u043_a", host: "caster", rotation: "caster", forwardOffset: 300, height: "targetMeshOrigin", targetRequired: "position", viewShake: { duration: 6, rotationScale: 1, rotationFrequency: 20000, positionFrequency: 120, direction: "y", rotationAmplitude: 100, rotationVelocity: 800, positionAmplitude: [120, 120, 0], strength: 400, range: 3000, event: { name: "antarascave_smoke", radius: 3000 } } }
];

export default effects;
