import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Shot 0x7acf7c/0x7acf96: GUN_BONE4, missing index -> 2; 0x7ad037/0x7ad042/0x7ad044: e_u073_a, no owner/host.
    { phase: "shot", effectClass: "LineageEffect.e_u073_a", host: "caster", owner: "none", positionBone: "GUN_BONE4", boneFallback: 2, rotation: "bone" },
    // 0x7ad055 enables projectile setup and preserves bone coordinates (0x7984fe..0x798525); 0x7ad087/0x7ad095: e_u073_b, caster owner.
    // 0x7ad181: final direction Z -= float[0xab13b8]=0.3; 0x7ad1c8/0x7ad21e: tangents / 1.5; 0x7ad269: Duration=1.
    { phase: "shot", effectClass: "LineageEffect.e_u073_b", host: "caster", positionBone: "GUN_BONE4", boneFallback: 2, rotation: "bone", projectile: { target: "target", hermite: { duration: 1, tangentScale: 2 / 3, finalDirectionZ: -0.3 } } },
    // Explosion 0x7907ac..0x7907db: negative incoming XY, zero Z; 0x790918/0x790926: ground class, target owner, LastTargetLocation.
    { phase: "explosion", effectClass: "LineageEffect.e_u073_ground", host: "target", owner: "target", position: "lastTarget", rotation: "reverseHitHorizontal" }
];

export default effects;
