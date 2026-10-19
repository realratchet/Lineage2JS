import type { NativeSkillBinding_T } from "./native-skill-bindings";

const nativeSkillRecipes = new Map<string, NativeSkillBinding_T>([
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a13ed / 0x7a3de7 / 0x7a5035 / 0x791ade.
    ["s_drain_health", { effects: ["LineageEffect.s_u019_a", "LineageEffect.s_u019_b", "LineageEffect.s_u019_c"], effectGroup: "drainHealth", soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79c9b4 / 0x7a3de7 / 0x7a6d16 / 0x791ade.
    ["s_sanctuary", { effects: ["LineageEffect.m_u030_a", "LineageEffect.m_u030_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79c3f4 / 0x7a3de7 / 0x7a5e62 / 0x791ade.
    ["s_life_scavenge", { effects: ["LineageEffect.s_u020_a", "LineageEffect.s_u020_b", "LineageEffect.s_u020_c"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79f2ca / 0x7a3de7 / 0x7ac244 / 0x791ade.
    ["s_blaze_quake", { effects: ["LineageEffect.m_u027_a", "LineageEffect.m_u027_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79d205 / 0x7a3de7 / 0x7a880c / 0x791ade.
    ["s_party_recall", { effects: ["LineageEffect.e_u031_a", "LineageEffect.e_u005_a"], effectGroup: "partyRecall", associatedActors: true, soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79dc4d / 0x7a3de7 / 0x7b0890 / 0x791ade.
    ["s_chant_of_spirit", { effects: ["LineageEffect.m_u800_a", "LineageEffect.m_u024_b", "LineageEffect.m_u800_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a1220 / 0x7a3de7 / 0x7ac80f / 0x790a86.
    ["s_burning_fist", { effects: ["LineageEffect.s_u010_a", "LineageEffect.m_u006_c", "LineageEffect.m_u006_e"], finalShotOnly: true, soundPhases: ["casting", "shot", "explosion"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79e1d0 / 0x7a3de7 / 0x7a88f0 / 0x791ade.
    ["s_spoil", { effects: ["LineageEffect.s_u007_a", "LineageEffect.s_u007_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79dede / 0x7a3de7 / 0x7a8360 / 0x791ade.
    ["s_resurrection", { effects: ["LineageEffect.m_u023_a", "LineageEffect.m_u023_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79ddae / 0x7a3de7 / 0x7a880c / 0x791ade.
    ["s_devastated_recall", { effects: ["LineageEffect.e_u031_a", "LineageEffect.e_u005_a"], effectGroup: "recall", associatedActors: true, soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79d565 / 0x7a3de7 / 0x7a8ef6 / 0x791ade.
    ["s_seed_of_fire", { effects: ["LineageEffect.m_u006_a", "LineageEffect.m_u022_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79d62b / 0x7a3de7 / 0x7a8ef6 / 0x791ade.
    ["s_seed_of_wind", { effects: ["LineageEffect.m_u038_a", "LineageEffect.m_u022_b"], effectGroup: "seedWind", soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79dcba / 0x7a3de7 / 0x7a818c / 0x791ade.
    ["s_bless_shield", { effects: ["LineageEffect.m_u044_a", "LineageEffect.m_u044_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a1220 / 0x7a3de7 / 0x7b0e38 / 0x791ade.
    ["s_physical_casting", { effects: ["LineageEffect.s_u010_a"], soundPhases: ["casting"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79c74b / 0x7a3de7 / 0x7b0e38 / 0x791ade.
    ["e_none", { effects: [], soundPhases: [] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a1220 / 0x7a3de7 / 0x7adbab / 0x78f351.
    ["s_force_blaster", { effects: ["LineageEffect.s_u010_a", "LineageEffect.m_u000_c", "LineageEffect.m_u000_d"], finalShotOnly: true, soundPhases: ["casting", "shot", "explosion"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a131a / 0x7a3de7 / 0x7adbab / 0x78f351.
    ["s_death_spike", { effects: ["LineageEffect.m_u003_a", "LineageEffect.m_u000_c", "LineageEffect.m_u000_d"], finalShotOnly: true, soundPhases: ["casting", "shot", "explosion"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a131a / 0x7a3de7 / 0x7ac80f / 0x790a86.
    ["s_curse_death_link", { effects: ["LineageEffect.m_u003_a", "LineageEffect.m_u006_c", "LineageEffect.m_u006_e"], finalShotOnly: true, soundPhases: ["casting", "shot", "explosion"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a1220 / 0x7a3de7 / 0x7ac80f / 0x78f3fe.
    ["s_force_storm", { effects: ["LineageEffect.s_u010_a", "LineageEffect.m_u006_c", "LineageEffect.m_u006_e", "LineageEffect.m_u006_d"], effectGroup: "flameStrike", finalShotOnly: true, soundPhases: ["casting", "shot", "explosion"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a17a8 / 0x7a43c0 / 0x7afa26 / 0x78f3fe.
    ["s_burst_shot", { effects: ["LineageEffect.s_u003_a", "LineageEffect.s_u003_d", "LineageEffect.s_u003_b", "LineageEffect.m_u006_e", "LineageEffect.m_u006_d"], effectGroup: "flameStrike", soundPhases: ["casting", "shot", "explosion"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a1220 / 0x7a43c0 / 0x7afa26 / 0x7916c7.
    ["s_fatal_counter", { effects: ["LineageEffect.s_u010_a", "LineageEffect.s_u003_d", "LineageEffect.s_u003_b", "LineageEffect.p_u004_a"], effectGroup: "bow", soundPhases: ["casting", "shot", "explosion"] }],
    // ANCubics::NCubicSkillProcess 0x78b50f spawns m_u000_c for Cubic Drain.
    ["s_cubic_drain", { effects: ["LineageEffect.m_u000_c"], soundPhases: ["shot"] }],
    // ANCubics::NCubicSkillProcess 0x78b61c spawns m_u003_c for Vampiric Cubic.
    ["s_cubic_vampiric", { effects: ["LineageEffect.m_u003_c"], soundPhases: ["shot"] }],
    // ANCubics::NCubicSkillProcess 0x78bd48 spawns m_u001_b for Life Cubic.
    ["s_cubic_heal", { effects: ["LineageEffect.m_u001_b"], soundPhases: ["shot"] }],
    // ANCubics::NCubicSkillProcess 0x78be60 spawns m_u007_b for Viper and Binding Cubics.
    ["s_cubic_poison", { effects: ["LineageEffect.m_u007_b"], soundPhases: ["shot"] }],
    ["s_cubic_poltergeist", { effects: ["LineageEffect.m_u018_b"], soundPhases: ["shot"] }],
    ["s_cubic_binding", { effects: ["LineageEffect.m_u007_b"], soundPhases: ["shot"] }],
    // ANCubics::NCubicSkillProcess 0x78bb19 uses m_u037_d for Aqua Cubic.
    ["s_cubic_aqua", { effects: ["LineageEffect.m_u037_d"], soundPhases: ["shot"] }],
    // ANCubics::NCubicSkillProcess 0x78bc7b spawns s_u011_a for Spark Cubic.
    ["s_cubic_spark", { effects: ["LineageEffect.s_u011_a"], soundPhases: ["shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79c770 / 0x7a3de7 / 0x7a7b08 / 0x791ade.
    ["s_chant_of_shielding", { effects: ["LineageEffect.m_u034_a", "LineageEffect.m_u034_b", "LineageEffect.m_u034_c"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79e58b / 0x7a3de7 / 0x7a8fa4 / 0x791ade.
    ["s_curse_weakness", { effects: ["LineageEffect.m_u007_a", "LineageEffect.m_u007_b"], effectGroup: "npcWeakness", soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a19d8 / 0x7a3de7 / 0x7b0e38 / 0x791ade.
    ["s_summon", { effects: ["LineageEffect.e_u011_a"], soundPhases: ["casting"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79bf3d / 0x7a3de7 / 0x7a5958 / 0x791ade.
    ["s_ultimate_defense", { effects: ["LineageEffect.s_u017_a", "LineageEffect.s_u017_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79cb05 / 0x7a3de7 / 0x7a6bd1 / 0x791ade.
    ["s_disrupt_undead", { effects: ["LineageEffect.m_u017_a", "LineageEffect.m_u017_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79fcb1 / 0x7a3de7 / 0x7ad7d6 / 0x791ade.
    ["s_shield", { effects: ["LineageEffect.m_u008_a", "LineageEffect.m_u008_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79c74b / 0x7a3de7 / 0x7a644d / 0x791ade.
    ["s_song", { effects: ["LineageEffect.s_u009_a"], soundPhases: ["shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79c74b / 0x7a3de7 / 0x7a64bd / 0x791ade.
    ["s_dance", { effects: ["LineageEffect.s_u012_a"], soundPhases: ["shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79c21d / 0x7a3de7 / 0x7a499c / 0x791ade.
    ["s_triple_slash", { effects: ["LineageEffect.s_u010_b", "LineageEffect.s_u010_a"], effectGroup: "tripleSlash", soundPhases: ["casting"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79c21d / 0x7a3de7 / 0x7a5a9d / 0x791ade.
    ["s_sonic_slash", { effects: ["LineageEffect.s_u010_b", "LineageEffect.s_u010_a", "LineageEffect.s_u015_b"], effectGroup: "sonicSlash", soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79c010 / 0x7a3de7 / 0x7ae49b / 0x791ade.
    ["s_power_smash", { effects: ["LineageEffect.s_u010_b", "LineageEffect.s_u010_a", "LineageEffect.p_u004_a"], finalShotOnly: true, soundPhases: ["casting", "shot"], pending: "secondary weapon RibbonSet attachment" }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79e2c5 / 0x7a3de7 / 0x7ae49b / 0x791ade.
    ["s_power_strike", { effects: ["LineageEffect.s_u002_a", "LineageEffect.p_u004_a"], finalShotOnly: true, soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79e483 / 0x7a3de7 / 0x7a8ef6 / 0x791ade.
    ["s_recharge", { effects: ["LineageEffect.m_u022_a", "LineageEffect.m_u022_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79f5c8 / 0x7a3de7 / 0x7b0749 / 0x791ade.
    ["s_sleep", { effects: ["LineageEffect.m_u018_a", "LineageEffect.m_u018_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79f69b / 0x7a3de7 / 0x7aee51 / 0x791ade.
    ["s_dash", { effects: ["LineageEffect.s_u016_a", "LineageEffect.s_u016_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a17a8 / 0x7a43c0 / 0x7afa26 / 0x7916c7.
    ["s_power_shot", { effects: ["LineageEffect.s_u003_a", "LineageEffect.s_u003_d", "LineageEffect.s_u003_b", "LineageEffect.p_u004_a"], effectGroup: "bow", soundPhases: ["casting", "shot", "explosion"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79e67a / 0x7a3de7 / 0x7a95fa / 0x791ade.
    ["s_war_cry", { effects: ["LineageEffect.s_u005_a", "LineageEffect.s_u005_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a1220 / 0x7a3de7 / 0x7ae0ea / 0x791ade.
    ["s_shield_stun", { effects: ["LineageEffect.s_u010_a", "LineageEffect.p_u004_a"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a18b4 / 0x7a43c0 / 0x7af8cb / 0x7918db.
    ["s_stun_shot", { effects: ["LineageEffect.s_u505_a", "LineageEffect.s_u003_d", "LineageEffect.s_u505_b", "LineageEffect.s_u003_b", "LineageEffect.s_u505_c"], effectGroup: "bossStunShot", soundPhases: ["casting", "shot", "explosion"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79ebae / 0x7a3de7 / 0x7ac39f / 0x791ade.
    ["s_poison", { effects: ["LineageEffect.m_u007_a", "LineageEffect.m_u007_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79ff2a / 0x7a3de7 / 0x7ada66 / 0x791ade.
    ["s_might", { effects: ["LineageEffect.m_u004_a", "LineageEffect.m_u004_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79e02a / 0x7a3de7 / 0x7a8626 / 0x791ade.
    ["s_regeneration", { effects: ["LineageEffect.m_u014_a", "LineageEffect.m_u014_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79f3ee / 0x7a3de7 / 0x7ae84c / 0x791ade.
    ["s_empower", { effects: ["LineageEffect.m_u016_a", "LineageEffect.m_u016_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79fe57 / 0x7a3de7 / 0x7ad91b / 0x791ade.
    ["s_haste", { effects: ["LineageEffect.m_u036_a", "LineageEffect.m_u036_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a131a / 0x7a3de7 / 0x7afafb / 0x791ade.
    ["s_vampiric_touch", { effects: ["LineageEffect.m_u003_a", "LineageEffect.m_u003_c", "LineageEffect.m_u003_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79fabf / 0x7a3de7 / 0x7ac52a / 0x791ade.
    ["s_poisonous_cloud", { effects: ["LineageEffect.m_u021_a", "LineageEffect.m_u021_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79f4c1 / 0x7a3de7 / 0x7ae996 / 0x791ade.
    ["s_aura_burn", { effects: ["LineageEffect.m_u019_a", "LineageEffect.m_u019_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a0558 / 0x7a3de7 / 0x7adbab / 0x78f351.
    ["s_wind_strike", { effects: ["LineageEffect.m_u000_a", "LineageEffect.m_u000_b", "LineageEffect.m_u000_c", "LineageEffect.m_u000_d"], finalShotOnly: true, soundPhases: ["casting", "shot", "explosion"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a06db / 0x7a3de7 / 0x7adcef / 0x79042a.
    ["s_twister", { effects: ["LineageEffect.m_u026_a", "LineageEffect.m_u026_b", "LineageEffect.m_u026_c", "LineageEffect.m_u026_d"], soundPhases: ["casting", "shot", "explosion"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a02f2 / 0x7a3de7 / 0x7ac80f / 0x78f3fe.
    ["s_flame_strike", { effects: ["LineageEffect.m_u006_a", "LineageEffect.m_u006_b", "LineageEffect.m_u006_c", "LineageEffect.m_u006_e", "LineageEffect.m_u006_d"], effectGroup: "flameStrike", finalShotOnly: true, soundPhases: ["casting", "shot", "explosion"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79e0fd / 0x7a3de7 / 0x7a84c7 / 0x791ade.
    ["s_wind_walk", { effects: ["LineageEffect.m_u010_a", "LineageEffect.m_u010_c"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79fd84 / 0x7a3de7 / 0x7af786 / 0x791ade.
    ["s_dryad_root", { effects: ["LineageEffect.m_u013_a", "LineageEffect.m_u013_c"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79ed7e / 0x7a3de7 / 0x7ac6ac / 0x791ade.
    ["s_wind_shackle", { effects: ["LineageEffect.m_u009_a", "LineageEffect.m_u009_c"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79cbf6 / 0x7a3de7 / 0x7a6e34 / 0x791ade.
    ["s_greater_heal", { effects: ["LineageEffect.m_u032_a", "LineageEffect.m_u032_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a02f2 / 0x7a3de7 / 0x7ac80f / 0x790a86.
    ["s_blaze", { effects: ["LineageEffect.m_u006_a", "LineageEffect.m_u006_b", "LineageEffect.m_u006_c", "LineageEffect.m_u006_e"], finalShotOnly: true, soundPhases: ["casting", "shot", "explosion"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a1220 / 0x7a3de7 / 0x7ae49b / 0x791ade.
    ["s_stunning_fist", { effects: ["LineageEffect.s_u010_a", "LineageEffect.p_u004_a"], finalShotOnly: true, soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79f76e / 0x7a3de7 / 0x7aef96 / 0x791ade.
    ["s_chant_of_life", { effects: ["LineageEffect.m_u024_a", "LineageEffect.m_u024_b", "LineageEffect.m_u024_c"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a0b7e / 0x7a3de7 / 0x7af286 / 0x791ade.
    ["s_seal", { effects: ["LineageEffect.m_u025_a", "LineageEffect.m_u025_b", "LineageEffect.m_u025_c"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79ddae / 0x7a3de7 / 0x7abe91 / 0x791ade.
    ["s_return", { effects: ["LineageEffect.e_u031_a", "LineageEffect.e_u005_a"], effectGroup: "zakenSelfTel", soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a131a / 0x7a3de7 / 0x7a99b2 / 0x791ade.
    ["s_corpse_burst", { effects: ["LineageEffect.m_u003_a", "LineageEffect.m_u006_e", "LineageEffect.m_u006_d"], effectGroup: "corpseBurst", soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79fbde / 0x7a3de7 / 0x7ad619 / 0x791ade.
    ["s_hydro_blast", { effects: ["LineageEffect.m_u033_a", "LineageEffect.m_u033_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a0915 / 0x7a3de7 / 0x7ade48 / 0x7905eb.
    ["s_hurricane", { effects: ["LineageEffect.m_u038_a", "LineageEffect.m_u038_b", "LineageEffect.m_u038_c", "LineageEffect.m_u038_d"], soundPhases: ["casting", "shot", "explosion"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79eadb / 0x7a3de7 / 0x7abf6e / 0x791ade.
    ["s_heal", { effects: ["LineageEffect.m_u001_a", "LineageEffect.m_u001_b"], effectGroup: "heal", soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79d3dd / 0x7a3de7 / 0x7a6f9b / 0x78ebbc.
    ["s_chill_flame", { effects: ["LineageEffect.m_u028_a", "LineageEffect.m_u028_b", "LineageEffect.m_u028_c"], soundPhases: ["casting", "shot", "explosion"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79bc21 / 0x7a3de7 / 0x7a57a1 / 0x791ade.
    ["s_mortal_blow", { effects: ["LineageEffect.s_u001_a", "LineageEffect.s_u001_b"], soundPhases: ["casting", "shot"], pending: "secondary weapon RibbonSet attachment" }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a1220 / 0x7a3de7 / 0x7a57a1 / 0x791ade.
    ["s_deadly_blow", { effects: ["LineageEffect.s_u010_a", "LineageEffect.s_u001_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79bd1b / 0x7a3de7 / 0x7a4dfe / 0x791ade.
    ["s_iron_punch", { effects: ["LineageEffect.s_u006_a", "LineageEffect.s_u006_b"], finalShotOnly: true, soundPhases: ["casting", "shot"], pending: "light type 7 target pawn light at 0x7a4f3c; FNPawnLight+0x50/+0x51 are never initialized" }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a1220 / 0x7a3de7 / 0x7a49d4 / 0x78de2c.
    ["s_sonic_blaster", { effects: ["LineageEffect.s_u010_a", "LineageEffect.s_u015_a", "LineageEffect.s_u015_b"], effectGroup: "sonicBlaster", finalShotOnly: true, soundPhases: ["casting", "shot", "explosion"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a1220 / 0x7a3de7 / 0x7a49d4 / 0x78dfed.
    ["s_sonic_storm", { effects: ["LineageEffect.s_u010_a", "LineageEffect.s_u015_a", "LineageEffect.s_u015_b", "LineageEffect.m_u006_d"], effectGroup: "sonicStorm", finalShotOnly: true, soundPhases: ["casting", "shot", "explosion"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a1220 / 0x7a3de7 / 0x7a5359 / 0x791ade.
    ["s_sonic_buster", { effects: ["LineageEffect.s_u010_a", "LineageEffect.m_u006_d", "LineageEffect.m_u006_e"], effectGroup: "sonicBuster", associatedActors: true, soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a1220 / 0x7a3de7 / 0x7a534c / 0x791ade.
    ["s_poison_blade_dance", { effects: ["LineageEffect.s_u010_a", "LineageEffect.m_u006_d", "LineageEffect.m_u006_e"], effectGroup: "sonicBuster", associatedActors: true, finalShotOnly: true, soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a1220 / 0x7a3de7 / 0x7a54c7 / 0x791ade.
    ["s_force_buster", { effects: ["LineageEffect.s_u010_a", "LineageEffect.m_u006_e"], effectGroup: "forceBuster", finalShotOnly: true, soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a1220 / 0x7a3de7 / 0x7a7df6 / 0x791ade.
    ["s_lightning_strike", { effects: ["LineageEffect.s_u010_a", "LineageEffect.s_u011_a"], soundPhases: ["casting", "shot"], pending: "light type 7 target pawn lights at 0x7a7ef0/0x7a80ab; FNPawnLight+0x50/+0x51 are never initialized" }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79ba50 / 0x7a43c0 / 0x7afa26 / 0x7916c7.
    ["s_double_shot", { effects: ["LineageEffect.s_u010_a", "LineageEffect.s_u003_a", "LineageEffect.s_u003_d", "LineageEffect.s_u003_b", "LineageEffect.p_u004_a"], effectGroup: "bow", soundPhases: ["casting", "shot", "explosion"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a1220 / 0x7a43c0 / 0x7afa26 / 0x78e963.
    ["s_evade_shot", { effects: ["LineageEffect.s_u010_a", "LineageEffect.s_u003_d", "LineageEffect.s_u003_b", "LineageEffect.sp_agility_ta"], effectGroup: "evadeShot", soundPhases: ["casting", "shot", "explosion"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79c505 / 0x7a3e0d / 0x7a67de / 0x78e755.
    ["s_lethal_shot", { effects: ["LineageEffect.s_u509_a", "LineageEffect.s_u003_d", "LineageEffect.s_u509_d", "LineageEffect.s_u509_c", "LineageEffect.s_u509_b", "LineageEffect.s_u509_e"], effectGroup: "lethalShot", soundPhases: ["casting", "shot", "explosion"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79c5fb / 0x7a3de7 / 0x7a6578 / 0x791ade.
    ["s_armor_crush", { effects: ["LineageEffect.s_u513_a", "LineageEffect.s_u513_b", "LineageEffect.s_u513_c"], soundPhases: ["casting", "shot"] }],
]);

// Engine.dll SpawnNTransientEffect 0x104c9309..0x104ca7e1 returns false without an effect or sound.
nativeSkillRecipes.set("e_rejected_transient", { effects: [], soundPhases: [], rejectTransient: true });

export default nativeSkillRecipes;
