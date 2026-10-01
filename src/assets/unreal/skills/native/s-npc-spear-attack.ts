import type { NativeSkillEffect_T } from "../native-effects";

const effects: NativeSkillEffect_T[] = [
    // Engine.dll 0x7af576..0x7af5fc: center + height * 0.5, caster rotation/owner, projectile and SpeedRate=1; 0x7af60d..0x7af71e: item 2507 Mesh/Skins.
    { phase: "shot", effectClass: "LineageEffect.NSpear_sp", host: "caster", owner: "source", position: "center", heightOffset: 0.5, rotation: "caster", speedRate: 1, projectile: { target: "target" }, weaponId: 2507 }
];

export default effects;
