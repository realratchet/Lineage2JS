import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll SkillEffectShot 0x7ab481: caster Rotation, target feet; class string 0xab172c.
const effects: NativeSkillEffect_T[] = [
    { phase: "shot", effectClass: "LineageEffect.e_u064_a", host: "target", rotation: "caster" },
    // Engine.dll cumulative XY arithmetic / SetDelayed instruction addresses.
    ...[
        [200, -400, 0.5], // 0x7ab51b, 0x7ab534 / 0x7ab595
        [200, 400, 0.63], // 0x7ab5a6, 0x7ab5ba / 0x7ab618
        [-600, 0, 1], // 0x7ab629, 0x7ab643 / 0x7ab6a1
        [-400, 0, 1.1], // 0x7ab6b2 / 0x7ab71e
        [200, 0, 1.14], // 0x7ab72f / 0x7ab79b
        [0, 400, 1.2], // 0x7ab7ac, 0x7ab7c6 / 0x7ab824
        [0, 0, 1.22], // 0x7ab835 / 0x7ab8a1
        [-350, 600, 1.39], // 0x7ab8b2, 0x7ab8cc / 0x7ab92a
        [-600, 400, 1.42], // 0x7ab93b, 0x7ab955 / 0x7ab9b3
        [-400, -200, 1.48], // 0x7ab9c4, 0x7ab9de / 0x7aba3c
        [0, 600, 1.6], // 0x7aba4d, 0x7aba67 / 0x7abac5
        [-400, 400, 1.85] // 0x7abad6, 0x7abaf0 / 0x7abb4c
    ].map(([x, y, delay]) => ({ phase: "shot" as const, effectClass: "LineageEffect.e_u064_a", host: "target" as const, rotation: "caster" as const, offset: [x, y, 0] as [number, number, number], delay }))
];

export default effects;
