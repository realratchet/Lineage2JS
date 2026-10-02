import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x79ed7e..0x79ee4c: DesiredRotation, negative two-thirds radius, caster trailer.
    // 0x79ed95/0x79edd3: negative X * radius * float[0xab0d1c]=2/3; class push 0x79ee47.
    { phase: "casting", effectClass: "LineageEffect.m_u009_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius" },
    // Engine.dll Shot 0x7ac778..0x7ac802: target host/owner, location mode 2.
    // 0x7ac6ac..0x7ac773: ordered nonnull list when bTargetExcepted; 0x7a653a/0x7ac807 retain caster for Shot sound even without targets.
    { phase: "shot", effectClass: "LineageEffect.m_u009_c", host: "target", owner: "target", attach: "trail", position: "center", associatedActors: "targetExcepted", soundWithoutEffect: true }
];

export default effects;
