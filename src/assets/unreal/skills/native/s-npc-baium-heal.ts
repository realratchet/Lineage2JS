import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll SpawnNTransientEffect 0x104c9fec..0x104ca162: caster feet, radius/9, second emitter SetDelayed(2,1,0).
const effects: NativeSkillEffect_T[] = [
    { phase: "shot", effectClass: "LineageEffect.m_u001_a", host: "caster", attach: "trail", rotation: "zero", trailerPrePivot: "casterFeet", scale: "casterCollisionRadius" },
    { phase: "shot", effectClass: "LineageEffect.m_u001_b", host: "caster", attach: "trail", rotation: "zero", trailerPrePivot: "casterFeet", scale: "casterCollisionRadius", delay: 2 }
];

export default effects;
