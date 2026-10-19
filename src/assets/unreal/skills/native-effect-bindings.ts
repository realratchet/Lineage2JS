import type { NpcSkillEffectPhase_T } from "../un-pawn";
import nativeEffectIds from "./native-effect-ids";
import nativeEffectDispatch from "./native-effect-dispatch";
import nativeEffectHandlers from "./native-effect-handlers";
import nativeEffectRecipes from "./native-effect-recipes";

export type NativeEffectBinding_T = { effects: string[], effectGroup?: string, soundPhases: NpcSkillEffectPhase_T[], finalShotOnly?: boolean, rejectTransient?: boolean, associatedActors?: boolean, pending?: string, firecracker?: 1 | 2 | 3, echoCrystal?: boolean };

const nativeEffectBindings = new Map<string, NativeEffectBinding_T>([
    // Engine.dll OnReceiveMagicSkillUse 0x75086c; Init 0x7a16f9; Shot 0x7b0d96.
    ["s_balakas_meteor_storm", { effects: ["LineageEffect.e_u524_meteor", "LineageEffect.e_u524_a"], soundPhases: ["casting", "shot"], pending: "server LocLIst inputs and full retail visual/timing verification" }],
    // Engine.dll Init 0x79e8b8 -> 0x7a1bb6; Shot 0x7b0b7e..0x7b0e33.
    ["s_balakas_fear", { effects: ["LineageEffect.e_u802_fallback", "LineageEffect.e_u802_refract"], soundPhases: ["casting", "shot"], pending: "retail visual/timing and missing-Dummy05 branch verification" }],
    // Engine.dll SkillEffectShot 0x7ab397; Init exit 0x79e8b8.
    ["s_baium_normal_attack", { effects: ["LineageEffect.e_u063_a"], soundPhases: ["casting", "shot"] }],
    // Engine.dll SkillEffectInit 0x79e975; Shot 0x7b0d8e.
    ["s_energy_wave", { effects: ["LineageEffect.e_u065_a"], soundPhases: ["casting", "shot"] }],
    // Engine.dll SkillEffectShot 0x7ab3af; class string 0xab1764.
    ["s_earth_quake", { effects: ["LineageEffect.e_u066_a"], soundPhases: ["shot"] }],
    // Engine.dll SkillEffectInit 0x79e90d; SkillEffectShot 0x7ab506.
    ["s_thunderbolt", { effects: ["LineageEffect.e_u064_cloud", "LineageEffect.e_u064_a"], soundPhases: ["casting", "shot"] }],
    // Engine.dll SkillEffectShot 0x7abbb4 / 0x7abd11.
    ["s_group_hold", { effects: ["LineageEffect.e_u067_hand", "LineageEffect.e_u067_a"], soundPhases: ["shot"] }]
]);

// Engine.dll SpawnNTransientEffect 0x104c91eb..0x104c9309; OnFirecracker 0x104777c0.
for (const [name, type] of [["e_fairy_firecracker", 1], ["e_firecracker", 2], ["e_large_firecracker", 3]] as const)
    nativeEffectBindings.set(name, { effects: [], soundPhases: [], firecracker: type });

// Engine.dll SpawnNTransientEffect 0x104c9063/0x104c9e32; sound duration0x104ca91e.
nativeEffectBindings.set("e_echo_crystal", { effects: [], soundPhases: ["casting"], echoCrystal: true });

// Engine.dll Init 0x79f9ec; Shot 0x7ac0d5 requires AssociatedActor.Num(); primary target branch0x7ac1ab.
for (const name of ["s_zaken_tel_pc", "s_zaken_range_tel_pc"])
    nativeEffectBindings.set(name, { effects: ["LineageEffect.e_u071_a", "LineageEffect.e_u071_b"], soundPhases: ["casting", "shot"], associatedActors: true, pending: "retail visual/timing, secondary-target and teleport movement parity" });

// Engine.dll Init 0x79c74b; Shot 0x7a9104; Explosion 0x78f4aa; PreShot 0x7a3de7.
nativeEffectBindings.set("s_mech_canon", { effects: ["LineageEffect.e_u033_a", "LineageEffect.e_u033_b", "LineageEffect.e_u033_c"], soundPhases: ["shot", "explosion"], pending: "retail visual/timing, no-hit and ownerless impact verification" });

// Engine.dll Init 0x7a17a8, PreShot 0x7a43c0, Shot 0x7afa26, Explosion 0x7916c7.
// Boss selectors 0x7a2236/0x7a461f/0x7b15ee/0x791e2c; variants 0x7a16c7, 0x7a462c..0x7a462f, 0x7b1722..0x7b1725, 0x7916a5.
// NPC Stun Shot selects these same branches at 0x7a217a/0x7a45c8/0x7b14e1/0x791dbb.
for (const name of ["s_npc_bow_attack", "s_npc_stun_shot", "s_power_shot_boss_a", "s_power_shot_boss_a_2b_1", "s_power_shot_boss_a_2c_1", "s_power_shot_boss_a_1b_1"])
    nativeEffectBindings.set(name, { effects: ["LineageEffect.s_u003_a", "LineageEffect.s_u003_d", "LineageEffect.s_u003_b", "LineageEffect.p_u004_a"], effectGroup: "bow", soundPhases: ["casting", "shot", "explosion"], pending: "full retail visual/timing verification" });

// Engine.dll Init 0x7a189e..0x7a18b4; PreShot 0x7a4632 -> 0x7a43c0; Shot 0x7b1728 -> 0x7af8cb; Explosion 0x7918c5..0x7918db.
nativeEffectBindings.set("s_stun_shot_boss_a_2c_1", { effects: ["LineageEffect.s_u505_a", "LineageEffect.s_u003_d", "LineageEffect.s_u505_b", "LineageEffect.s_u003_b", "LineageEffect.s_u505_c"], effectGroup: "bossStunShot", soundPhases: ["casting", "shot", "explosion"], pending: "retail visual/timing, no-hit and DamageEffect ordering verification" });

// Engine.dll Init 0x79e66c -> 0x7a1220; Shot 0x7a90f6 -> 0x7ae0ea.
for (const name of ["s_npc_thunder_storm", "s_npc_stun_attack", "s_npc_shield_stun"])
    nativeEffectBindings.set(name, { effects: ["LineageEffect.s_u010_a", "LineageEffect.p_u004_a"], soundPhases: ["casting", "shot"] });

