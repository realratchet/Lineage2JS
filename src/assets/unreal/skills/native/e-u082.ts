import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x7a0dcf..0x7a0f89: named bones, then RelativeRotation/RelativeLocation stores.
    { phase: "casting", effectClass: "LineageEffect.e_u082_rainbow", host: "caster", bone: "dummy04", relativeRotation: [0, 16384, 0] },
    { phase: "casting", effectClass: "LineageEffect.e_u082_core", host: "caster", bone: "dummy05", relativeRotation: [0, 16384, 0], relativeLocation: [0, -5, 0] },
    // Engine.dll Shot 0x7ac923..0x7ac9ac: target feet/rotation, null host and owner.
    { phase: "shot", effectClass: "LineageEffect.e_u082_a", host: "target", owner: "none", rotation: "target" }
];

export default effects;
