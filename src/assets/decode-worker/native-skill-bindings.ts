import type { NpcSkillEffectPhase_T } from "@l2js/engine/contracts/pawn";
import nativeSkillDispatch from "./native-skill-dispatch";

type NativeSkillBinding_T = { effects: string[], effectGroup?: string, soundPhases: NpcSkillEffectPhase_T[], finalShotOnly?: boolean, rejectTransient?: boolean, associatedActors?: boolean, pending?: string };

const nativeSkillBindings = new Map<string, NativeSkillBinding_T>([
    // Engine.dll OnReceiveMagicSkillUse 0x75086c; Init 0x7a16f9; Shot 0x7b0d96.
    ["balakas meteor storm", { effects: ["LineageEffect.e_u524_meteor", "LineageEffect.e_u524_a"], soundPhases: ["casting", "shot"], pending: "server LocLIst inputs and full retail visual/timing verification" }],
    // Engine.dll Init 0x79e8b8 -> 0x7a1bb6; Shot 0x7b0b7e..0x7b0e33.
    ["s_balakas_fear", { effects: ["LineageEffect.e_u802_fallback", "LineageEffect.e_u802_refract"], soundPhases: ["casting", "shot"], pending: "retail visual/timing and missing-Dummy05 branch verification" }],
    // Engine.dll SkillEffectShot 0x7ab397; Init exit 0x79e8b8.
    ["s_baium_normal attack", { effects: ["LineageEffect.e_u063_a"], soundPhases: ["casting", "shot"] }],
    // Engine.dll SkillEffectInit 0x79e975; Shot 0x7b0d8e.
    ["s_energy_wave", { effects: ["LineageEffect.e_u065_a"], soundPhases: ["casting", "shot"] }],
    // Engine.dll SkillEffectShot 0x7ab3af; class string 0xab1764.
    ["s_earth_quake", { effects: ["LineageEffect.e_u066_a"], soundPhases: ["shot"] }],
    // Engine.dll SkillEffectInit 0x79e90d; SkillEffectShot 0x7ab506.
    ["s_thunderbolt", { effects: ["LineageEffect.e_u064_cloud", "LineageEffect.e_u064_a"], soundPhases: ["casting", "shot"] }],
    // Engine.dll SkillEffectShot 0x7abbb4 / 0x7abd11.
    ["s_group_hold", { effects: ["LineageEffect.e_u067_hand", "LineageEffect.e_u067_a"], soundPhases: ["shot"] }]
]);

