import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x79bf3d..0x79c006: DesiredRotation transforms [-1, 0, 0] * radius * 2/3; mode 1 at 0x79bfec, class s_u017_a.
    { phase: "casting", effectClass: "LineageEffect.s_u017_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius", speedRate: 1 },
    // Engine.dll Shot 0x7a5958..0x7a59a4: AssociatedActors loop; mode 1 at 0x7a59ed, class s_u017_b at 0x7a59fa; target host/owner; zero rotation.
    { phase: "shot", effectClass: "LineageEffect.s_u017_b", host: "target", owner: "target", attach: "trail", rotation: "zero", speedRate: 1, associatedActors: "targetExcepted" }
];

export default effects;
