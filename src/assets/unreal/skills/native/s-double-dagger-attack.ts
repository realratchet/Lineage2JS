import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll PreShot 0x7a40cd..0x7a4123: StagePreShot hand guards; 0x7a4132: NSpear_sp; 0x7a41c6: weapon 5127; 0x7a42ee..0x7a4358: attach and retain.
    { phase: "preshot", effectClass: "LineageEffect.NSpear_sp", host: "caster", position: "center", rotation: "caster", preShotBones: ["RightHandBone", "LeftHandBone"], projectile: { target: "target" }, weaponId: 5127 },
    // Engine.dll Shot 0x7ae073..0x7ae0c1: detach/ShotNotify/remove first prepared projectile; no new particle.
    { phase: "shot", effectClass: "LineageEffect.NSpear_sp", host: "source", releaseProjectile: { first: true, spawn: false } }
];

export default effects;