// Engine.dll Init 0x79f9ec; Shot 0x7ac0d5 requires AssociatedActor.Num(); primary target branch0x7ac1ab.
for (const name of ["s_zaken_tel_pc", "s_zaken_range_tel_pc"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.e_u071_a", "LineageEffect.e_u071_b"], soundPhases: ["casting", "shot"], associatedActors: true, pending: "retail visual/timing, secondary-target and teleport movement parity" });

// Engine.dll Init 0x79c74b; Shot 0x7a9104; Explosion 0x78f4aa; PreShot 0x7a3de7.
for (const name of ["s_mech_canon", "s_mech_canon8", "s_mech_canon9", "s_mech_canon10", "s_mech_canon11", "s_mech_canon12"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.e_u033_a", "LineageEffect.e_u033_b", "LineageEffect.e_u033_c"], soundPhases: ["shot", "explosion"], pending: "retail visual/timing, no-hit and ownerless impact verification" });

// Engine.dll Init 0x7a17a8, PreShot 0x7a43c0, Shot 0x7afa26, Explosion 0x7916c7.
// Boss selectors 0x7a2236/0x7a461f/0x7b15ee/0x791e2c; variants 0x7a16c7, 0x7a462c..0x7a462f, 0x7b1722..0x7b1725, 0x7916a5.
// NPC Stun Shot selects these same branches at 0x7a217a/0x7a45c8/0x7b14e1/0x791dbb.
for (const name of ["s_npc_bow_attack", "s_npc_bow_attack4", "s_npc_bow_attack6", "s_npc_bow_attack8", "s_npc_bow_attack9", "s_npc_stun_shot", "s_power_shot_boss_a_", "s_power_shot_boss_a_2b_1", "s_power_shot_boss_a_2c_1", "s_power_shot_boss_a_1b_1"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.s_u003_a", "LineageEffect.s_u003_d", "LineageEffect.s_u003_b", "LineageEffect.p_u004_a"], effectGroup: "bow", soundPhases: ["casting", "shot", "explosion"], pending: "full retail visual/timing verification" });

// Engine.dll Init 0x7a189e..0x7a18b4; PreShot 0x7a4632 -> 0x7a43c0; Shot 0x7b1728 -> 0x7af8cb; Explosion 0x7918c5..0x7918db.
nativeSkillBindings.set("s_stun_shot_boss_a_2c_1", { effects: ["LineageEffect.s_u505_a", "LineageEffect.s_u003_d", "LineageEffect.s_u505_b", "LineageEffect.s_u003_b", "LineageEffect.s_u505_c"], effectGroup: "bossStunShot", soundPhases: ["casting", "shot", "explosion"], pending: "retail visual/timing, no-hit and DamageEffect ordering verification" });

// Engine.dll Init 0x79e66c -> 0x7a1220; Shot 0x7a90f6 -> 0x7ae0ea.
for (const name of ["s_npc_thunder_storm", "s_npc_thunder_storm6", "s_npc_thunder_storm7", "s_npc_thunder_storm8", "s_npc_thunder_storm9", "s_npc_stun_attack", "s_npc_stun_attack6", "s_npc_stun_attack7", "s_npc_stun_attack8", "s_npc_stun_attack9", "s_npc_shield_stun"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.s_u010_a", "LineageEffect.p_u004_a"], soundPhases: ["casting", "shot"] });

// Engine.dll Init 0x7a1220; Shot 0x7ae49b requires FinalShot, 0x7ae847 joins 0x7ae411.
for (const name of ["s_npc_blow", "s_npc_blow3", "s_npc_blow4", "s_npc_blow5", "s_npc_blow6", "s_npc_blow7", "s_npc_blow8", "s_npc_blow9", "s_orphen_strike", "s_orphen_dispel"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.s_u010_a", "LineageEffect.p_u004_a"], soundPhases: ["casting", "shot"], finalShotOnly: true });

// Engine.dll Init 0x7a1220; Shot 0x7a95ec -> 0x7b0e38 returns without a hit effect.
for (const name of ["s_npc_bleed", "s_npc_bleed4"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.s_u010_a"], soundPhases: ["casting"] });

// Engine.dll Init 0x79eabf -> 0x79f4c1; Shot 0x7abd47 -> 0x7ae996; FNPawnLight 0x79f5bc.
for (const name of ["s_npc_aura_burn", "s_npc_aura_burn9", "s_npc_aura_burn_magic_only", "s_npc_aura_burn_magic_only2", "s_npc_aura_burn_magic_only3", "s_npc_aura_burn_magic_only4", "s_npc_aura_burn_magic_only5", "s_npc_aura_burn_magic_only6", "s_npc_aura_burn_magic_only7", "s_npc_aura_burn_magic_only8", "s_npc_aura_burn_magic_only9", "s_npc_aura_burn_magic_only10"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u019_a", "LineageEffect.m_u019_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing verification" });

// Engine.dll SkillEffectInit 0x79dbbc -> 0x79eaa8 returns; SkillEffectShot 0x7abe73 -> 0x7ae996.
for (const name of ["s_aura_burn_boss_a_", "s_aura_burn_boss_a_3", "s_aura_burn_boss_a_5", "s_aura_burn_boss_a_8", "s_aura_burn_boss_a_10"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u019_b"], soundPhases: ["shot"], pending: "retail visual/timing, target ownership and individual NPC verification" });

// Engine.dll SkillEffectInit 0x79dbbc -> 0x79eaa8 returns; SkillEffectShot 0x7abe73 selector 7 -> 0x7ac6ac pushes m_u009_c.
for (const name of [
    "s_self_range_poison_boss_a_", "s_self_range_poison_boss_a_3", "s_self_range_poison_boss_a_4", "s_self_range_poison_boss_a_5", "s_self_range_poison_boss_a_6",
    "s_self_range_weakness_boss_a_", "s_self_range_weakness_boss_a_2", "s_self_range_weakness_boss_a_5", "s_self_range_weakness_boss_a_7", "s_self_range_weakness_boss_a_8",
    "s_self_range_slow_boss_a_", "s_self_range_slow_boss_a_2", "s_self_range_slow_boss_a_3", "s_self_range_slow_boss_a_4", "s_self_range_slow_boss_a_5", "s_self_range_slow_boss_a_8", "s_self_range_slow_boss_a_10",
    "s_self_range_paralyze_boss_a_", "s_self_range_paralyze_boss_a_4", "s_self_range_paralyze_boss_a_6", "s_self_range_paralyze_boss_a_7", "s_self_range_paralyze_boss_a_10",
    "s_self_range_aura_sink_boss_a_", "s_self_range_aura_sink_boss_a_3", "s_self_range_aura_sink_boss_a_5", "s_self_range_aura_sink_boss_a_6", "s_self_range_aura_sink_boss_a_7", "s_self_range_aura_sink_boss_a_8", "s_self_range_aura_sink_boss_a_10"
])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u009_c"], soundPhases: ["casting", "shot"], pending: "retail visual/timing and individual NPC verification" });

// Engine.dll Init table 0x7a20ac -> 0x79f4c1; Shot table 0x7b13b4 -> 0x7ae996; PreShot 0x7a40b9 returns.
for (const name of ["s_npc_burn", "s_npc_burn7", "s_npc_burn8", "s_npc_burn9"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u019_a", "LineageEffect.m_u019_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, multi-target and individual suffix verification" });

// Engine.dll Init 0x79f5c8; Shot 0x7b0749 -> 0x7b0811 -> 0x7a9753.
// Boss Init selectors 0x7a2220/0x7a2230=16; Shot selectors 0x7b15d8/0x7b15e8=9.
for (const name of ["s_npc_sleep", "s_npc_sleep3", "s_npc_sleep4", "s_npc_sleep5", "s_npc_sleep6", "s_npc_sleep7", "s_npc_sleep9", "s_self_range_sleep_boss_a_", "s_self_range_sleep_boss_a_2", "s_self_range_sleep_boss_a_3", "s_self_range_sleep_boss_a_5", "s_self_range_sleep_boss_a_6", "s_self_range_sleep_boss_a_8", "s_sleep_boss_a_7", "s_sleep_boss_a_9"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u018_a", "LineageEffect.m_u018_b"], soundPhases: ["casting", "shot"] });

// Engine.dll Init 0x79fd84; Shot 0x7af786 -> 0x7af84c -> 0x7ac0c6.
for (const name of ["s_npc_hold", "s_npc_hold5", "s_npc_hold6", "s_npc_hold7", "s_range_hold_boss_a_", "s_range_hold_boss_a_2", "s_range_hold_boss_a_3", "s_range_hold_boss_a_4", "s_range_hold_boss_a_5", "s_range_hold_boss_a_6", "s_range_hold_boss_a_7", "s_range_hold_boss_a_9", "s_range_hold_boss_a_10"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u013_a", "LineageEffect.m_u013_c"], soundPhases: ["casting", "shot"] });

// Engine.dll Init selector 0x7a20d1 -> 0x79ed7e; Shot slot 0x7b13c8 -> 0x7ac6ac.
// Boss Init selectors 0x7a221f/0x7a222f=15; Shot selectors 0x7b15d7/0x7b15e7=8.
for (const name of ["s_npc_shackle", "s_npc_shackle5", "s_self_range_wind_shackle_boss_a_", "s_self_range_wind_shackle_boss_a_3", "s_self_range_wind_shackle_boss_a_5", "s_self_range_wind_shackle_boss_a_7", "s_self_range_wind_shackle_boss_a_9", "s_wind_shackle_boss_a_", "s_wind_shackle_boss_a_3", "s_wind_shackle_boss_a_4", "s_wind_shackle_boss_a_9"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u009_a", "LineageEffect.m_u009_c"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, multi-target and individual NPC verification" });

// Engine.dll Init 0x7a0dcf; Shot selector 0x7b1659 -> 0x7ac923; PreShot 0x7a43ac returns.
nativeSkillBindings.set("s_holy_light_burst_boss_a", { effects: ["LineageEffect.e_u082_rainbow", "LineageEffect.e_u082_core", "LineageEffect.e_u082_a"], soundPhases: ["casting", "shot"], pending: "retail visual/timing and named-bone attachment verification" });

// Engine.dll Init 0x7a0fd0..0x7a121b; Shot selector0x7b165a=38 ->0x7ac895; PreShot0x7a43ac and Explosion0x79094f return.
nativeSkillBindings.set("s_evil_shackle_boss_a", { effects: ["LineageEffect.e_u504_a", "LineageEffect.e_u504_rh", "LineageEffect.e_u504_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, hand attachment and target reaction verification" });

// Engine.dll Init selectors 0x7a2221/0x7a2231 and Shot selectors 0x7b15d9/0x7b15e9 share Hold.
for (const name of ["s_self_range_hold_boss_a_", "s_self_range_hold_boss_a_3", "s_self_range_hold_boss_a_4", "s_hold_boss_a_", "s_hold_boss_a_3", "s_hold_boss_a_6", "s_hold_boss_a_8"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u013_a", "LineageEffect.m_u013_c"], soundPhases: ["casting", "shot"], pending: "multi-target, retail visual/timing and individual NPC verification" });

// Engine.dll Init 0x79f9d0 -> 0x79fd84; Shot 0x7abe73 -> 0x7af786; PreShot bound 0x7a40b4 returns.
nativeSkillBindings.set("s_zaken_hold", { effects: ["LineageEffect.m_u013_a", "LineageEffect.m_u013_c"], soundPhases: ["casting", "shot"], pending: "retail visual/timing and multi-target verification" });

// Engine.dll Init 0x7a228f -> 0x7a131a; Shot 0x7b15f9 -> 0x7afafb; PreShot 0x7a40b4 and Explosion 0x791e37 return.
nativeSkillBindings.set("s_zaken_drain", { effects: ["LineageEffect.m_u003_a", "LineageEffect.m_u003_c", "LineageEffect.m_u003_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing and secondary-target verification" });

// Engine.dll Init 0x7a2291 -> 0x7a1220; Shot 0x7b15fb -> 0x7ae0ea; PreShot 0x7a40b4 and Explosion 0x791e39 return.
nativeSkillBindings.set("s_zaken_dual_attack", { effects: ["LineageEffect.s_u010_a", "LineageEffect.p_u004_a"], effectGroup: "zakenDualAttack", soundPhases: ["casting", "shot"], pending: "retail visual/timing, target reactions and secondary-target verification" });

// Engine.dll Init 0x7a2292 -> 0x7a1220; Shot 0x7b15fc -> 0x7b0e38; PreShot 0x7a40b4 and Explosion 0x791e3a return.
nativeSkillBindings.set("s_zaken_range_dual_attack", { effects: ["LineageEffect.s_u010_a"], soundPhases: ["casting"], pending: "retail visual/timing and target reaction verification" });

// Engine.dll Init 0x7a2293 -> 0x79ddae; Shot 0x7b15fd -> 0x7abe91; PreShot 0x7a40b4 and Explosion 0x791e3b return.
nativeSkillBindings.set("s_zaken_self_tel", { effects: ["LineageEffect.e_u031_a", "LineageEffect.e_u005_a"], effectGroup: "zakenSelfTel", soundPhases: ["casting", "shot"], pending: "retail visual/timing verification; preview does not teleport the caster" });

// Engine.dll Init selector0x7a22a3=12 ->0x7a0b7e; Shot0x7b160d=33 ->0x7af286; PreShot0x7a43ac and Explosion0x791e4b=8 return.
nativeSkillBindings.set("s_dietrich_suspension", { effects: ["LineageEffect.m_u025_a", "LineageEffect.m_u025_b", "LineageEffect.m_u025_c"], soundPhases: ["casting", "shot"], pending: "retail visual/timing and secondary-target verification" });

// Engine.dll Init0x7a22a1=10 ->0x7a0915; Shot0x7b160b=32 ->0x7ade48; Explosion0x791e49=5 ->0x7905eb; PreShot0x7a43ac returns.
nativeSkillBindings.set("s_gustav_wind", { effects: ["LineageEffect.m_u038_a", "LineageEffect.m_u038_b", "LineageEffect.m_u038_c", "LineageEffect.m_u038_d"], soundPhases: ["casting", "shot", "explosion"], pending: "retail visual/timing and target reaction verification" });
// Engine.dll Init 0x7a229b=18 -> return; Shot 0x7b1605=28 -> 0x7acf2a; Explosion 0x791e43=3 -> 0x7907ac.
nativeSkillBindings.set("s_wild_cannon", { effects: ["LineageEffect.e_u073_a", "LineageEffect.e_u073_b", "LineageEffect.e_u073_ground"], soundPhases: ["shot", "explosion"], pending: "Mover-target door impact, nullable targets and retail visual/timing verification" });

// Engine.dll Init table 0x7a2130 -> 0x79f5c8; Shot table 0x7b14bc -> 0x7b0749.
for (const name of ["s_npc_silence", "s_npc_silence6", "s_npc_silence7", "s_npc_silence8", "s_npc_silence9", "s_npc_berserker", "s_npc_berserker2", "s_npc_surrender_to_fire", "s_npc_surrender_to_fire2"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u018_a", "LineageEffect.m_u018_b"], soundPhases: ["casting", "shot"] });

// Engine.dll Init 0x7a1ce1=1 -> 0x79f5c8; Shot 0x7b0fb9=14 -> 0x7b0749; PreShot 0x7a3e0b and Explosion 0x791bd0=4 return.
for (const name of ["s_hex10", "s_hex11", "s_hex12"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u018_a", "LineageEffect.m_u018_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing and secondary-target verification" });

// Engine.dll Init 0x79ebae with FNPawnLight 0x79ed26; Shot 0x7ac39f.
// Boss Init selectors 0x7a222e/0x7a2232/0x7a2234/0x7a2235=19; Shot 0x7b15e6/0x7b15ea/0x7b15ec/0x7b15ed=17.
for (const name of ["s_npc_slow", "s_npc_slow2", "s_npc_slow3", "s_single_poison", "s_single_poison6", "s_single_poison7", "s_single_poison8", "s_single_poison9", "s_poison_boss_a_", "s_weakness_boss_a_", "s_weakness_boss_a_5", "s_weakness_boss_a_7", "s_weakness_boss_a_9", "s_slow_boss_a_", "s_slow_boss_a_3", "s_slow_boss_a_5", "s_slow_boss_a_7", "s_slow_boss_a_9", "s_paralyze_boss_a_", "s_paralyze_boss_a_6", "s_paralyze_boss_a_8", "s_aura_sink_boss_a_7"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u007_a", "LineageEffect.m_u007_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing verification" });

// Engine.dll Init selector 0x7a2177 -> 0x79ebae; Shot selector 0x7b14de -> 0x7ac39f.
for (const name of ["s_npc_paralyze", "s_npc_paralyze3", "s_npc_paralyze4", "s_npc_paralyze5", "s_npc_paralyze6", "s_npc_paralyze7", "s_npc_paralyze8", "s_npc_paralyze9"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u007_a", "LineageEffect.m_u007_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, status reaction, multi-target and individual NPC verification" });

// Engine.dll Init 0x79fabf; Shot 0x7ac52a; PreShot 0x7a43a4 and Explosion 0x791ade return.
// Range Paralyze: 0x7a2178=15, 0x7b14df=17; Range Poison: 0x7a20cf=14, Shot pointer 0x7b13c0.
for (const name of ["s_npc_range_paralyze", "s_summon_range_poison", "s_summon_range_poison8", "s_summon_range_poison9", "s_summon_range_poison10", "s_summon_range_poison11", "s_summon_range_poison12", "s_range_poison", "s_range_poison6", "s_range_poison9"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u021_a", "LineageEffect.m_u021_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, multi-target and individual NPC verification" });

// Engine.dll Init 0x7a20d0=15 -> 0x79e58b; Shot pointer 0x7b13c4 -> 0x7a8fa4 -> 0x7ac4e0.
for (const name of ["s_npc_weakness", "s_npc_weakness2"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u007_a", "LineageEffect.m_u007_b"], effectGroup: "npcWeakness", soundPhases: ["casting", "shot"], pending: "retail visual/timing, multi-target and individual NPC verification" });

// Engine.dll Init 0x79fbde; Shot 0x7ad619 / 0x7ad71e -> 0x7ac0c6.
for (const name of ["s_npc_hydro_blast_magic_only", "s_npc_hydro_blast_magic_only2", "s_npc_hydro_blast_magic_only3", "s_npc_hydro_blast_magic_only4", "s_npc_hydro_blast_magic_only5", "s_npc_hydro_blast_magic_only6", "s_npc_hydro_blast_magic_only7", "s_npc_hydro_blast_magic_only8", "s_npc_hydro_blast_magic_only9", "s_npc_hydro_blast_magic_only10", "s_npc_hydro_blast", "s_npc_hydro_blast8", "s_npc_hydro_blast9", "s_npc_hydro_blast10", "s_npc_hydro_blast11", "s_npc_hydro_blast12"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u033_a", "LineageEffect.m_u033_b"], soundPhases: ["casting", "shot"], pending: "full retail visual and timing parity" });

// Engine.dll Init 0x79e2b7 -> 0x7a131a; Shot 0x7a8bba / 0x7abe73 -> 0x7afafb.
// Boss Vampiric Touch: Init selector 0x7a2227=3 -> 0x7a131a; Shot selector 0x7b15df=13 -> 0x7afafb.
// Boss Life Drain: Init selector 0x7a2228=3; Shot selector 0x7b15e0=13.
for (const name of ["s_blood_sucking", "s_blood_sucking4", "s_blood_sucking7", "s_blood_sucking8", "s_blood_sucking9", "s_summon_blood_sucking", "s_summon_blood_sucking8", "s_summon_blood_sucking9", "s_summon_blood_sucking10", "s_summon_blood_sucking11", "s_summon_blood_sucking12", "s_vampiric_touch_boss_a_", "s_vampiric_touch_boss_a_2", "s_vampiric_touch_boss_a_3", "s_vampiric_touch_boss_a_5", "s_vampiric_touch_boss_a_6", "s_vampiric_touch_boss_a_7", "s_vampiric_touch_boss_a_8", "s_life_drain_boss_a_", "s_life_drain_boss_a_7", "s_life_drain_boss_a_9"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u003_a", "LineageEffect.m_u003_c", "LineageEffect.m_u003_b"], soundPhases: ["casting", "shot"], pending: "retail return-path and full visual/timing verification" });

// Engine.dll Init 0x7a0fa4..0x7a0fb4 -> 0x7a13ed; Shot selectors 0x7b169d/0x7b169e -> 0x7b0002.
for (const name of ["s_range_80_hp_drain9", "s_range_80_hp_drain_magic_only7"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.s_u019_a", "LineageEffect.s_u019_b", "LineageEffect.s_u019_c"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, secondary targets and individual NPC verification" });

// Engine.dll Shot 0x7afafb selects m_u003_c and m_u003_b for the drain variants.
for (const name of ["s_blood_sucking_magic_only", "s_blood_sucking_magic_only7", "s_blood_sucking_for_slow", "s_npc_bleed_drain6", "s_npc_bleed_drain7", "s_npc_bleed_drain9", "s_npc_bleed_drain_magic_only6", "s_npc_bleed_drain_magic_only7", "s_npc_bleed_drain_magic_only9", "s_npc_100_hp_drain6", "s_npc_100_hp_drain7", "s_npc_100_hp_drain_magic_only9"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u003_a", "LineageEffect.m_u003_c", "LineageEffect.m_u003_b"], soundPhases: ["casting", "shot"], pending: "retail return-path and full visual/timing verification" });

// Engine.dll Init 0x7a2201=3 -> 0x7a131a; Shot table 0x7b1504 -> 0x7afafb.
nativeSkillBindings.set("s_mana_sucking_magic_only", { effects: ["LineageEffect.m_u003_a", "LineageEffect.m_u003_c", "LineageEffect.m_u003_b"], soundPhases: ["casting", "shot"], pending: "retail return-path, visual/timing and individual NPC verification" });

// Engine.dll Init 0x7a22e0/0x7a22e1=1 -> 0x7a131a; Shot 0x7b16c1/0x7b16c2=3 -> 0x7af786.
for (const name of ["s_npc_hold_drain6", "s_npc_hold_drain7", "s_npc_hold_drain9", "s_npc_hold_drain_magic_only6", "s_npc_hold_drain_magic_only7"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u003_a", "LineageEffect.m_u013_c"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, multi-target and individual NPC verification" });

// Engine.dll Init 0x7a20d2 -> 0x7a131a; Shot 0x7a87b2 -> 0x7afafb; PreShot 0x7a40b9 returns.
nativeSkillBindings.set("s_mana_sucking", { effects: ["LineageEffect.m_u003_a", "LineageEffect.m_u003_c", "LineageEffect.m_u003_b"], soundPhases: ["casting", "shot"], pending: "retail return-path, visual/timing and individual NPC verification" });

// Engine.dll Init selector 0x7a2144 -> 0x7a06db; Shot selector 0x7b142a -> 0x7adcef; Explosion 0x79042a.
// Boss Twister: Init 0x7a222a=5, Shot 0x7b15e2=15, Explosion 0x791e06=7; PreShot 0x7a4613=1 returns.
for (const name of ["s_npc_twister", "s_npc_twister9", "s_npc_twister_for_slow", "s_twister_boss_a_", "s_twister_boss_a_3", "s_twister_boss_a_4", "s_twister_boss_a_5", "s_twister_boss_a_6", "s_twister_boss_a_7", "s_twister_boss_a_9"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u026_a", "LineageEffect.m_u026_b", "LineageEffect.m_u026_c", "LineageEffect.m_u026_d"], soundPhases: ["casting", "shot", "explosion"], pending: "retail visual/timing, no-hit-actor, collision and individual NPC verification" });

for (const name of ["s_npc_twister_magic_only", "s_npc_twister_magic_only6", "s_npc_twister_magic_only7", "s_npc_twister_magic_only9"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u026_a", "LineageEffect.m_u026_b", "LineageEffect.m_u026_c", "LineageEffect.m_u026_d"], soundPhases: ["casting", "shot", "explosion"], pending: "retail visual/timing, no-hit-actor, collision and individual NPC verification" });

// Engine.dll Shot 0x7b0e38 and Explosion 0x791ade return without a spawned effect.
nativeSkillBindings.set("s_antaras_fear", { effects: [], soundPhases: ["shot"], pending: "native status/view behavior and full retail parity" });

// Engine.dll APawn::SkillEffectShot 0x7a9bc8.
nativeSkillBindings.set("s_antaras_jump", { effects: ["LineageEffect.e_u043_a"], soundPhases: ["shot"] });

// Engine.dll APawn::SkillEffectShot 0x7a9f87.
nativeSkillBindings.set("s_antaras_tail", { effects: ["LineageEffect.e_u051_a"], soundPhases: ["shot"] });

// Engine.dll APawn::SkillEffectShot 0x7aa34b.
nativeSkillBindings.set("s_antaras_debuff", { effects: ["LineageEffect.e_u050_b"], soundPhases: ["shot"] });

// Engine.dll APawn::SkillEffectShot 0x7aacc7.
nativeSkillBindings.set("s_antaras_mouth", { effects: ["LineageEffect.e_u044_b"], soundPhases: ["shot"] });

// Engine.dll APawn::SkillEffectShot 0x7aa56c.
nativeSkillBindings.set("s_antaras_normal_attack", { effects: ["LineageEffect.e_u049_a"], soundPhases: ["shot"] });

// Engine.dll APawn::SkillEffectInit spawn 0x79e829; SkillEffectShot 0x7ab0e5.
nativeSkillBindings.set("s_antaras_breath", { effects: ["LineageEffect.e_u046_a", "LineageEffect.e_u046_b", "LineageEffect.e_u046_c"], soundPhases: ["casting", "shot", "explosion"] });

// Engine.dll Shot 0x7aaa61..0x7aaa71 spawns e_u049_a from the left-hand branch.
nativeSkillBindings.set("s_antaras_normal_attack_ex", { effects: ["LineageEffect.e_u049_a"], effectGroup: "antarasNormalAttackEx", soundPhases: [], pending: "native view/event behavior and full retail parity" });

// Engine.dll Init selectors 0x7a216a/0x7a2223 -> 0x79f2ca; Shot 0x7ac244: shared Chill Flame/bleed recipe.
for (const name of ["s_npc_chill_flame", "s_npc_chill_flame6", "s_self_range_bleed_boss_a_", "s_self_range_bleed_boss_a_2", "s_self_range_bleed_boss_a_3", "s_self_range_bleed_boss_a_5", "s_self_range_bleed_boss_a_7", "s_self_range_bleed_boss_a_8", "s_self_range_bleed_boss_a_9", "s_self_range_bleed_boss_a_10"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u027_a", "LineageEffect.m_u027_b"], soundPhases: ["casting", "shot", "explosion"], pending: "retail visual/timing and secondary target-list parity" });

// Engine.dll Init 0x7a229d -> 0x7a025d; Shot 0x7b1607 -> 0x7acb51 -> 0x7ac0b6.
for (const name of ["s_npc_strike_range", "s_npc_strike_range6", "s_npc_strike_range7"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.e_u057_a", "LineageEffect.e_u057_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing and individual NPC verification" });

// Engine.dll Init 0x7a0558; Shot 0x7adbab requires FinalShot; Explosion 0x78f351/0x790963.
for (const name of ["s_mega_storm_strike", "s_summon_mega_storm_strike8", "s_summon_mega_storm_strike9", "s_summon_mega_storm_strike10", "s_summon_mega_storm_strike11", "s_summon_mega_storm_strike12"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u000_a", "LineageEffect.m_u000_b", "LineageEffect.m_u000_c", "LineageEffect.m_u000_d"], soundPhases: ["casting", "shot", "explosion"], finalShotOnly: true, pending: "retail visual/timing, low-frame-rate ordering and collision parity; individual summon variants" });

// Engine.dll Init 0x79c74b; Shot 0x7a9288..0x7a95dd; PreShot 0x7a3de7.
nativeSkillBindings.set("s_siege_hammer", { effects: ["LineageEffect.p_u004_a"], effectGroup: "siegeHammer", soundPhases: [], pending: "owner-conditioned native view shake, retail visual/timing and individual NPC verification" });

// Engine.dll Init 0x79ff2a; Shot 0x7ada66 / 0x7adb2c; PreShot 0x7a40b9 / 0x7a459a -> 0x7a3de7.
for (const name of ["s_self_haste", "s_self_haste2", "s_clan_might", "s_clan_might3", "s_self_range_might_boss_a_", "s_self_range_might_boss_a_2", "s_self_range_might_boss_a_4", "s_self_range_might_boss_a_6", "s_self_range_might_boss_a_9"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u004_a", "LineageEffect.m_u004_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, multi-target and individual NPC verification" });

// Engine.dll Init selectors 0x7a228a/0x7a228b=2 -> 0x79fe57; Shot 0x7b15f4/0x7b15f5=2 -> 0x7ad91b.
for (const name of ["s_self_range_haste_boss_a_", "s_self_range_haste_boss_a_1", "s_self_range_haste_boss_a_3", "s_self_range_haste_boss_a_4", "s_self_range_haste_boss_a_5", "s_self_range_haste_boss_a_7", "s_self_range_haste_boss_a_9", "s_self_range_reflect_damage_boss_a_"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u036_a", "LineageEffect.m_u036_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, multi-target and individual NPC verification" });

// Engine.dll Init 0x79e67a; Shot 0x7a95fa; PreShot 0x7a40b9 and Explosion 0x78f3f8 return.
for (const name of ["s_self_might", "s_self_might3", "s_self_shield", "s_self_shield3"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.s_u005_a", "LineageEffect.s_u005_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, multi-target and individual NPC verification" });

// Engine.dll Init 0x79f3ee; Shot 0x7ae84c; PreShot 0x7a45ae -> 0x7a3de7 returns.
for (const name of ["s_npc_cancel", "s_npc_cancel5", "s_npc_cancel6", "s_npc_cancel7"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u016_a", "LineageEffect.m_u016_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, multi-target and individual suffix verification" });

// Engine.dll Init 0x7a02f2; Shot 0x7ac80f requires FinalShot; Explosion 0x790a86.
for (const name of ["s_npc_blaze", "s_npc_blaze5", "s_npc_blaze_magic_only", "s_npc_blaze_magic_only3", "s_npc_blaze_magic_only4", "s_npc_blaze_magic_only5", "s_npc_blaze_magic_only6", "s_npc_blaze_magic_only7", "s_npc_blaze_magic_only8", "s_npc_blaze_magic_only9", "s_npc_blaze_for_slow", "s_nurka_fire", "s_npc_prominence", "s_npc_prominence9", "s_npc_prominence_magic_only", "s_npc_prominence_magic_only6", "s_npc_prominence_magic_only7", "s_npc_prominence_magic_only8", "s_npc_prominence_magic_only9", "s_npc_prominence_for_slow"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u006_a", "LineageEffect.m_u006_b", "LineageEffect.m_u006_c", "LineageEffect.m_u006_e"], soundPhases: ["casting", "shot", "explosion"], finalShotOnly: true, pending: "retail visual/timing, no-hit-actor and collision verification; individual suffix variants" });

// Engine.dll Init 0x7a02f2; Shot 0x7ac80f; Explosion 0x78f3fe -> 0x791295.
for (const name of ["s_npc_flame_strike", "s_npc_flame_strike7", "s_npc_flame_strike9", "s_npc_flame_strike_for_slow"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u006_a", "LineageEffect.m_u006_b", "LineageEffect.m_u006_c", "LineageEffect.m_u006_e", "LineageEffect.m_u006_d"], effectGroup: "flameStrike", soundPhases: ["casting", "shot", "explosion"], finalShotOnly: true, pending: "retail visual/timing, secondary targets, no-hit-actor and collision verification; individual NPC variants" });

// Engine.dll Init 0x7a131a; Shot 0x7a99b2..0x7a9bc5; PreShot returns at 0x7a3de7.
for (const name of ["s_npc_corpse_burst", "s_npc_corpse_burst6", "s_npc_corpse_burst7", "s_npc_corpse_burst8", "s_npc_corpse_burst9", "s_npc_corpse_burst10", "s_npc_corpse_burst11", "s_npc_corpse_burst12"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u003_a", "LineageEffect.m_u006_e", "LineageEffect.m_u006_d"], effectGroup: "corpseBurst", soundPhases: ["casting", "shot"], pending: "retail visual/timing, secondary targets, corpse targeting and individual suffix verification" });

// Engine.dll Init 0x79e483; Shot 0x7a8ef6; PreShot 0x7a40b9 returns.
nativeSkillBindings.set("s_cat_recharge", { effects: ["LineageEffect.m_u022_a", "LineageEffect.m_u022_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing and individual NPC verification" });

// Engine.dll Init 0x7a20bf/0x7a20c3 -> 0x79e3b0; Shot 0x7b1384/0x7b1394 -> 0x7a8d21; PreShot/Explosion return via 0x7a3de7/0x791ade.
nativeSkillBindings.set("s_heal_queen_ant", { effects: ["LineageEffect.m_u001_a", "LineageEffect.m_u001_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing and secondary-target verification" });

// Engine.dll Init 0x7a20bc -> 0x7a1220; Shot 0x7a8bc3 returns; PreShot/Explosion return via 0x7a3de7/0x791ade.
nativeSkillBindings.set("s_queen_ant_brandish", { effects: ["LineageEffect.s_u010_a"], soundPhases: ["casting"], pending: "retail visual/timing verification" });

// Engine.dll Init 0x7a20bd -> 0x79c74b; Shot 0x7a8bc9; Explosion 0x78f351 -> 0x790963; PreShot returns at 0x7a3de7.
nativeSkillBindings.set("s_queen_ant_strike", { effects: ["LineageEffect.m_u000_c", "LineageEffect.m_u000_d"], effectGroup: "queenAntStrike", soundPhases: ["shot", "explosion"], pending: "retail visual/timing and target reaction verification" });

// Engine.dll Init 0x7a20be -> 0x79c74b; Shot 0x7a87d4 -> 0x7ac52a; PreShot/Explosion return via 0x7a3de7/0x791ade.
nativeSkillBindings.set("s_queen_ant_sprinkle", { effects: ["LineageEffect.m_u021_b"], soundPhases: ["shot"], pending: "retail visual/timing and secondary-target verification" });

// Engine.dll Init 0x7a2208/0x7a21b0 -> 0x79f1cc; Shot slot 0x7b1520 -> 0x7abd5c; PreShot/Explosion return via 0x7a3de7/0x791ade.
nativeSkillBindings.set("s_teleport_pc", { effects: ["LineageEffect.e_u031_a", "LineageEffect.e_u005_a"], soundPhases: ["casting", "shot"], pending: "retail visual/timing verification; preview does not teleport the target" });

// Engine.dll Init slot 0x7a1df0 -> 0x79e483; Shot slot 0x7b10d0 -> 0x7a8ef6; PreShot/Explosion return via 0x7a3de7/0x791ade.
for (const name of ["s_recharge121", "s_recharge131", "s_recharge141"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u022_a", "LineageEffect.m_u022_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing verification" });

// Engine.dll Init selector 0x7a1e5d -> 0x79e02a; Shot selector 0x7b113e -> 0x7a8626; PreShot/Explosion return via 0x7a3de7/0x791ade.
nativeSkillBindings.set("s_regeneration3", { effects: ["LineageEffect.m_u014_a", "LineageEffect.m_u014_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing and secondary-target verification" });

// Engine.dll Init 0x7a1f8d -> 0x79e0fd; Shot 0x7b1249 -> 0x7a84c7; PreShot/Explosion return via 0x7a3de7/0x791ade.
nativeSkillBindings.set("s_wind_walk2", { effects: ["LineageEffect.m_u010_a", "LineageEffect.m_u010_c"], soundPhases: ["casting", "shot"], pending: "retail visual/timing and secondary-target verification" });

// Engine.dll Init 0x7a1f8f/0x7a1f04 -> 0x79ed7e; Shot 0x7b124b/0x7b11ec -> 0x7ac6ac; PreShot/Explosion return at 0x7a3de7/0x791ade.
for (const name of ["s_breeze14", "s_breeze15", "s_breeze16"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u009_a", "LineageEffect.m_u009_c"], soundPhases: ["casting", "shot"], pending: "retail visual/timing and secondary-target verification" });

// Engine.dll Init 0x7a1f61/0x7a1fc8 -> 0x79ebae; Shot 0x7b121d/0x7b12ea -> 0x7ac39f; PreShot/Explosion return via 0x7a3de7/0x791ade.
for (const name of ["s_slow10", "s_slow11", "s_slow12", "s_curse_gloom8", "s_curse_gloom9", "s_curse_gloom10"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u007_a", "LineageEffect.m_u007_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing and secondary-target verification" });

// Engine.dll Init 0x7a1f9a/0x7a1f10 -> 0x79cbf6; Shot 0x7b1256/0x7b11f8 -> 0x7a6e34; PreShot/Explosion return at 0x7a3de7/0x791ade.
for (const name of ["s_greater_heal101", "s_greater_heal111", "s_greater_heal121"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u032_a", "LineageEffect.m_u032_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing and secondary-target verification" });

// Engine.dll Init 0x7a1fb1/0x7a1fcd -> 0x79fe57; Shot 0x7a6de5/0x7b12ef -> 0x7ad91b; Explosion 0x791cfe/0x791d1a -> 0x791ade.
for (const name of ["s_guidance3", "s_vampiric_rage3"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u036_a", "LineageEffect.m_u036_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing and secondary-target verification" });

// Engine.dll Init 0x7a217e/0x7a0fca -> 0x7a1220; Shot 0x7b14e5/0x7abe6d -> 0x7af576; Explosion 0x791dbf/0x790941 -> 0x7916c7.
for (const name of ["s_npc_spear_attack", "s_npc_spear_attack3", "s_power_shot_boss_a_2_"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.s_u010_a", "LineageEffect.NSpear_sp", "LineageEffect.p_u004_a"], effectGroup: "spear", soundPhases: ["casting", "shot", "explosion"], pending: "retail visual/timing and individual NPC verification" });

// Engine.dll SkillEffectShot 0x7a99b2 pushes m_u006_e and m_u006_d for skill 4132.
nativeSkillBindings.set("s_rapid_spear_attack", { effects: ["LineageEffect.m_u006_e", "LineageEffect.m_u006_d"], effectGroup: "rapidSpear", soundPhases: ["casting", "shot"], pending: "native shot placement and timing parity" });

// Engine.dll SkillEffectShot 0x7ae49b for skill 4244 loads LineageEffect.p_u004_a.
for (const name of ["s_npc_wild_sweep", "s_npc_wild_sweep3", "s_npc_wild_sweep4", "s_npc_wild_sweep6", "s_npc_wild_sweep7"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.p_u004_a"], effectGroup: "wildSweep", soundPhases: ["shot"] });

// Engine.dll SkillEffectShot 0x7ae073 selects p_u004_a for skill 4228.
nativeSkillBindings.set("s_double_dagger_attack", { effects: ["LineageEffect.p_u004_a"], effectGroup: "wildSweep", soundPhases: ["casting"], pending: "native shot placement and timing parity" });

// Engine.dll Init 0x79f23b; Shot 0x7ac9b1; Explosion 0x7900fe.
for (const name of ["s_npc_wind_of_hand", "s_npc_wind_of_hand4", "s_npc_wind_of_hand9", "s_npc_fast_wind_of_hand6", "s_npc_fast_wind_of_hand7"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.e_u058_r", "LineageEffect.e_u058_a", "LineageEffect.e_u058_b"], soundPhases: ["casting", "shot", "explosion"], pending: "retail visual/timing, impact light and no-hit-actor parity" });

// Engine.dll Init 0x79fffd; Shot selector 0x7b15cc[56]=27 -> 0x7ac9b1.
for (const name of ["s_npc_double_wind_of_hand", "s_npc_double_wind_of_hand9"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.e_u058_r", "LineageEffect.e_u058_l", "LineageEffect.e_u058_a", "LineageEffect.e_u058_b"], effectGroup: "npcDoubleWindOfHand", soundPhases: ["casting", "shot", "explosion"], pending: "retail visual/timing, impact light and no-hit-actor parity" });

// Engine.dll Shot 0x7acbd0; Explosion 0x790d19.
nativeSkillBindings.set("s_npc_beam_curve", { effects: ["LineageEffect.e_u034_a", "LineageEffect.e_u034_b", "LineageEffect.e_u034_c"], soundPhases: ["shot", "explosion"], pending: "retail visual/timing and no-hit-actor parity" });

// Engine.dll Init 0x79e65e selector 2 -> 0x7a1220; Shot 0x7a95de selector 7 -> 0x7acbd0.
for (const name of ["s_npc_beam_straight", "s_npc_beam_straight7"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.s_u010_a", "LineageEffect.e_u034_a", "LineageEffect.e_u034_b", "LineageEffect.e_u034_c"], soundPhases: ["casting", "shot", "explosion"], pending: "retail visual/timing and no-hit-actor parity" });

// Engine.dll Shot 0x7abd55 table index 5 -> 0x7acbd0; Explosion 0x790d19.
nativeSkillBindings.set("s_npc_beam_straight_magic_only", { effects: ["LineageEffect.e_u034_a", "LineageEffect.e_u034_b", "LineageEffect.e_u034_c"], soundPhases: ["shot", "explosion"], pending: "retail visual/timing and no-hit-actor parity" });

// Engine.dll Shot 0x7abd55 table index 2 -> 0x7acd4d; Explosion 0x790d19.
for (const name of ["s_npc_beam_curve_magic_only", "s_npc_beam_curve_magic_only7"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.e_u034_a", "LineageEffect.e_u034_b", "LineageEffect.e_u034_c"], effectGroup: "npcBeamCurveMagicOnly", soundPhases: ["shot", "explosion"], pending: "retail visual/timing and no-hit-actor parity" });

// Engine.dll Init selector 0x7a2163 -> 0x79f76e; Shot selector 0x7b14ca -> 0x7aef96.
for (const name of ["s_npc_life_chant", "s_npc_life_chant6"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u024_a", "LineageEffect.m_u024_b", "LineageEffect.m_u024_c"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, multi-target and individual NPC verification" });

// Engine.dll Init 0x7a22c8=0 -> 0x79dc4d; Shot 0x7b16a9=2 -> 0x7b0890, shared m_u024_b at 0x7b0a12.
nativeSkillBindings.set("s_npc_acumen_empower_berserker3", { effects: ["LineageEffect.m_u800_a", "LineageEffect.m_u024_b", "LineageEffect.m_u800_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, multi-target and individual NPC verification" });

// Engine.dll Init 0x7a0fa9 -> 0x7a14c0, selector 0x7a22ce=0 -> 0x79dc4d; Shot 0x7b16af=2 -> 0x7b0890.
nativeSkillBindings.set("s_clan_acumen_empower_berserker3", { effects: ["LineageEffect.m_u800_a", "LineageEffect.m_u024_b", "LineageEffect.m_u800_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, multi-target and individual NPC verification" });

// Engine.dll Init 0x7a1309, Shot 0x7af772, PreShot 0x7a43ac and Explosion 0x7916c2 reach default returns.
for (const name of ["s_npc_hold_strike3", "s_npc_hold_strike4", "s_npc_hold_strike5", "s_npc_hold_strike6", "s_npc_hold_strike7", "s_npc_hold_strike8", "s_npc_hold_strike9", "s_npc_poison_strike10", "s_npc_poison_strike3", "s_npc_poison_strike4", "s_npc_poison_strike5", "s_npc_poison_strike6", "s_npc_poison_strike7", "s_npc_poison_strike8", "s_npc_poison_strike9", "s_npc_weakness_strike8", "s_npc_weakness_strike9", "s_clan_damage_shield3"])
    nativeSkillBindings.set(name, { effects: [], soundPhases: [], pending: "native phases have no particles or sound; hit/status reactions and full retail parity unverified" });

// Engine.dll Init selectors 0x7a2304..0x7a2306 -> 0x79c74b; PreShot 0x7a43ac, Shot 0x7b1680 and Explosion 0x7916c2 reach empty returns.
for (const name of ["balakas lava skin", "balakas trample"])
    nativeSkillBindings.set(name, { effects: [], soundPhases: [], pending: "native phases have no particles or sound; hit/buff/status visuals and full retail parity unverified" });

// Engine.dll Init 0x7a18a3/0x7a18ae; PreShot 0x7a43ac/0x7a4628; Shot 0x7af772/0x7b1680; Explosion 0x7918ca/0x7918d5, zero sound actor at 0x78ddd2/0x791afb.
for (const name of ["s_power_shot_boss_a_1c_1", "s_stun_shot_boss_a_2b_1", "s_spear_attack_boss_a_2b_7", "s_spear_attack_boss_a_1b_4", "s_spear_attack_boss_a_1c_2"])
    nativeSkillBindings.set(name, { effects: [], soundPhases: [], pending: "native phases have no particles or sound; full retail animation/timing and target reactions unverified" });

// Engine.dll Init 0x7a1309/0x7a1314; PreShot 0x7a43ac; Shot 0x7af772 or selector9 ->0x7b1680 ->0x7b0e38; Explosion 0x7916c2/0x791afb.
for (const name of ["s_npc_sonic_storm9", "s_npc_range_hit_down9", "s_npc_hex_shock6", "s_npc_hex_shock9", "s_clan_berserker_might3", "s_npc_avoid_debuff9", "s_range_weakness9", "s_clan_berserker_haste2", "s_clan_acumen_shield3", "s_range_slow_strike3", "s_range_slow_strike8", "s_range_slow_strike9", "s_npc_hex_storm6", "s_npc_hex_storm9", "s_clan_focus_acumen3", "s_npc_weakness_blaze_magic_only9"])
    nativeSkillBindings.set(name, { effects: [], soundPhases: [], pending: "native phases have no particles or sound; hit/status reactions and full retail animation/timing unverified" });

// Engine.dll SpawnNTransientEffect 0x79a59f -> 0x79a7e1 skips success and sound; NActionStop 0x750773.
for (const name of ["balakas tail stomp", "s_quest_boss_big_body1", "s_quest_boss_dispel_big_body1"])
    nativeSkillBindings.set(name, { effects: [], soundPhases: [], rejectTransient: true });

// Engine.dll Init 0x79eac7 ->0x79c74b; PreShot selector0x7a45dc=1; Shot0x7b14f5=31; Explosion0x791dcf=9 (sound actor remains null).
for (const name of ["s_soulless_mp_dot", "s_soulless_mp_dot8", "s_soulless_mp_dot9", "s_soulless_mp_dot10", "s_soulless_mp_dot11", "s_soulless_mp_dot12"])
    nativeSkillBindings.set(name, { effects: [], soundPhases: [], pending: "zero-duration preview animation and retail packet timing; native phases have no particles or sound" });

const collisionBindings = new Map<string, NativeSkillBinding_T>([
    // Engine.dll Init0x79f5c8 and Shot0x7b0749 share the Sleep recipe; exported dispatch separates the empty Hate branch.
    ["npcHate", nativeSkillBindings.get("s_npc_sleep")],
    ["empty", { effects: [], soundPhases: [], pending: "zero-duration preview animation and retail packet timing; native phases have no particles or sound" }],
    ["bow", nativeSkillBindings.get("s_npc_bow_attack")],
    ["bossStunShot", nativeSkillBindings.get("s_stun_shot_boss_a_2c_1")],
    // Engine.dll Init 0x7a1220, PreShot 0x7a3de7, Shot 0x7af576, Explosion 0x7918db.
    ["bossSpearStun", { effects: ["LineageEffect.s_u010_a", "LineageEffect.NSpear_sp", "LineageEffect.s_u505_c"], effectGroup: "bossSpearStun", soundPhases: ["casting", "shot", "explosion"], pending: "spear rendering, retail visual/timing and no-hit verification" }]
]);

export function getNativeSkillBinding(name: string, id: number): NativeSkillBinding_T {
    const key = name.toLowerCase();
    const dispatch = nativeSkillDispatch.get(key);

    if (!dispatch) return nativeSkillBindings.get(key);

    const binding = collisionBindings.get(dispatch.get(id));

    if (!binding) throw new Error(`Native skill '${name}' has no exported dispatch for table ID '${id}'.`);

    return binding;
}

export default nativeSkillBindings;
