import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll 0x7a92ac..0x7a92bc: caster Owner and local controller guards; 0x7a93b6..0x7a943f: mode0 native shake before the particle.
    { phase: "shot", effectClass: "LineageEffect.p_u004_a", host: "caster", targetRequired: "phase", location: [0, 0, 0], rotation: "zero", viewShake: { duration: 6, rotationScale: 1, rotationFrequency: 14000, positionFrequency: 120, direction: "y", rotationAmplitude: 100, rotationVelocity: 560, positionAmplitude: [120, 120, 0], strength: 280, range: 3000, ownerRequired: true } },
    // Engine.dll 0x7a9444..0x7a95c5: caster center + target direction * radius * 2, caster rotation, target Owner.
    { phase: "shot", effectClass: "LineageEffect.p_u004_a", host: "caster", owner: "target", targetRequired: "phase", position: "center", rotation: "caster", radiusOffset: 2, offsetRotation: "targetDirection" }
];

export default effects;
