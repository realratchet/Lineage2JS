import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init0x79e9e8..0x79eaa9: AdjustparticleLife(ShotTime), SetDelayed(HitTime*0.22,1,0), AttachToBone(Bone04,0).
    { phase: "casting", effectClass: "LineageEffect.e_u060_a", host: "caster", position: "center", heightOffset: 1, rotation: "zero", bone: "Bone04", boneOptional: true, speedRate: 1, adjustParticleLife: "shotTime", hitDelayScale: 0.22 },
    // Engine.dll Shot0x7a9762..0x7a985d: null host for m_u006_d, caster host for e_u060_b; only the former uses SkillSpeedRate.
    { phase: "shot", effectClass: "LineageEffect.m_u006_d", host: "caster", location: [0, 0, 0], rotation: "zero", useSkillSpeed: true },
    { phase: "shot", effectClass: "LineageEffect.e_u060_b", host: "caster", attach: "trail", speedRate: 1 },
    // Engine.dll Shot0x7a985d..0x7a99b2: ordered nonnull associated targets or the primary target, each as host and Owner.
    { phase: "shot", effectClass: "LineageEffect.e_u060_b", host: "target", owner: "target", attach: "trail", speedRate: 1, associatedActors: "targetExcepted" }
];

export default effects;
