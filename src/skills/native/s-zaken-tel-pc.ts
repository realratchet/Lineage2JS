import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll 0x79f9ec..0x79faba: DesiredRotation * -radius*2/3, mode1; 0x79fa52/0x79fa56: explicit rate1; 0x7a12ee: caster host/owner.
    { phase: "casting", effectClass: "LineageEffect.e_u071_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius", speedRate: 1 },
    // 0x7ac1b7..0x7ac235: mode1, target host/owner, trailer1, speed-copy flag0; 0x7ac0e0 requires AssociatedActor.Num() != 0.
    { phase: "shot", effectClass: "LineageEffect.e_u071_b", host: "target", owner: "target", attach: "trail" }
];

export default effects;
