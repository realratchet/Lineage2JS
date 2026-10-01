import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll 0x7aa351..0x7aa35b, 0x7aa3da/0x7aa3db: non-self target host/owner; 0x7984f7..0x798523 copies its Location/Rotation.
    { phase: "shot", effectClass: "LineageEffect.e_u050_b", host: "target", position: "center", rotation: "target", owner: "target", targetIsCaster: false },
    // 0x7aa3fd/0x7aa474: caster Rotation * float[0xab18c0]=425; 0x7aa4d3..0x7aa4f9: target ground Z; 0x7aa50c..0x7aa518: zero rotation; 0x7aa558/0x7aa559: caster owner, null host.
    { phase: "shot", effectClass: "LineageEffect.e_u050_b", host: "caster", forwardOffset: 425, offsetRotation: "caster", height: "targetMeshOriginOrFeet", rotation: "zero", targetIsCaster: true }
];

export default effects;
