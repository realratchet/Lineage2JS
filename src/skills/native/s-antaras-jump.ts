import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll 0x7a9c6b/0x7a9c7a/0x7a9c86: forward vector * float[0xab199c]=300, added to caster Location at 0x7a9c8f..0x7a9ca1.
// 0x7a9cb0..0x7a9cf3: target mesh height; 0x7a9cf1/0x7a9cf8: SpeedRate1; 0x7a9d35/0x7a9d36: caster owner, null host.
const effects: NativeSkillEffect_T[] = [
    { phase: "shot", effectClass: "LineageEffect.e_u043_a", host: "caster", rotation: "caster", forwardOffset: 300, height: "targetMeshOrigin", speedRate: 1 }
];

export default effects;
