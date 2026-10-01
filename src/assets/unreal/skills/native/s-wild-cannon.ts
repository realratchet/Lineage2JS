import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Shot 0x7acf7c/0x7acf96: GUN_BONE4, missing index -> 2; 0x7ad037/0x7ad042/0x7ad044: e_u073_a, no owner/host.
    { phase: "shot", effectClass: "LineageEffect.e_u073_a", host: "caster", owner: "none", positionBone: "GUN_BONE4", boneFallback: 2, rotation: "bone" },
    // 0x7ad055 enables projectile setup and preserves bone coordinates (0x7984fe..0x798525); 0x7ad087/0x7ad095: e_u073_b, caster owner.
    // 0x7ad181: final direction Z -= float[0xab13b8]=0.3; 0x7ad1c8/0x7ad21e: tangents / 1.5; 0x7ad269: Duration=1.
    { phase: "shot", effectClass: "LineageEffect.e_u073_b", host: "caster", positionBone: "GUN_BONE4", boneFallback: 2, rotation: "bone", projectile: { target: "target", hermite: { duration: 1, tangentScale: 2 / 3, finalDirectionZ: -0.3 } } },
    // Explosion 0x7907e2/0x790878: NULL/non-Mover; 0x79084f/0x790926: hit actor owner or NULL.
    { phase: "explosion", effectClass: "LineageEffect.e_u073_ground", host: "source", owner: "impactActor", position: "lastTarget", rotation: "reverseHitHorizontal", hitActorIsMover: false },
    // 0x790881/0x790887: AMover.HitActorNormal (+0x410); 0x7908c7/0x790926: door, hit actor owner.
    { phase: "explosion", effectClass: "LineageEffect.e_u073_door", host: "source", owner: "impactActor", position: "lastTarget", rotation: "hitActorNormal", hitActorIsMover: true }
];

export default effects;
