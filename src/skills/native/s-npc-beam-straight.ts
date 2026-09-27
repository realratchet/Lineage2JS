import type { NativeSkillEffect_T } from "../native-effects";

// Engine.dll 0x7acc39..0x7acc69: radius * direction; 0x7acc3f/0x7acc6f: FVector::operator/(1.5), giving radius * 2/3.
const effects: NativeSkillEffect_T[] = [
    // 0x7acbd0: DesiredRotation; 0x7acc7a..0x7acc96: caster Location; 0x7acced/0x7accee: caster host/owner.
    { phase: "shot", effectClass: "LineageEffect.e_u034_a", host: "caster", position: "center", rotation: "caster", radiusOffset: 2 / 3, offsetRotation: "desiredCaster" },
    // 0x7acd29..0x7acd48 reuses the launch location; 0x7aee40..0x7aee49 spawns the projectile with caster host/owner.
    { phase: "shot", effectClass: "LineageEffect.e_u034_b", host: "caster", position: "center", rotation: "caster", radiusOffset: 2 / 3, offsetRotation: "desiredCaster", projectile: { target: "target" } },
    // 0x790e35..0x790ee7: Owner rate, actual hit host/owner, mode0 trailer at zero Location/Rotation, optional absolute bone0.
    { phase: "explosion", effectClass: "LineageEffect.e_u034_c", host: "impactActor", owner: "impactActor", hitActor: true, sourceOwner: true, location: [0, 0, 0], rotation: "zero", bone: 0, boneOptional: true, isAbsolute: true, useSkillSpeed: "sourceOwner" },
    // 0x790eec..0x791060: Owner-present Pawn hit only; fixed white light, incoming forward * radius * -2.4, radius30, lifetime0.3.
    { phase: "explosion", effectClass: "LineageEffect.e_u034_c", host: "impactActor", hitActor: true, sourceOwner: true, pawnLightOnly: true, pawnLight: { color: [1, 1, 1], radius: 30, lifeTime: 0.3, spot: true, position: "lastTarget", rotation: "hit", radiusOffset: -2.4 } },
    // 0x79106a..0x79112e: absent Owner requires retained TargetActor and its rate; actual hit host/owner, mode0/absolute bone0, no light.
    { phase: "explosion", effectClass: "LineageEffect.e_u034_c", host: "impactActor", owner: "impactActor", hitActor: true, sourceOwner: false, sourceTarget: true, location: [0, 0, 0], rotation: "zero", bone: 0, boneOptional: true, isAbsolute: true, useSkillSpeed: "sourceTarget" },
    // 0x790da5..0x790e30: Owner-gated miss at LastTargetLocation/HitRot, null host/owner, Owner Pawn rate (else1), no light.
    { phase: "explosion", effectClass: "LineageEffect.e_u034_c", host: "source", owner: "none", hitActor: false, sourceOwner: true, position: "lastTarget", rotation: "hit", useSkillSpeed: "sourceOwner" }
];

export default effects;
