import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x7a16f9..0x7a17a3; Shot 0x7b0d96..0x7b0e33.
const effects: NativeSkillEffect_T[] = [
    { phase: "casting", effectClass: "LineageEffect.e_u524_meteor", host: "caster", owner: "none", rotation: "caster", adjustParticleLife: false, locList: { delay: -0.75, interval: -0.25 } },
    { phase: "shot", effectClass: "LineageEffect.e_u524_a", host: "caster", owner: "none" }
];

export default effects;
