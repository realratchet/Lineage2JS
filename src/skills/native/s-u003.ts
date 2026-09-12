import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x7a17a8, PreShot 0x7a43c0, Shot 0x7afa26.
const effects: NativeSkillEffect_T[] = [
    { phase: "casting", effectClass: "LineageEffect.s_u003_a", host: "caster", position: "center", physics: "none", lifeSpan: "shotTime", boneProperty: "LeftHandBone" },
    { phase: "preshot", effectClass: "LineageEffect.s_u003_d", host: "caster", position: "center", rotation: "caster", physics: "none", boneProperty: "RightHandBone", projectile: { target: "target" } },
    { phase: "shot", effectClass: "LineageEffect.s_u003_b", host: "source", owner: "source", attach: "trail", position: "location", releaseProjectile: true }
];

export default effects;
