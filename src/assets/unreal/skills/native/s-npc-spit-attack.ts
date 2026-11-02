import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Shot0x7aed07..0x7aee4c: target displacement, spawn at caster Location plus CollisionRadius along that direction.
    { phase: "shot", effectClass: "LineageEffect.e_u072_a", host: "caster", position: "center", rotation: "targetDisplacement", radiusOffset: 1, speedRate: 1, targetRequired: "phase", projectile: { target: "target" } },
    // Engine.dll Explosion0x7902bf..0x790425: LastTargetLocation minus HitRot*1.2*hit radius; miss retains LastTargetLocation.
    { phase: "explosion", effectClass: "LineageEffect.e_u072_b", host: "impactActor", owner: "impactActor", hitActor: true, position: "lastTarget", rotation: "hit", radiusOffset: -1.2 },
    { phase: "explosion", effectClass: "LineageEffect.e_u072_b", host: "source", owner: "none", hitActor: false, position: "lastTarget", rotation: "hit" }
];

export default effects;
