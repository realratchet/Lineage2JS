import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll Init 0x79f69b: DesiredRotation; negative X 0x79f6b2; radius * float[0xab0d1c]=2/3 at 0x79f6f0.
    // 0x79f701..0x79f705: supplied speed 1 and trailer; mode 1 at 0x79f748, class at 0x79f764; radius scale 0x79f6fb.
    { phase: "casting", effectClass: "LineageEffect.s_u016_a", host: "caster", attach: "trail", rotation: "desiredCaster", radiusOffset: -2 / 3, scale: "casterRadius", speedRate: 1 },
    // Shot 0x7aee51: bTargetExcepted list/primary split; target host/owner, zero rotation/offset, speed 1 at 0x7aef2b.
    // Mode 1 at 0x7aeee6/0x7aef7f replaces TrailerPrePivot.Z (SpawnSkillEffect 0x79841e..0x798443); class 0x7aeef3/0x7aef8c.
    { phase: "shot", effectClass: "LineageEffect.s_u016_b", host: "target", owner: "target", attach: "trail", rotation: "zero", speedRate: 1, associatedActors: "targetExcepted" }
];

export default effects;
