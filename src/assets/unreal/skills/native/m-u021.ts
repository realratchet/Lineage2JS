import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll Init 0x79fabf -> 0x7a12f8; Shot 0x7ac606..0x7ac69f: target feet, null host, target owner.
// Init 0x79fad6: negative X; 0x79fb14 reads float[0xab0d1c]=2/3; 0x79fb88 selects m_u021_a.
const effects: NativeSkillEffect_T[] = [
    { phase: "casting", effectClass: "LineageEffect.m_u021_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius" },
    // Engine.dll 0x7ac52a..0x7ac606: bTargetExcepted selects nonnull list entries; even empty/null targets reach sound via 0x7a653a.
    { phase: "shot", effectClass: "LineageEffect.m_u021_b", host: "target", owner: "target", associatedActors: "targetExcepted", soundWithoutEffect: true }
];

export default effects;
