import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x7a17a8, PreShot 0x7a43c0, Shot 0x7afa26.
const effects: NativeSkillEffect_T[] = [
    // Engine.dll 0x7a1878 -> 0x79e29c: NAME_None uses bone 2; unmatched names do not.
    { phase: "casting", effectClass: "LineageEffect.s_u003_a", host: "caster", position: "center", physics: "none", lifeSpan: "shotTime", boneProperty: "LeftHandBone", boneFallback: 2 },
    { phase: "preshot", effectClass: "LineageEffect.s_u003_d", host: "caster", position: "center", rotation: "caster", physics: "none", boneProperty: "RightHandBone", projectile: { target: "target" } },
    { phase: "shot", effectClass: "LineageEffect.s_u003_b", host: "source", owner: "source", attach: "trail", position: "location", releaseProjectile: true }
];

// Engine.dll Explosion 0x7916c7..0x791858: LastTargetLocation minus the rotated target-radius offset.
export const bowImpact: NativeSkillEffect_T[] = [{ phase: "explosion", effectClass: "LineageEffect.p_u004_a", host: "target", owner: "target", position: "lastTarget", rotation: "hit", radiusOffset: -1.2, pawnLight: { color: [1, 1, 1], radius: 30, lifeTime: 0.2, spot: true }, damageEffect: true }];

export default effects;
