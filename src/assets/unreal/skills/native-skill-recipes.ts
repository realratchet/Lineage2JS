import type { NativeSkillBinding_T } from "./native-skill-bindings";

const nativeSkillRecipes = new Map<string, NativeSkillBinding_T>([
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a13ed / 0x7a3de7 / 0x7a5035 / 0x791ade.
    ["drainHealth", { effects: ["LineageEffect.s_u019_a", "LineageEffect.s_u019_b", "LineageEffect.s_u019_c"], effectGroup: "drainHealth", soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79c9b4 / 0x7a3de7 / 0x7a6d16 / 0x791ade.
    ["sanctuary", { effects: ["LineageEffect.m_u030_a", "LineageEffect.m_u030_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79c3f4 / 0x7a3de7 / 0x7a5e62 / 0x791ade.
    ["lifeScavenge", { effects: ["LineageEffect.s_u020_a", "LineageEffect.s_u020_b", "LineageEffect.s_u020_c"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79f2ca / 0x7a3de7 / 0x7ac244 / 0x791ade.
    ["blazeQuake", { effects: ["LineageEffect.m_u027_a", "LineageEffect.m_u027_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79d205 / 0x7a3de7 / 0x7a880c / 0x791ade.
    ["partyRecall", { effects: ["LineageEffect.e_u031_a", "LineageEffect.e_u005_a"], effectGroup: "partyRecall", associatedActors: true, soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79dc4d / 0x7a3de7 / 0x7b0890 / 0x791ade.
    ["chantOfSpirit", { effects: ["LineageEffect.m_u800_a", "LineageEffect.m_u024_b", "LineageEffect.m_u800_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a1220 / 0x7a3de7 / 0x7ac80f / 0x790a86.
    ["burningFist", { effects: ["LineageEffect.s_u010_a", "LineageEffect.m_u006_c", "LineageEffect.m_u006_e"], finalShotOnly: true, soundPhases: ["casting", "shot", "explosion"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79e1d0 / 0x7a3de7 / 0x7a88f0 / 0x791ade.
    ["spoil", { effects: ["LineageEffect.s_u007_a", "LineageEffect.s_u007_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79dede / 0x7a3de7 / 0x7a8360 / 0x791ade.
    ["resurrection", { effects: ["LineageEffect.m_u023_a", "LineageEffect.m_u023_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79ddae / 0x7a3de7 / 0x7a880c / 0x791ade.
    ["devastatedRecall", { effects: ["LineageEffect.e_u031_a", "LineageEffect.e_u005_a"], effectGroup: "recall", associatedActors: true, soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79d565 / 0x7a3de7 / 0x7a8ef6 / 0x791ade.
    ["seedOfFire", { effects: ["LineageEffect.m_u006_a", "LineageEffect.m_u022_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79d62b / 0x7a3de7 / 0x7a8ef6 / 0x791ade.
    ["seedOfWind", { effects: ["LineageEffect.m_u038_a", "LineageEffect.m_u022_b"], effectGroup: "seedWind", soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79dcba / 0x7a3de7 / 0x7a818c / 0x791ade.
    ["blessShield", { effects: ["LineageEffect.m_u044_a", "LineageEffect.m_u044_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79c74b / 0x7a3de7 / 0x7b0e38 / 0x791ade.
    ["empty", { effects: [], soundPhases: [] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a1220 / 0x7a3de7 / 0x7adbab / 0x78f351.
    ["forceBlaster", { effects: ["LineageEffect.s_u010_a", "LineageEffect.m_u000_c", "LineageEffect.m_u000_d"], finalShotOnly: true, soundPhases: ["casting", "shot", "explosion"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a131a / 0x7a3de7 / 0x7adbab / 0x78f351.
    ["deathSpike", { effects: ["LineageEffect.m_u003_a", "LineageEffect.m_u000_c", "LineageEffect.m_u000_d"], finalShotOnly: true, soundPhases: ["casting", "shot", "explosion"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a131a / 0x7a3de7 / 0x7ac80f / 0x790a86.
    ["curseDeathLink", { effects: ["LineageEffect.m_u003_a", "LineageEffect.m_u006_c", "LineageEffect.m_u006_e"], finalShotOnly: true, soundPhases: ["casting", "shot", "explosion"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a1220 / 0x7a3de7 / 0x7ac80f / 0x78f3fe.
    ["forceStorm", { effects: ["LineageEffect.s_u010_a", "LineageEffect.m_u006_c", "LineageEffect.m_u006_e", "LineageEffect.m_u006_d"], effectGroup: "flameStrike", finalShotOnly: true, soundPhases: ["casting", "shot", "explosion"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a17a8 / 0x7a43c0 / 0x7afa26 / 0x78f3fe.
    ["burstShot", { effects: ["LineageEffect.s_u003_a", "LineageEffect.s_u003_d", "LineageEffect.s_u003_b", "LineageEffect.m_u006_e", "LineageEffect.m_u006_d"], effectGroup: "flameStrike", soundPhases: ["casting", "shot", "explosion"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a1220 / 0x7a43c0 / 0x7afa26 / 0x7916c7.
    ["fatalCounter", { effects: ["LineageEffect.s_u010_a", "LineageEffect.s_u003_d", "LineageEffect.s_u003_b", "LineageEffect.p_u004_a"], effectGroup: "bow", soundPhases: ["casting", "shot", "explosion"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79c770 / 0x7a3de7 / 0x7a7b08 / 0x791ade.
    ["chantOfShielding", { effects: ["LineageEffect.m_u034_a", "LineageEffect.m_u034_b", "LineageEffect.m_u034_c"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79e58b / 0x7a3de7 / 0x7a8fa4 / 0x791ade.
    ["curseWeakness", { effects: ["LineageEffect.m_u007_a", "LineageEffect.m_u007_b"], effectGroup: "npcWeakness", soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a19d8 / 0x7a3de7 / 0x7b0e38 / 0x791ade.
    ["summon", { effects: ["LineageEffect.e_u011_a"], soundPhases: ["casting"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79bf3d / 0x7a3de7 / 0x7a5958 / 0x791ade.
    ["ultimateDefense", { effects: ["LineageEffect.s_u017_a", "LineageEffect.s_u017_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79cb05 / 0x7a3de7 / 0x7a6bd1 / 0x791ade.
    ["disruptUndead", { effects: ["LineageEffect.m_u017_a", "LineageEffect.m_u017_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79fcb1 / 0x7a3de7 / 0x7ad7d6 / 0x791ade.
    ["shield", { effects: ["LineageEffect.m_u008_a", "LineageEffect.m_u008_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79c74b / 0x7a3de7 / 0x7a644d / 0x791ade.
    ["song", { effects: ["LineageEffect.s_u009_a"], soundPhases: ["shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79c74b / 0x7a3de7 / 0x7a64bd / 0x791ade.
    ["dance", { effects: ["LineageEffect.s_u012_a"], soundPhases: ["shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79c21d / 0x7a3de7 / 0x7a499c / 0x791ade.
    ["tripleSlash", { effects: ["LineageEffect.s_u010_b", "LineageEffect.s_u010_a"], effectGroup: "tripleSlash", soundPhases: ["casting"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79c21d / 0x7a3de7 / 0x7a5a9d / 0x791ade.
    ["sonicSlash", { effects: ["LineageEffect.s_u010_b", "LineageEffect.s_u010_a", "LineageEffect.s_u015_b"], effectGroup: "sonicSlash", soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79c010 / 0x7a3de7 / 0x7ae49b / 0x791ade.
    ["powerSmash", { effects: ["LineageEffect.s_u010_b", "LineageEffect.s_u010_a", "LineageEffect.p_u004_a"], finalShotOnly: true, soundPhases: ["casting", "shot"], pending: "secondary weapon RibbonSet attachment" }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79e2c5 / 0x7a3de7 / 0x7ae49b / 0x791ade.
    ["powerStrike", { effects: ["LineageEffect.s_u002_a", "LineageEffect.p_u004_a"], finalShotOnly: true, soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79e483 / 0x7a3de7 / 0x7a8ef6 / 0x791ade.
    ["recharge", { effects: ["LineageEffect.m_u022_a", "LineageEffect.m_u022_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79f5c8 / 0x7a3de7 / 0x7b0749 / 0x791ade.
    ["sleep", { effects: ["LineageEffect.m_u018_a", "LineageEffect.m_u018_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79f69b / 0x7a3de7 / 0x7aee51 / 0x791ade.
    ["dash", { effects: ["LineageEffect.s_u016_a", "LineageEffect.s_u016_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a17a8 / 0x7a43c0 / 0x7afa26 / 0x7916c7.
    ["powerShot", { effects: ["LineageEffect.s_u003_a", "LineageEffect.s_u003_d", "LineageEffect.s_u003_b", "LineageEffect.p_u004_a"], effectGroup: "bow", soundPhases: ["casting", "shot", "explosion"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79e67a / 0x7a3de7 / 0x7a95fa / 0x791ade.
    ["warCry", { effects: ["LineageEffect.s_u005_a", "LineageEffect.s_u005_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a1220 / 0x7a3de7 / 0x7ae0ea / 0x791ade.
    ["shieldStun", { effects: ["LineageEffect.s_u010_a", "LineageEffect.p_u004_a"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a18b4 / 0x7a43c0 / 0x7af8cb / 0x7918db.
    ["stunShot", { effects: ["LineageEffect.s_u505_a", "LineageEffect.s_u003_d", "LineageEffect.s_u505_b", "LineageEffect.s_u003_b", "LineageEffect.s_u505_c"], effectGroup: "bossStunShot", soundPhases: ["casting", "shot", "explosion"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79ebae / 0x7a3de7 / 0x7ac39f / 0x791ade.
    ["poison", { effects: ["LineageEffect.m_u007_a", "LineageEffect.m_u007_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79ff2a / 0x7a3de7 / 0x7ada66 / 0x791ade.
    ["might", { effects: ["LineageEffect.m_u004_a", "LineageEffect.m_u004_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79e02a / 0x7a3de7 / 0x7a8626 / 0x791ade.
    ["regeneration", { effects: ["LineageEffect.m_u014_a", "LineageEffect.m_u014_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79f3ee / 0x7a3de7 / 0x7ae84c / 0x791ade.
    ["empower", { effects: ["LineageEffect.m_u016_a", "LineageEffect.m_u016_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79fe57 / 0x7a3de7 / 0x7ad91b / 0x791ade.
    ["haste", { effects: ["LineageEffect.m_u036_a", "LineageEffect.m_u036_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a131a / 0x7a3de7 / 0x7afafb / 0x791ade.
    ["vampiricTouch", { effects: ["LineageEffect.m_u003_a", "LineageEffect.m_u003_c", "LineageEffect.m_u003_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79fabf / 0x7a3de7 / 0x7ac52a / 0x791ade.
    ["poisonousCloud", { effects: ["LineageEffect.m_u021_a", "LineageEffect.m_u021_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79f4c1 / 0x7a3de7 / 0x7ae996 / 0x791ade.
    ["auraBurn", { effects: ["LineageEffect.m_u019_a", "LineageEffect.m_u019_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a0558 / 0x7a3de7 / 0x7adbab / 0x78f351.
    ["windStrike", { effects: ["LineageEffect.m_u000_a", "LineageEffect.m_u000_b", "LineageEffect.m_u000_c", "LineageEffect.m_u000_d"], finalShotOnly: true, soundPhases: ["casting", "shot", "explosion"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a06db / 0x7a3de7 / 0x7adcef / 0x79042a.
    ["twister", { effects: ["LineageEffect.m_u026_a", "LineageEffect.m_u026_b", "LineageEffect.m_u026_c", "LineageEffect.m_u026_d"], soundPhases: ["casting", "shot", "explosion"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a02f2 / 0x7a3de7 / 0x7ac80f / 0x78f3fe.
    ["flameStrike", { effects: ["LineageEffect.m_u006_a", "LineageEffect.m_u006_b", "LineageEffect.m_u006_c", "LineageEffect.m_u006_e", "LineageEffect.m_u006_d"], effectGroup: "flameStrike", finalShotOnly: true, soundPhases: ["casting", "shot", "explosion"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79e0fd / 0x7a3de7 / 0x7a84c7 / 0x791ade.
    ["windWalk", { effects: ["LineageEffect.m_u010_a", "LineageEffect.m_u010_c"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79fd84 / 0x7a3de7 / 0x7af786 / 0x791ade.
    ["dryadRoot", { effects: ["LineageEffect.m_u013_a", "LineageEffect.m_u013_c"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79ed7e / 0x7a3de7 / 0x7ac6ac / 0x791ade.
    ["windShackle", { effects: ["LineageEffect.m_u009_a", "LineageEffect.m_u009_c"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79cbf6 / 0x7a3de7 / 0x7a6e34 / 0x791ade.
    ["greaterHeal", { effects: ["LineageEffect.m_u032_a", "LineageEffect.m_u032_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a02f2 / 0x7a3de7 / 0x7ac80f / 0x790a86.
    ["blaze", { effects: ["LineageEffect.m_u006_a", "LineageEffect.m_u006_b", "LineageEffect.m_u006_c", "LineageEffect.m_u006_e"], finalShotOnly: true, soundPhases: ["casting", "shot", "explosion"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a1220 / 0x7a3de7 / 0x7ae49b / 0x791ade.
    ["stunningFist", { effects: ["LineageEffect.s_u010_a", "LineageEffect.p_u004_a"], finalShotOnly: true, soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79f76e / 0x7a3de7 / 0x7aef96 / 0x791ade.
    ["chantOfLife", { effects: ["LineageEffect.m_u024_a", "LineageEffect.m_u024_b", "LineageEffect.m_u024_c"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a0b7e / 0x7a3de7 / 0x7af286 / 0x791ade.
    ["seal", { effects: ["LineageEffect.m_u025_a", "LineageEffect.m_u025_b", "LineageEffect.m_u025_c"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79ddae / 0x7a3de7 / 0x7abe91 / 0x791ade.
    ["return", { effects: ["LineageEffect.e_u031_a", "LineageEffect.e_u005_a"], effectGroup: "zakenSelfTel", soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a131a / 0x7a3de7 / 0x7a99b2 / 0x791ade.
    ["corpseBurst", { effects: ["LineageEffect.m_u003_a", "LineageEffect.m_u006_e", "LineageEffect.m_u006_d"], effectGroup: "corpseBurst", soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79fbde / 0x7a3de7 / 0x7ad619 / 0x791ade.
    ["hydroBlast", { effects: ["LineageEffect.m_u033_a", "LineageEffect.m_u033_b"], soundPhases: ["casting", "shot"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x7a0915 / 0x7a3de7 / 0x7ade48 / 0x7905eb.
    ["hurricane", { effects: ["LineageEffect.m_u038_a", "LineageEffect.m_u038_b", "LineageEffect.m_u038_c", "LineageEffect.m_u038_d"], soundPhases: ["casting", "shot", "explosion"] }],
    // Engine.dll Init/PreShot/Shot/Explosion: 0x79eadb / 0x7a3de7 / 0x7abf6e / 0x791ade.
    ["heal", { effects: ["LineageEffect.m_u001_a", "LineageEffect.m_u001_b"], effectGroup: "heal", soundPhases: ["casting", "shot"] }],
]);

export default nativeSkillRecipes;
