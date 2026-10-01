import type { NativeSkillEffect_T } from "../native-effects";
import sZakenSelfTel from "./s-zaken-self-tel";

// Engine.dll Init 0x79d205..0x79d2ee shares Return's emitter; 0x79d329..0x79d381: radius 30, ShotTime, color (0.3, 0.3, 0.9), mode 3, LE_Spotlight.
export const castingEffects: NativeSkillEffect_T[] = [
    { ...sZakenSelfTel[0], pawnLight: { color: [0.3, 0.3, 0.9], radius: 30, spot: true, target: "caster" } }
];

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Shot 0x7a880c..0x7a88eb: AssociatedActor loop; 0x7a8879 subtracts mesh Origin.Z; 0x7a8897 copies pawn Rotation; 0x7a88d5/0x7a88d7 pass no owner or trailer.
    { phase: "shot", effectClass: "LineageEffect.e_u005_a", host: "target", owner: "none", position: "meshOrigin", rotation: "target", associatedActors: "all" }
];

export default effects;
