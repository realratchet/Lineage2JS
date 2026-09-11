import type { NpcSkillEffectPhase_T } from "@l2js/engine/contracts/pawn";

type NativeSkillBinding_T = { effects: string[], effectGroup?: string, soundPhases: NpcSkillEffectPhase_T[], finalShotOnly?: boolean, rejectTransient?: boolean, pending?: string };

const nativeSkillBindings = new Map<string, NativeSkillBinding_T>([
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
for (const name of ["s_npc_aura_burn_magic_only", "s_npc_aura_burn_magic_only2", "s_npc_aura_burn_magic_only3", "s_npc_aura_burn_magic_only4", "s_npc_aura_burn_magic_only5", "s_npc_aura_burn_magic_only6", "s_npc_aura_burn_magic_only7", "s_npc_aura_burn_magic_only8", "s_npc_aura_burn_magic_only9", "s_npc_aura_burn_magic_only10"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u019_a", "LineageEffect.m_u019_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing verification" });

// Engine.dll Init table 0x7a20ac -> 0x79f4c1; Shot table 0x7b13b4 -> 0x7ae996; PreShot 0x7a40b9 returns.
for (const name of ["s_npc_burn", "s_npc_burn7", "s_npc_burn8", "s_npc_burn9"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u019_a", "LineageEffect.m_u019_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, multi-target and individual suffix verification" });

// Engine.dll Init 0x79f5c8; Shot 0x7b0749 -> 0x7b0811 -> 0x7a9753.
for (const name of ["s_npc_sleep", "s_npc_sleep3", "s_npc_sleep4", "s_npc_sleep5", "s_npc_sleep6", "s_npc_sleep7", "s_npc_sleep9"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u018_a", "LineageEffect.m_u018_b"], soundPhases: ["casting", "shot"] });

// Engine.dll Init 0x79fd84; Shot 0x7af786 -> 0x7af84c -> 0x7ac0c6.
for (const name of ["s_npc_hold", "s_npc_hold5", "s_npc_hold6", "s_npc_hold7", "s_range_hold_boss_a_", "s_range_hold_boss_a_2", "s_range_hold_boss_a_3", "s_range_hold_boss_a_4", "s_range_hold_boss_a_5", "s_range_hold_boss_a_6", "s_range_hold_boss_a_7", "s_range_hold_boss_a_9", "s_range_hold_boss_a_10"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u013_a", "LineageEffect.m_u013_c"], soundPhases: ["casting", "shot"] });

// Engine.dll Init selectors 0x7a2221/0x7a2231 and Shot selectors 0x7b15d9/0x7b15e9 share Hold.
for (const name of ["s_self_range_hold_boss_a_", "s_self_range_hold_boss_a_3", "s_self_range_hold_boss_a_4", "s_hold_boss_a_", "s_hold_boss_a_3", "s_hold_boss_a_6", "s_hold_boss_a_8"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u013_a", "LineageEffect.m_u013_c"], soundPhases: ["casting", "shot"], pending: "multi-target, retail visual/timing and individual NPC verification" });

// Engine.dll Init 0x79f9d0 -> 0x79fd84; Shot 0x7abe73 -> 0x7af786; PreShot bound 0x7a40b4 returns.
nativeSkillBindings.set("s_zaken_hold", { effects: ["LineageEffect.m_u013_a", "LineageEffect.m_u013_c"], soundPhases: ["casting", "shot"], pending: "retail visual/timing and multi-target verification" });

// Engine.dll Init table 0x7a2130 -> 0x79f5c8; Shot table 0x7b14bc -> 0x7b0749.
for (const name of ["s_npc_silence", "s_npc_silence6", "s_npc_silence7", "s_npc_silence8", "s_npc_silence9", "s_npc_berserker", "s_npc_berserker2", "s_npc_surrender_to_fire", "s_npc_surrender_to_fire2"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u018_a", "LineageEffect.m_u018_b"], soundPhases: ["casting", "shot"] });

// Engine.dll Init 0x79ebae with FNPawnLight 0x79ed26; Shot 0x7ac39f.
for (const name of ["s_npc_slow", "s_npc_slow2", "s_npc_slow3", "s_single_poison", "s_single_poison6", "s_single_poison7", "s_single_poison8", "s_single_poison9"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u007_a", "LineageEffect.m_u007_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing verification" });

// Engine.dll Init selector 0x7a2177 -> 0x79ebae; Shot selector 0x7b14de -> 0x7ac39f.
for (const name of ["s_npc_paralyze", "s_npc_paralyze3", "s_npc_paralyze4", "s_npc_paralyze5", "s_npc_paralyze6", "s_npc_paralyze7", "s_npc_paralyze8", "s_npc_paralyze9"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u007_a", "LineageEffect.m_u007_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, status reaction, multi-target and individual NPC verification" });

// Engine.dll Init 0x79fabf; Shot 0x7ac52a; PreShot 0x7a43a4 and Explosion 0x791ade return.
for (const name of ["s_summon_range_poison", "s_summon_range_poison8", "s_summon_range_poison9", "s_summon_range_poison10", "s_summon_range_poison11", "s_summon_range_poison12"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u021_a", "LineageEffect.m_u021_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, multi-target and individual NPC verification" });

// Engine.dll Init 0x79fbde; Shot 0x7ad619 / 0x7ad71e -> 0x7ac0c6.
for (const name of ["s_npc_hydro_blast_magic_only", "s_npc_hydro_blast_magic_only2", "s_npc_hydro_blast_magic_only3", "s_npc_hydro_blast_magic_only4", "s_npc_hydro_blast_magic_only5", "s_npc_hydro_blast_magic_only6", "s_npc_hydro_blast_magic_only7", "s_npc_hydro_blast_magic_only8", "s_npc_hydro_blast_magic_only9", "s_npc_hydro_blast_magic_only10", "s_npc_hydro_blast", "s_npc_hydro_blast8", "s_npc_hydro_blast9", "s_npc_hydro_blast10", "s_npc_hydro_blast11", "s_npc_hydro_blast12"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u033_a", "LineageEffect.m_u033_b"], soundPhases: ["casting", "shot"], pending: "full retail visual and timing parity" });

// Engine.dll Init 0x79e2b7 -> 0x7a131a; Shot 0x7a8bba / 0x7abe73 -> 0x7afafb.
for (const name of ["s_blood_sucking", "s_blood_sucking4", "s_blood_sucking7", "s_blood_sucking8", "s_blood_sucking9", "s_summon_blood_sucking", "s_summon_blood_sucking8", "s_summon_blood_sucking9", "s_summon_blood_sucking10", "s_summon_blood_sucking11", "s_summon_blood_sucking12"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u003_a", "LineageEffect.m_u003_c", "LineageEffect.m_u003_b"], soundPhases: ["casting", "shot"], pending: "retail return-path and full visual/timing verification" });

// Engine.dll Init 0x7a20d2 -> 0x7a131a; Shot 0x7a87b2 -> 0x7afafb; PreShot 0x7a40b9 returns.
nativeSkillBindings.set("s_mana_sucking", { effects: ["LineageEffect.m_u003_a", "LineageEffect.m_u003_c", "LineageEffect.m_u003_b"], soundPhases: ["casting", "shot"], pending: "retail return-path, visual/timing and individual NPC verification" });

// Engine.dll Init selector 0x7a2144 -> 0x7a06db; Shot selector 0x7b142a -> 0x7adcef; Explosion 0x79042a.
for (const name of ["s_npc_twister", "s_npc_twister9"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u026_a", "LineageEffect.m_u026_b", "LineageEffect.m_u026_c", "LineageEffect.m_u026_d"], soundPhases: ["casting", "shot", "explosion"], pending: "retail visual/timing, no-hit-actor, collision and individual NPC verification" });

// Engine.dll Init 0x7a0558; Shot 0x7adbab requires FinalShot; Explosion 0x78f351/0x790963.
for (const name of ["s_mega_storm_strike", "s_summon_mega_storm_strike8", "s_summon_mega_storm_strike9", "s_summon_mega_storm_strike10", "s_summon_mega_storm_strike11", "s_summon_mega_storm_strike12"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u000_a", "LineageEffect.m_u000_b", "LineageEffect.m_u000_c", "LineageEffect.m_u000_d"], soundPhases: ["casting", "shot", "explosion"], finalShotOnly: true, pending: "retail visual/timing, low-frame-rate ordering and collision parity; individual summon variants" });

// Engine.dll Init 0x79c74b; Shot 0x7a9288..0x7a95dd; PreShot 0x7a3de7.
nativeSkillBindings.set("s_siege_hammer", { effects: ["LineageEffect.p_u004_a"], effectGroup: "siegeHammer", soundPhases: [], pending: "owner-conditioned native view shake, retail visual/timing and individual NPC verification" });

// Engine.dll Init 0x79ff2a; Shot 0x7ada66 / 0x7adb2c; PreShot 0x7a459a -> 0x7a3de7.
for (const name of ["s_self_haste", "s_self_haste2"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u004_a", "LineageEffect.m_u004_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, multi-target and individual NPC verification" });

// Engine.dll Init 0x79e67a; Shot 0x7a95fa; PreShot 0x7a40b9 and Explosion 0x78f3f8 return.
for (const name of ["s_self_might", "s_self_might3", "s_self_shield", "s_self_shield3"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.s_u005_a", "LineageEffect.s_u005_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, multi-target and individual NPC verification" });

// Engine.dll Init 0x79f3ee; Shot 0x7ae84c; PreShot 0x7a45ae -> 0x7a3de7 returns.
for (const name of ["s_npc_cancel", "s_npc_cancel5", "s_npc_cancel6", "s_npc_cancel7"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u016_a", "LineageEffect.m_u016_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, multi-target and individual suffix verification" });

// Engine.dll Init 0x7a02f2; Shot 0x7ac80f requires FinalShot; Explosion 0x790a86.
for (const name of ["s_npc_blaze", "s_npc_blaze5", "s_npc_blaze_magic_only", "s_npc_blaze_magic_only3", "s_npc_blaze_magic_only4", "s_npc_blaze_magic_only5", "s_npc_blaze_magic_only6", "s_npc_blaze_magic_only7", "s_npc_blaze_magic_only8", "s_npc_blaze_magic_only9", "s_npc_prominence", "s_npc_prominence9", "s_npc_prominence_magic_only", "s_npc_prominence_magic_only6", "s_npc_prominence_magic_only7", "s_npc_prominence_magic_only8", "s_npc_prominence_magic_only9", "s_npc_prominence_for_slow"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u006_a", "LineageEffect.m_u006_b", "LineageEffect.m_u006_c", "LineageEffect.m_u006_e"], soundPhases: ["casting", "shot", "explosion"], finalShotOnly: true, pending: "retail visual/timing, no-hit-actor and collision verification; individual suffix variants" });

// Engine.dll Init 0x7a02f2; Shot 0x7ac80f; Explosion 0x78f3fe -> 0x791295.
for (const name of ["s_npc_flame_strike", "s_npc_flame_strike7", "s_npc_flame_strike9"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u006_a", "LineageEffect.m_u006_b", "LineageEffect.m_u006_c", "LineageEffect.m_u006_e", "LineageEffect.m_u006_d"], effectGroup: "flameStrike", soundPhases: ["casting", "shot", "explosion"], finalShotOnly: true, pending: "retail visual/timing, secondary targets, no-hit-actor and collision verification; individual NPC variants" });

// Engine.dll Init 0x7a131a; Shot 0x7a99b2..0x7a9bc5; PreShot returns at 0x7a3de7.
for (const name of ["s_npc_corpse_burst", "s_npc_corpse_burst6", "s_npc_corpse_burst7", "s_npc_corpse_burst8", "s_npc_corpse_burst9", "s_npc_corpse_burst10", "s_npc_corpse_burst11", "s_npc_corpse_burst12"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u003_a", "LineageEffect.m_u006_e", "LineageEffect.m_u006_d"], effectGroup: "corpseBurst", soundPhases: ["casting", "shot"], pending: "retail visual/timing, secondary targets, corpse targeting and individual suffix verification" });

// Engine.dll Init 0x79e483; Shot 0x7a8ef6; PreShot 0x7a40b9 returns.
nativeSkillBindings.set("s_cat_recharge", { effects: ["LineageEffect.m_u022_a", "LineageEffect.m_u022_b"], soundPhases: ["casting", "shot"], pending: "retail visual/timing and individual NPC verification" });

// Engine.dll Init selector 0x7a2163 -> 0x79f76e; Shot selector 0x7b14ca -> 0x7aef96.
for (const name of ["s_npc_life_chant", "s_npc_life_chant6"])
    nativeSkillBindings.set(name, { effects: ["LineageEffect.m_u024_a", "LineageEffect.m_u024_b", "LineageEffect.m_u024_c"], soundPhases: ["casting", "shot"], pending: "retail visual/timing, multi-target and individual NPC verification" });

// Engine.dll Init 0x7a1309, Shot 0x7af772, PreShot 0x7a43ac and Explosion 0x7916c2 reach default returns.
for (const name of ["s_npc_hold_strike3", "s_npc_hold_strike4", "s_npc_hold_strike5", "s_npc_hold_strike6", "s_npc_hold_strike7", "s_npc_hold_strike8", "s_npc_hold_strike9"])
    nativeSkillBindings.set(name, { effects: [], soundPhases: [], pending: "native phases have no particles or sound; hit/status reactions and full retail parity unverified" });

// Engine.dll SpawnNTransientEffect 0x79a59f -> 0x79a7e1 skips success and sound; NActionStop 0x750773.
for (const name of ["balakas tail stomp", "s_quest_boss_big_body1", "s_quest_boss_dispel_big_body1"])
    nativeSkillBindings.set(name, { effects: [], soundPhases: [], rejectTransient: true });

export default nativeSkillBindings;