// Engine.dll Init 0x7a1220; Shot 0x7ae49b requires FinalShot, 0x7ae847 joins 0x7ae411.
for (const name of ["s_orphen_strike", "s_orphen_dispel", "s_npc_blow"])
    nativeEffectBindings.set(name, { effects: ["LineageEffect.s_u010_a", "LineageEffect.p_u004_a"], soundPhases: ["casting", "shot"], finalShotOnly: true });

// Engine.dll Init 0x7a1220; Shot 0x7a95ec -> 0x7b0e38 returns without a hit effect.
nativeEffectBindings.set("s_npc_bleed", { effects: ["LineageEffect.s_u010_a"], soundPhases: ["casting"] });

// Engine.dll Init 0x79eabf -> 0x79f4c1; Shot 0x7abd47 -> 0x7ae996; FNPawnLight 0x79f5bc.
for (const name of ["s_npc_aura_burn", "s_npc_aura_burn_magic_only"])
    nativeEffectBindings.set(name, { effects: ["LineageEffect.m_u019_a", "LineageEffect.m_u019_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing verification" });

// Engine.dll SkillEffectInit 0x79dbbc -> 0x79eaa8 returns; SkillEffectShot 0x7abe73 -> 0x7ae996.
nativeEffectBindings.set("s_aura_burn_boss_a", { effects: ["LineageEffect.m_u019_b"], soundPhases: ["shot"], pending: "retail visual/timing, target ownership and individual NPC verification" });

// Engine.dll SkillEffectInit 0x79dbbc -> 0x79eaa8 returns; SkillEffectShot 0x7abe73 selector 7 -> 0x7ac6ac pushes m_u009_c.
for (const name of ["s_self_range_poison_boss_a", "s_self_range_weakness_boss_a", "s_self_range_slow_boss_a", "s_self_range_paralyze_boss_a", "s_self_range_aura_sink_boss_a"])
    nativeEffectBindings.set(name, { effects: ["LineageEffect.m_u009_c"], soundPhases: ["casting", "shot"], pending: "retail visual/timing and individual NPC verification" });

// Engine.dll ID4082: Init0x79c74b, PreShot0x7a3de7, Shot0x7ae0ea, Explosion0x791ade.
nativeEffectBindings.set("s_poison_of_death", { effects: ["LineageEffect.p_u004_a"], soundPhases: ["shot"] });

// Engine.dll Init table 0x7a20ac -> 0x79f4c1; Shot table 0x7b13b4 -> 0x7ae996; PreShot 0x7a40b9 returns.
nativeEffectBindings.set("s_npc_burn", { effects: ["LineageEffect.m_u019_a", "LineageEffect.m_u019_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, multi-target and individual suffix verification" });

// Engine.dll Init 0x79f5c8; Shot 0x7b0749 -> 0x7b0811 -> 0x7a9753.
// Boss Init selectors 0x7a2220/0x7a2230=16; Shot selectors 0x7b15d8/0x7b15e8=9.
for (const name of ["s_npc_sleep", "s_self_range_sleep_boss_a", "s_sleep_boss_a_7"])
    nativeEffectBindings.set(name, { effects: ["LineageEffect.m_u018_a", "LineageEffect.m_u018_b"], soundPhases: ["casting", "shot"] });

// Engine.dll Init 0x79fd84; Shot 0x7af786 -> 0x7af84c -> 0x7ac0c6.
for (const name of ["s_npc_hold", "s_range_hold_boss_a"])
    nativeEffectBindings.set(name, { effects: ["LineageEffect.m_u013_a", "LineageEffect.m_u013_c"], soundPhases: ["casting", "shot"] });

// Engine.dll Init selector 0x7a20d1 -> 0x79ed7e; Shot slot 0x7b13c8 -> 0x7ac6ac.
// Boss Init selectors 0x7a221f/0x7a222f=15; Shot selectors 0x7b15d7/0x7b15e7=8.
for (const name of ["s_npc_shackle", "s_self_range_wind_shackle_boss_a", "s_wind_shackle_boss_a"])
    nativeEffectBindings.set(name, { effects: ["LineageEffect.m_u009_a", "LineageEffect.m_u009_c"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, multi-target and individual NPC verification" });

// Engine.dll Init 0x7a0dcf; Shot selector 0x7b1659 -> 0x7ac923; PreShot 0x7a43ac returns.
nativeEffectBindings.set("s_holy_light_burst_boss_a", { effects: ["LineageEffect.e_u082_rainbow", "LineageEffect.e_u082_core", "LineageEffect.e_u082_a"], soundPhases: ["casting", "shot"], pending: "retail visual/timing and named-bone attachment verification" });

// Engine.dll Init 0x7a0fd0..0x7a121b; Shot selector0x7b165a=38 ->0x7ac895; PreShot0x7a43ac and Explosion0x79094f return.
nativeEffectBindings.set("s_evil_shackle_boss_a", { effects: ["LineageEffect.e_u504_a", "LineageEffect.e_u504_rh", "LineageEffect.e_u504_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, hand attachment and target reaction verification" });

// Engine.dll Init selectors 0x7a2221/0x7a2231 and Shot selectors 0x7b15d9/0x7b15e9 share Hold.
for (const name of ["s_self_range_hold_boss_a", "s_hold_boss_a"])
    nativeEffectBindings.set(name, { effects: ["LineageEffect.m_u013_a", "LineageEffect.m_u013_c"], soundPhases: ["casting", "shot"], pending: "multi-target, retail visual/timing and individual NPC verification" });

// Engine.dll Init 0x79f9d0 -> 0x79fd84; Shot 0x7abe73 -> 0x7af786; PreShot bound 0x7a40b4 returns.
nativeEffectBindings.set("s_zaken_hold", { effects: ["LineageEffect.m_u013_a", "LineageEffect.m_u013_c"], soundPhases: ["casting", "shot"], pending: "retail visual/timing and multi-target verification" });

// Engine.dll Init 0x7a228f -> 0x7a131a; Shot 0x7b15f9 -> 0x7afafb; PreShot 0x7a40b4 and Explosion 0x791e37 return.
nativeEffectBindings.set("s_zaken_drain", { effects: ["LineageEffect.m_u003_a", "LineageEffect.m_u003_c", "LineageEffect.m_u003_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing and secondary-target verification" });

// Engine.dll Init 0x7a2291 -> 0x7a1220; Shot 0x7b15fb -> 0x7ae0ea; PreShot 0x7a40b4 and Explosion 0x791e39 return.
nativeEffectBindings.set("s_zaken_dual_attack", { effects: ["LineageEffect.s_u010_a", "LineageEffect.p_u004_a"], effectGroup: "zakenDualAttack", soundPhases: ["casting", "shot"], pending: "retail visual/timing, target reactions and secondary-target verification" });

// Engine.dll Init 0x7a2292 -> 0x7a1220; Shot 0x7b15fc -> 0x7b0e38; PreShot 0x7a40b4 and Explosion 0x791e3a return.
nativeEffectBindings.set("s_zaken_range_dual_attack", { effects: ["LineageEffect.s_u010_a"], soundPhases: ["casting"], pending: "retail visual/timing and target reaction verification" });

// Engine.dll Init 0x7a2293 -> 0x79ddae; Shot 0x7b15fd -> 0x7abe91; PreShot 0x7a40b4 and Explosion 0x791e3b return.
nativeEffectBindings.set("s_zaken_self_tel", { effects: ["LineageEffect.e_u031_a", "LineageEffect.e_u005_a"], effectGroup: "zakenSelfTel", soundPhases: ["casting", "shot"], pending: "retail visual/timing verification; preview does not teleport the caster" });

// Engine.dll Init selector0x7a22a3=12 ->0x7a0b7e; Shot0x7b160d=33 ->0x7af286; PreShot0x7a43ac and Explosion0x791e4b=8 return.
nativeEffectBindings.set("s_dietrich_suspension", { effects: ["LineageEffect.m_u025_a", "LineageEffect.m_u025_b", "LineageEffect.m_u025_c"], soundPhases: ["casting", "shot"], pending: "retail visual/timing and secondary-target verification" });

// Engine.dll Init0x7a22a1=10 ->0x7a0915; Shot0x7b160b=32 ->0x7ade48; Explosion0x791e49=5 ->0x7905eb; PreShot0x7a43ac returns.
nativeEffectBindings.set("s_gustav_wind", { effects: ["LineageEffect.m_u038_a", "LineageEffect.m_u038_b", "LineageEffect.m_u038_c", "LineageEffect.m_u038_d"], soundPhases: ["casting", "shot", "explosion"], pending: "retail visual/timing and target reaction verification" });
// Engine.dll Init 0x7a229b=18 -> return; Shot 0x7b1605=28 -> 0x7acf2a; Explosion 0x791e43=3 -> 0x7907ac.
nativeEffectBindings.set("s_wild_cannon", { effects: ["LineageEffect.e_u073_a", "LineageEffect.e_u073_b", "LineageEffect.e_u073_ground", "LineageEffect.e_u073_door"], soundPhases: ["shot", "explosion"], pending: "Retail visual/timing verification" });

// Engine.dll Init table 0x7a2130 -> 0x79f5c8; Shot table 0x7b14bc -> 0x7b0749.
for (const name of ["s_npc_silence", "s_npc_berserker", "s_npc_surrender_to_fire"])
    nativeEffectBindings.set(name, { effects: ["LineageEffect.m_u018_a", "LineageEffect.m_u018_b"], soundPhases: ["casting", "shot"] });

// Engine.dll Init 0x7a1ce1=1 -> 0x79f5c8; Shot 0x7b0fb9=14 -> 0x7b0749; PreShot 0x7a3e0b and Explosion 0x791bd0=4 return.
nativeEffectBindings.set("s_hex10", { effects: ["LineageEffect.m_u018_a", "LineageEffect.m_u018_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing and secondary-target verification" });

// Engine.dll Init 0x79ebae with FNPawnLight 0x79ed26; Shot 0x7ac39f.
// Boss Init selectors 0x7a222e/0x7a2232/0x7a2234/0x7a2235=19; Shot 0x7b15e6/0x7b15ea/0x7b15ec/0x7b15ed=17.
for (const name of ["s_single_poison", "s_npc_slow", "s_poison_boss_a", "s_weakness_boss_a", "s_slow_boss_a", "s_paralyze_boss_a", "s_aura_sink_boss_a_7"])
    nativeEffectBindings.set(name, { effects: ["LineageEffect.m_u007_a", "LineageEffect.m_u007_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing verification" });

// Engine.dll Init selector 0x7a2177 -> 0x79ebae; Shot selector 0x7b14de -> 0x7ac39f.
nativeEffectBindings.set("s_npc_paralyze", { effects: ["LineageEffect.m_u007_a", "LineageEffect.m_u007_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, status reaction, multi-target and individual NPC verification" });

// Engine.dll Init 0x79fabf; Shot 0x7ac52a; PreShot 0x7a43a4 and Explosion 0x791ade return.
// Range Paralyze: 0x7a2178=15, 0x7b14df=17; Range Poison: 0x7a20cf=14, Shot pointer 0x7b13c0.
for (const name of ["s_range_poison", "s_npc_range_paralyze", "s_summon_range_poison"])
    nativeEffectBindings.set(name, { effects: ["LineageEffect.m_u021_a", "LineageEffect.m_u021_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, multi-target and individual NPC verification" });

// Engine.dll Init 0x7a20d0=15 -> 0x79e58b; Shot pointer 0x7b13c4 -> 0x7a8fa4 -> 0x7ac4e0.
nativeEffectBindings.set("s_npc_weakness", { effects: ["LineageEffect.m_u007_a", "LineageEffect.m_u007_b"], effectGroup: "npcWeakness", soundPhases: ["casting", "shot"], pending: "retail visual/timing, multi-target and individual NPC verification" });

// Engine.dll Init 0x79fbde; Shot 0x7ad619 / 0x7ad71e -> 0x7ac0c6.
for (const name of ["s_npc_hydro_blast", "s_npc_hydro_blast_magic_only2"])
    nativeEffectBindings.set(name, { effects: ["LineageEffect.m_u033_a", "LineageEffect.m_u033_b"], soundPhases: ["casting", "shot"], pending: "full retail visual and timing parity" });

// Engine.dll Init 0x79e2b7 -> 0x7a131a; Shot 0x7a8bba / 0x7abe73 -> 0x7afafb.
// Boss Vampiric Touch: Init selector 0x7a2227=3 -> 0x7a131a; Shot selector 0x7b15df=13 -> 0x7afafb.
// Boss Life Drain: Init selector 0x7a2228=3; Shot selector 0x7b15e0=13.
for (const name of ["s_blood_sucking", "s_vampiric_touch_boss_a", "s_life_drain_boss_a", "s_summon_blood_sucking"])
    nativeEffectBindings.set(name, { effects: ["LineageEffect.m_u003_a", "LineageEffect.m_u003_c", "LineageEffect.m_u003_b"], soundPhases: ["casting", "shot"], pending: "retail return-path and full visual/timing verification" });

// Engine.dll Init 0x7a0fa4..0x7a0fb4 -> 0x7a13ed; Shot selectors 0x7b169d/0x7b169e -> 0x7b0002.
for (const name of ["s_range_80_hp_drain9", "s_range_80_hp_drain_magic_only7"])
    nativeEffectBindings.set(name, { effects: ["LineageEffect.s_u019_a", "LineageEffect.s_u019_b", "LineageEffect.s_u019_c"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, secondary targets and individual NPC verification" });

// Engine.dll Shot 0x7afafb selects m_u003_c and m_u003_b for the drain variants.
for (const name of ["s_blood_sucking_magic_only", "s_blood_sucking_for_slow", "s_npc_bleed_drain9", "s_npc_bleed_drain_magic_only9", "s_npc_100_hp_drain6", "s_npc_100_hp_drain_magic_only9"])
    nativeEffectBindings.set(name, { effects: ["LineageEffect.m_u003_a", "LineageEffect.m_u003_c", "LineageEffect.m_u003_b"], soundPhases: ["casting", "shot"], pending: "retail return-path and full visual/timing verification" });

// Engine.dll Init 0x7a2201=3 -> 0x7a131a; Shot table 0x7b1504 -> 0x7afafb.
nativeEffectBindings.set("s_mana_sucking_magic_only", { effects: ["LineageEffect.m_u003_a", "LineageEffect.m_u003_c", "LineageEffect.m_u003_b"], soundPhases: ["casting", "shot"], pending: "retail return-path, visual/timing and individual NPC verification" });

// Engine.dll Init 0x7a22e0/0x7a22e1=1 -> 0x7a131a; Shot 0x7b16c1/0x7b16c2=3 -> 0x7af786.
for (const name of ["s_npc_hold_drain7", "s_npc_hold_drain_magic_only6"])
    nativeEffectBindings.set(name, { effects: ["LineageEffect.m_u003_a", "LineageEffect.m_u013_c"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, multi-target and individual NPC verification" });

// Engine.dll Init 0x7a20d2 -> 0x7a131a; Shot 0x7a87b2 -> 0x7afafb; PreShot 0x7a40b9 returns.
nativeEffectBindings.set("s_mana_sucking", { effects: ["LineageEffect.m_u003_a", "LineageEffect.m_u003_c", "LineageEffect.m_u003_b"], soundPhases: ["casting", "shot"], pending: "retail return-path, visual/timing and individual NPC verification" });

// Engine.dll Init selector 0x7a2144 -> 0x7a06db; Shot selector 0x7b142a -> 0x7adcef; Explosion 0x79042a.
// Boss Twister: Init 0x7a222a=5, Shot 0x7b15e2=15, Explosion 0x791e06=7; PreShot 0x7a4613=1 returns.
for (const name of ["s_npc_twister", "s_twister_boss_a", "s_npc_twister_for_slow"])
    nativeEffectBindings.set(name, { effects: ["LineageEffect.m_u026_a", "LineageEffect.m_u026_b", "LineageEffect.m_u026_c", "LineageEffect.m_u026_d"], soundPhases: ["casting", "shot", "explosion"], pending: "retail visual/timing, no-hit-actor, collision and individual NPC verification" });

nativeEffectBindings.set("s_npc_twister_magic_only", { effects: ["LineageEffect.m_u026_a", "LineageEffect.m_u026_b", "LineageEffect.m_u026_c", "LineageEffect.m_u026_d"], soundPhases: ["casting", "shot", "explosion"], pending: "retail visual/timing, no-hit-actor, collision and individual NPC verification" });

// Engine.dll Shot 0x7b0e38 skips PlaySkillSound at 0x7b0e33; Init/PreShot also return without effects or sound.
nativeEffectBindings.set("s_antaras_fear", { effects: [], soundPhases: [], pending: "full retail parity" });

// Engine.dll APawn::SkillEffectShot 0x7a9bc8.
nativeEffectBindings.set("s_antaras_jump", { effects: ["LineageEffect.e_u043_a"], soundPhases: ["shot"] });

// Engine.dll APawn::SkillEffectShot 0x7a9f87.
nativeEffectBindings.set("s_antaras_tail", { effects: ["LineageEffect.e_u051_a"], soundPhases: ["shot"] });

// Engine.dll APawn::SkillEffectShot 0x7aa34b.
nativeEffectBindings.set("s_antaras_debuff", { effects: ["LineageEffect.e_u050_b"], soundPhases: ["shot"] });

// Engine.dll APawn::SkillEffectShot 0x7aacc7.
nativeEffectBindings.set("s_antaras_mouth", { effects: ["LineageEffect.e_u044_b"], soundPhases: ["shot"] });

// Engine.dll Shot 0x7aa56c..0x7aa91e leaves lastEffect zero at the 0x7b0e26 sound guard.
nativeEffectBindings.set("s_antaras_normal_attack", { effects: ["LineageEffect.e_u049_a"], soundPhases: [] });

// Engine.dll APawn::SkillEffectInit spawn 0x79e829; SkillEffectShot 0x7ab0e5.
nativeEffectBindings.set("s_antaras_breath", { effects: ["LineageEffect.e_u046_a", "LineageEffect.e_u046_b", "LineageEffect.e_u046_c"], soundPhases: ["casting", "shot", "explosion"] });

// Engine.dll Shot 0x7aaa61..0x7aaa71 spawns e_u049_a from the left-hand branch.
nativeEffectBindings.set("s_antaras_normal_attack_ex", { effects: ["LineageEffect.e_u049_a"], effectGroup: "antarasNormalAttackEx", soundPhases: [], pending: "native L2-event behavior and full retail parity" });

// Engine.dll Init selectors 0x7a216a/0x7a2223 -> 0x79f2ca; Shot 0x7ac244: shared Chill Flame/bleed recipe.
for (const name of ["s_npc_chill_flame", "s_self_range_bleed_boss_a"])
    nativeEffectBindings.set(name, { effects: ["LineageEffect.m_u027_a", "LineageEffect.m_u027_b"], soundPhases: ["casting", "shot", "explosion"], pending: "retail visual/timing and secondary target-list parity" });

// Engine.dll Init 0x7a229d -> 0x7a025d; Shot 0x7b1607 -> 0x7acb51 -> 0x7ac0b6.
nativeEffectBindings.set("s_npc_strike_range", { effects: ["LineageEffect.e_u057_a", "LineageEffect.e_u057_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing and individual NPC verification" });

// Engine.dll Init 0x7a0558; Shot 0x7adbab requires FinalShot; Explosion 0x78f351/0x790963.
for (const name of ["s_mega_storm_strike", "s_summon_mega_storm_strike"])
    nativeEffectBindings.set(name, { effects: ["LineageEffect.m_u000_a", "LineageEffect.m_u000_b", "LineageEffect.m_u000_c", "LineageEffect.m_u000_d"], soundPhases: ["casting", "shot", "explosion"], finalShotOnly: true, pending: "retail visual/timing, low-frame-rate ordering and collision parity; individual summon variants" });

// Engine.dll Init 0x79c74b; Shot 0x7a9288..0x7a95dd; PreShot 0x7a3de7.
nativeEffectBindings.set("s_siege_hammer", { effects: ["LineageEffect.p_u004_a"], effectGroup: "siegeHammer", soundPhases: [], pending: "retail visual/timing and individual NPC verification" });

// Engine.dll Init 0x79ff2a; Shot 0x7ada66 / 0x7adb2c; PreShot 0x7a40b9 / 0x7a459a -> 0x7a3de7.
for (const name of ["s_clan_might", "s_self_haste", "s_self_range_might_boss_a"])
    nativeEffectBindings.set(name, { effects: ["LineageEffect.m_u004_a", "LineageEffect.m_u004_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, multi-target and individual NPC verification" });

// Engine.dll Init selectors 0x7a228a/0x7a228b=2 -> 0x79fe57; Shot 0x7b15f4/0x7b15f5=2 -> 0x7ad91b.
for (const name of ["s_self_range_haste_boss_a", "s_self_range_reflect_damage_boss_a"])
    nativeEffectBindings.set(name, { effects: ["LineageEffect.m_u036_a", "LineageEffect.m_u036_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, multi-target and individual NPC verification" });

// Engine.dll Init 0x79e67a; Shot 0x7a95fa; PreShot 0x7a40b9 and Explosion 0x78f3f8 return.
for (const name of ["s_self_might", "s_self_shield"])
    nativeEffectBindings.set(name, { effects: ["LineageEffect.s_u005_a", "LineageEffect.s_u005_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, multi-target and individual NPC verification" });

// Engine.dll Init 0x79f3ee; Shot 0x7ae84c; PreShot 0x7a45ae -> 0x7a3de7 returns.
nativeEffectBindings.set("s_npc_cancel", { effects: ["LineageEffect.m_u016_a", "LineageEffect.m_u016_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, multi-target and individual suffix verification" });

// Engine.dll Init 0x7a02f2; Shot 0x7ac80f requires FinalShot; Explosion 0x790a86.
for (const name of ["s_nurka_fire", "s_npc_blaze", "s_npc_prominence", "s_npc_blaze_magic_only", "s_npc_prominence_magic_only", "s_npc_blaze_for_slow", "s_npc_prominence_for_slow"])
    nativeEffectBindings.set(name, { effects: ["LineageEffect.m_u006_a", "LineageEffect.m_u006_b", "LineageEffect.m_u006_c", "LineageEffect.m_u006_e"], soundPhases: ["casting", "shot", "explosion"], finalShotOnly: true, pending: "retail visual/timing, no-hit-actor and collision verification; individual suffix variants" });

// Engine.dll Init 0x7a02f2; Shot 0x7ac80f; Explosion 0x78f3fe -> 0x791295.
for (const name of ["s_npc_flame_strike", "s_npc_flame_strike_for_slow"])
    nativeEffectBindings.set(name, { effects: ["LineageEffect.m_u006_a", "LineageEffect.m_u006_b", "LineageEffect.m_u006_c", "LineageEffect.m_u006_e", "LineageEffect.m_u006_d"], effectGroup: "flameStrike", soundPhases: ["casting", "shot", "explosion"], finalShotOnly: true, pending: "retail visual/timing, secondary targets, no-hit-actor and collision verification; individual NPC variants" });

// Engine.dll Init 0x7a131a; Shot 0x7a99b2..0x7a9bc5; PreShot returns at 0x7a3de7.
nativeEffectBindings.set("s_npc_corpse_burst6", { effects: ["LineageEffect.m_u003_a", "LineageEffect.m_u006_e", "LineageEffect.m_u006_d"], effectGroup: "corpseBurst", soundPhases: ["casting", "shot"], pending: "retail visual/timing, secondary targets, corpse targeting and individual suffix verification" });

// Engine.dll Init 0x79e483; Shot 0x7a8ef6; PreShot 0x7a40b9 returns.
nativeEffectBindings.set("s_cat_recharge", { effects: ["LineageEffect.m_u022_a", "LineageEffect.m_u022_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing and individual NPC verification" });

// Engine.dll Init 0x7a20bf/0x7a20c3 -> 0x79e3b0; Shot 0x7b1384/0x7b1394 -> 0x7a8d21; PreShot/Explosion return via 0x7a3de7/0x791ade.
// Engine.dll Shot 0x7a8d21..0x7a8d2c checks AssociatedActor count before the primary/list flag.
for (const name of ["s_heal_queen_ant1", "s_heal_queen_ant2"]) nativeEffectBindings.set(name, { effects: ["LineageEffect.m_u001_a", "LineageEffect.m_u001_b"], soundPhases: ["casting", "shot"], associatedActors: true, pending: "retail visual/timing verification" });

// Engine.dll Init 0x7a20bc -> 0x7a1220; Shot 0x7a8bc3 returns; PreShot/Explosion return via 0x7a3de7/0x791ade.
nativeEffectBindings.set("s_queen_ant_brandish", { effects: ["LineageEffect.s_u010_a"], soundPhases: ["casting"], pending: "retail visual/timing verification" });

// Engine.dll Init 0x7a20bd -> 0x79c74b; Shot 0x7a8bc9; Explosion 0x78f351 -> 0x790963; PreShot returns at 0x7a3de7.
nativeEffectBindings.set("s_queen_ant_strike", { effects: ["LineageEffect.m_u000_c", "LineageEffect.m_u000_d"], effectGroup: "queenAntStrike", soundPhases: ["shot", "explosion"], pending: "retail visual/timing and target reaction verification" });

// Engine.dll Init 0x7a20be -> 0x79c74b; Shot 0x7a87d4 -> 0x7ac52a; PreShot/Explosion return via 0x7a3de7/0x791ade.
nativeEffectBindings.set("s_queen_ant_sprinkle", { effects: ["LineageEffect.m_u021_b"], soundPhases: ["shot"], pending: "retail visual/timing and secondary-target verification" });

// Engine.dll Init 0x7a2208/0x7a21b0 -> 0x79f1cc; Shot slot 0x7b1520 -> 0x7abd5c; PreShot/Explosion return via 0x7a3de7/0x791ade.
nativeEffectBindings.set("s_teleport_pc", { effects: ["LineageEffect.e_u031_a", "LineageEffect.e_u005_a"], soundPhases: ["casting", "shot"], pending: "retail visual/timing verification; preview does not teleport the target" });

// Engine.dll Init slot 0x7a1df0 -> 0x79e483; Shot slot 0x7b10d0 -> 0x7a8ef6; PreShot/Explosion return via 0x7a3de7/0x791ade.
nativeEffectBindings.set("s_recharge121", { effects: ["LineageEffect.m_u022_a", "LineageEffect.m_u022_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing verification" });

// Engine.dll Init selector 0x7a1e5d -> 0x79e02a; Shot selector 0x7b113e -> 0x7a8626; PreShot/Explosion return via 0x7a3de7/0x791ade.
nativeEffectBindings.set("s_regeneration3", { effects: ["LineageEffect.m_u014_a", "LineageEffect.m_u014_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing and secondary-target verification" });

// Engine.dll Init 0x7a1f8d -> 0x79e0fd; Shot 0x7b1249 -> 0x7a84c7; PreShot/Explosion return via 0x7a3de7/0x791ade.
nativeEffectBindings.set("s_wind_walk2", { effects: ["LineageEffect.m_u010_a", "LineageEffect.m_u010_c"], soundPhases: ["casting", "shot"], pending: "retail visual/timing and secondary-target verification" });

// Engine.dll Init 0x7a1f8f/0x7a1f04 -> 0x79ed7e; Shot 0x7b124b/0x7b11ec -> 0x7ac6ac; PreShot/Explosion return at 0x7a3de7/0x791ade.
nativeEffectBindings.set("s_breeze14", { effects: ["LineageEffect.m_u009_a", "LineageEffect.m_u009_c"], soundPhases: ["casting", "shot"], pending: "retail visual/timing and secondary-target verification" });

// Engine.dll Init 0x7a1f61/0x7a1fc8 -> 0x79ebae; Shot 0x7b121d/0x7b12ea -> 0x7ac39f; PreShot/Explosion return via 0x7a3de7/0x791ade.
for (const name of ["s_slow10", "s_curse_gloom8"])
    nativeEffectBindings.set(name, { effects: ["LineageEffect.m_u007_a", "LineageEffect.m_u007_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing and secondary-target verification" });

// Engine.dll Init 0x7a1f9a/0x7a1f10 -> 0x79cbf6; Shot 0x7b1256/0x7b11f8 -> 0x7a6e34; PreShot/Explosion return at 0x7a3de7/0x791ade.
nativeEffectBindings.set("s_greater_heal101", { effects: ["LineageEffect.m_u032_a", "LineageEffect.m_u032_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing and secondary-target verification" });

// Engine.dll Init 0x7a1fb1/0x7a1fcd -> 0x79fe57; Shot 0x7a6de5/0x7b12ef -> 0x7ad91b; Explosion 0x791cfe/0x791d1a -> 0x791ade.
for (const name of ["s_guidance3", "s_vampiric_rage3"])
    nativeEffectBindings.set(name, { effects: ["LineageEffect.m_u036_a", "LineageEffect.m_u036_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing and secondary-target verification" });

// Engine.dll Init 0x7a217e/0x7a0fca -> 0x7a1220; Shot 0x7b14e5/0x7abe6d -> 0x7af576; Explosion 0x791dbf/0x790941 -> 0x7916c7.
for (const name of ["s_npc_spear_attack", "s_power_shot_boss_a_2"])
    nativeEffectBindings.set(name, { effects: ["LineageEffect.s_u010_a", "LineageEffect.NSpear_sp", "LineageEffect.p_u004_a"], effectGroup: "spear", soundPhases: ["casting", "shot", "explosion"], pending: "retail visual/timing and individual NPC verification" });

// Engine.dll SkillEffectShot 0x7a99b2 pushes m_u006_e and m_u006_d for skill 4132.
nativeEffectBindings.set("s_rapid_spear_attack", { effects: ["LineageEffect.m_u006_e", "LineageEffect.m_u006_d"], effectGroup: "rapidSpear", soundPhases: ["casting", "shot"], pending: "native shot placement and timing parity" });

// Engine.dll Init selector 0x7a22a9 -> 0x7a1220; Shot 0x7b1613 -> 0x7ae49b requires FinalShot before the p_u004_a primary/list path.
nativeEffectBindings.set("s_npc_wild_sweep", { effects: ["LineageEffect.s_u010_a", "LineageEffect.p_u004_a"], soundPhases: ["casting", "shot"], finalShotOnly: true });

// Engine.dll Init 0x7a2299 -> 0x7a1220; PreShot 0x7a40cd; Shot 0x7ae073 releases NSpear_sp; Explosion 0x7916c7.
nativeEffectBindings.set("s_double_dagger_attack", { effects: ["LineageEffect.s_u010_a", "LineageEffect.NSpear_sp", "LineageEffect.p_u004_a"], effectGroup: "doubleDagger", soundPhases: ["casting", "shot", "explosion"] });

// Engine.dll Init 0x79f23b; Shot 0x7ac9b1; Explosion 0x7900fe.
for (const name of ["s_npc_wind_of_hand", "s_npc_fast_wind_of_hand6"])
    nativeEffectBindings.set(name, { effects: ["LineageEffect.e_u058_r", "LineageEffect.e_u058_a", "LineageEffect.e_u058_b"], soundPhases: ["casting", "shot", "explosion"], pending: "retail visual/timing, impact light and no-hit-actor parity" });

// Engine.dll Init 0x79fffd; Shot selector 0x7b15cc[56]=27 -> 0x7ac9b1.
nativeEffectBindings.set("s_npc_double_wind_of_hand", { effects: ["LineageEffect.e_u058_r", "LineageEffect.e_u058_l", "LineageEffect.e_u058_a", "LineageEffect.e_u058_b"], effectGroup: "npcDoubleWindOfHand", soundPhases: ["casting", "shot", "explosion"], pending: "retail visual/timing, impact light and no-hit-actor parity" });

// Engine.dll Shot 0x7acbd0; Explosion 0x790d19.
nativeEffectBindings.set("s_npc_beam_curve", { effects: ["LineageEffect.e_u034_a", "LineageEffect.e_u034_b", "LineageEffect.e_u034_c"], soundPhases: ["shot", "explosion"], pending: "retail visual/timing and no-hit-actor parity" });

// Engine.dll Init 0x79e65e selector 2 -> 0x7a1220; Shot 0x7a95de selector 7 -> 0x7acbd0.
nativeEffectBindings.set("s_npc_beam_straight", { effects: ["LineageEffect.s_u010_a", "LineageEffect.e_u034_a", "LineageEffect.e_u034_b", "LineageEffect.e_u034_c"], soundPhases: ["casting", "shot", "explosion"], pending: "retail visual/timing and no-hit-actor parity" });

// Engine.dll Shot 0x7abd55 table index 5 -> 0x7acbd0; Explosion 0x790d19.
nativeEffectBindings.set("s_npc_beam_straight_magic_only", { effects: ["LineageEffect.e_u034_a", "LineageEffect.e_u034_b", "LineageEffect.e_u034_c"], soundPhases: ["shot", "explosion"], pending: "retail visual/timing and no-hit-actor parity" });

// Engine.dll Shot 0x7abd55 table index 2 -> 0x7acd4d; Explosion 0x790d19.
nativeEffectBindings.set("s_npc_beam_curve_magic_only", { effects: ["LineageEffect.e_u034_a", "LineageEffect.e_u034_b", "LineageEffect.e_u034_c"], effectGroup: "npcBeamCurveMagicOnly", soundPhases: ["shot", "explosion"], pending: "retail visual/timing and no-hit-actor parity" });

// Engine.dll Init selector 0x7a2163 -> 0x79f76e; Shot selector 0x7b14ca -> 0x7aef96.
nativeEffectBindings.set("s_npc_life_chant", { effects: ["LineageEffect.m_u024_a", "LineageEffect.m_u024_b", "LineageEffect.m_u024_c"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, multi-target and individual NPC verification" });

// Engine.dll Init 0x7a22c8=0 -> 0x79dc4d; Shot 0x7b16a9=2 -> 0x7b0890, shared m_u024_b at 0x7b0a12.
nativeEffectBindings.set("s_npc_acumen_empower_berserker3", { effects: ["LineageEffect.m_u800_a", "LineageEffect.m_u024_b", "LineageEffect.m_u800_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, multi-target and individual NPC verification" });

// Engine.dll Init 0x7a0fa9 -> 0x7a14c0, selector 0x7a22ce=0 -> 0x79dc4d; Shot 0x7b16af=2 -> 0x7b0890.
nativeEffectBindings.set("s_clan_acumen_empower_berserker3", { effects: ["LineageEffect.m_u800_a", "LineageEffect.m_u024_b", "LineageEffect.m_u800_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, multi-target and individual NPC verification" });

// Engine.dll Init 0x7a1309, Shot 0x7af772, PreShot 0x7a43ac and Explosion 0x7916c2 reach default returns.
for (const name of ["s_clan_damage_shield3", "s_npc_weakness_strike8", "s_npc_hold_strike8", "s_npc_poison_strike8"])
    nativeEffectBindings.set(name, { effects: [], soundPhases: [], pending: "native phases have no particles or sound; hit/status reactions and full retail parity unverified" });

// Engine.dll Init selectors 0x7a2304..0x7a2306 -> 0x79c74b; PreShot 0x7a43ac, Shot 0x7b1680 and Explosion 0x7916c2 reach empty returns.
for (const name of ["s_balakas_lava_skin", "s_balakas_trample", "s_balakas_trample_4682"])
    nativeEffectBindings.set(name, { effects: [], soundPhases: [], pending: "native phases have no particles or sound; hit/buff/status visuals and full retail parity unverified" });

// Engine.dll Init 0x7a18a3/0x7a18ae; PreShot 0x7a43ac/0x7a4628; Shot 0x7af772/0x7b1680; Explosion 0x7918ca/0x7918d5, zero sound actor at 0x78ddd2/0x791afb.
for (const name of ["s_power_shot_boss_a_1c_1", "s_stun_shot_boss_a_2b_1", "s_spear_attack_boss_a_2b_7", "s_spear_attack_boss_a_1b_4", "s_spear_attack_boss_a_1c_2"])
    nativeEffectBindings.set(name, { effects: [], soundPhases: [], pending: "native phases have no particles or sound; full retail animation/timing and target reactions unverified" });

// Engine.dll Init 0x7a1309/0x7a1314; PreShot 0x7a43ac; Shot 0x7af772 or selector9 ->0x7b1680 ->0x7b0e38; Explosion 0x7916c2/0x791afb.
for (const name of ["s_npc_sonic_storm9", "s_npc_range_hit_down9", "s_npc_hex_shock9", "s_clan_berserker_might3", "s_npc_avoid_debuff9", "s_range_weakness9", "s_clan_berserker_haste2", "s_clan_acumen_shield3", "s_range_slow_strike3", "s_npc_hex_storm6", "s_clan_focus_acumen3", "s_npc_weakness_blaze_magic_only9"])
    nativeEffectBindings.set(name, { effects: [], soundPhases: [], pending: "native phases have no particles or sound; hit/status reactions and full retail animation/timing unverified" });

// Engine.dll SpawnNTransientEffect 0x79a59f -> 0x79a7e1 skips success and sound; NActionStop 0x750773.
for (const name of ["s_balakas_tail_stomp", "s_balakas_tail_stomp_4687", "s_quest_boss_big_body1", "s_quest_boss_dispel_big_body1", "s_super_haste"])
    nativeEffectBindings.set(name, { effects: [], soundPhases: [], rejectTransient: true });

// Engine.dll Init 0x79eac7 ->0x79c74b; PreShot selector0x7a45dc=1; Shot0x7b14f5=31; Explosion0x791dcf=9 (sound actor remains null).
nativeEffectBindings.set("s_soulless_mp_dot", { effects: [], soundPhases: [], pending: "zero-duration preview animation and retail packet timing; native phases have no particles or sound" });

const collisionBindings = new Map<string, NativeEffectBinding_T>([
    // Engine.dll Init0x79f5c8 and Shot0x7b0749 share the Sleep recipe; exported dispatch separates the empty Hate branch.
    ["s_npc_hate", nativeEffectBindings.get("s_npc_sleep")],
    ["e_none", { effects: [], soundPhases: [], pending: "zero-duration preview animation and retail packet timing; native phases have no particles or sound" }],
    ["s_bow", nativeEffectBindings.get("s_npc_bow_attack")],
    ["s_boss_stun_shot", nativeEffectBindings.get("s_stun_shot_boss_a_2c_1")],
    // Engine.dll Init 0x7a1220, PreShot 0x7a3de7, Shot 0x7af576, Explosion 0x7918db.
    ["s_boss_spear_stun", { effects: ["LineageEffect.s_u010_a", "LineageEffect.NSpear_sp", "LineageEffect.s_u505_c"], effectGroup: "bossSpearStun", soundPhases: ["casting", "shot", "explosion"], pending: "spear rendering, retail visual/timing and no-hit verification" }]
]);

// Engine.dll SpawnNTransientEffect: IDs2032/2037/2038/2048/2060/2063/2101/2102 ->0x798eaa, class0xaafc38.
nativeEffectBindings.set("e_healing_potion", { effects: ["LineageEffect.e_u002_a"], soundPhases: ["casting"] });

// Engine.dll SpawnNTransientEffect: IDs2031/2136 ->0x798e71, class0xaafc70.
nativeEffectBindings.set("e_lesser_healing_potion", { effects: ["LineageEffect.e_u001_a"], soundPhases: ["casting"] });

// Engine.dll SpawnNTransientEffect: IDs2011/2012/2034/2035/2103 share class0xaafc00 and spawn0x798ff2.
nativeEffectBindings.set("e_haste_potion", { effects: ["LineageEffect.e_u003_a"], soundPhases: ["casting"] });

// Engine.dll SpawnNTransientEffect IDs2042..2045 ->0x104c911e: e_u032_a and unscaled mesh Origin.Z in TrailerPrePivot.Z.
for (const name of ["s_bandage", "e_cure"])
    nativeEffectBindings.set(name, { effects: ["LineageEffect.e_u032_a"], soundPhases: ["casting"] });

// SpawnNTransientEffect 0x104ca6fa..0x104ca7dc: TrailerPrePivot.Z = -mesh Origin.Z.
nativeEffectBindings.set("e_appearance_change", { effects: ["LineageEffect.e_u004_a"], soundPhases: ["casting"] });

// Engine.dll ID2036: empty phase handlers; transient selector0x79a9d1 ->0x79a7e1 with edi=0.
// SpawnNTransientEffect selector15 sends IDs2065/2074/2075/2077 to0x104ca7e1 with edi=0.
// SpawnNTransientEffect rejects IDs2137..2139/2171..2176/2188/2189/2190/2208..2212/2229 at0x104ca7e1 with edi=0.
// SpawnNTransientEffect rejects enchant/package/fish records through0x104ca7e1 with edi=0.
// Engine.dll IDs2001/2002: unsigned selector rejection0x798e5d ->0x79a7e1; edi=0 skips sound and returns false.
nativeEffectBindings.set("e_rejected_transient", nativeEffectRecipes.get("e_rejected_transient"));

// SpawnNTransientEffect IDs60/337/1001/4338 reach0x79a7e1 with edi=0; none spawns an effect or sound.
for (const name of ["s_fake_death", "s_arcane_power", "s_soul_cry", "s_life_cubic_for_novice"])
    nativeEffectBindings.set(name, { effects: [], soundPhases: [], rejectTransient: true });

// Engine.dll ID4616: Init0x79c74b, PreShot0x7a3de7, Shot0x7b0e38, Explosion0x791ade; transient0x79a7e1 has edi=0.
nativeEffectBindings.set("s_fake_petrificiation", { effects: [], soundPhases: [], rejectTransient: true });

// Engine.dll ID4620: Init0x79c74b, PreShot0x7a3de7, Shot0x7b0e38, Explosion0x791ade.
nativeEffectBindings.set("s_paralysis_4620", { effects: [], soundPhases: [] });

export function getNativeEffectBinding(id: number): NativeEffectBinding_T {
    const name = nativeEffectIds.get(id), dispatch = nativeEffectDispatch.get(name);

    if (dispatch) {
        const binding = collisionBindings.get(dispatch);

        if (!binding) throw new Error(`Native skill '${id}' has no exported dispatch '${dispatch}'.`);

        return binding;
    }

    const binding = nativeEffectBindings.get(name);
    if (binding) return binding;

    return nativeEffectRecipes.get(nativeEffectHandlers.get(name));
}

export default nativeEffectBindings;
