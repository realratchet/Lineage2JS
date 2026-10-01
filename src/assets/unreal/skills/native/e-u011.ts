import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll 0x7a19f0/0x7a1a5c: e_u011_a at zero, caster Owner/Rotation; 0x7a1ac7/0x7a1b5f/0x7a1b6f: TrailerPrePivot.
    // 0x7a1ac1: float[0xa63438]=-1; 0x7a1b32: float[0xab0d1c]=2/3; 0x7a1b91: AdjustParticleLife(ShotTime).
    { phase: "casting", effectClass: "LineageEffect.e_u011_a", host: "caster", location: [0, 0, 0], rotation: "caster", trailerPrePivot: { meshOriginScale: -1, radiusOffset: -2 / 3 }, adjustParticleLife: "shotTime" }
];

export default effects;
