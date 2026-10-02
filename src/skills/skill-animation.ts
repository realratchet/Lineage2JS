import type BaseActor from "../base-actor";

type SkillAnimation_T = { names: string[], flexibleIndex: number };

const arrCastAnimations = ["CastShortAnimName", "CastMidAnimName", "CastLongAnimName"];
const arrMagicAnimations = ["MagicNoTargetAnimName", "MagicShotAnimName", "MagicThrowAnimName"];
// Engine.dll SetSkillAnim 0x7974fb..0x7977c7; retail GetSpAtk01AnimName 0x60c1f7 starts at +0x984, unlike the leaked layout.
const arrMixAnimations = [[9, 17, 24], [7, 16, 25], [7, 13, 20], [7, 12, 21], [8, 13, 22], [10, 11, 18], [10, 11, 19], [7, 14, 23], [9, 15, 26]];
// Engine.dll SetSkillAnim 0x7972b2..0x7974f6; GetSpAtk27AnimName 0x60c6d7 reads +0xcc4.
const arrSingleAnimations: Record<string, string> = {
    M: "PicItemAnimName", N: "SpAtk27AnimName", S: "SpAtk01AnimName", T: "SpAtk02AnimName", U: "SpAtk03AnimName", V: "SpAtk04AnimName", W: "SpAtk05AnimName", X: "SpAtk06AnimName", Y: "ShieldAtkAnimName"
};

export function getSkillAnimation(pawn: BaseActor, category: string): SkillAnimation_T {
    const weapon = pawn.getUnrealScriptProperty("CurWeaponType") as number;
    const names: string[] = [];
    const key = category.toUpperCase();
    let flexibleIndex = -1;

    function add(name: string): void {
        const value = (pawn.getUnrealScriptProperty(name) as string[])[weapon];
        if (!value) throw new Error(`${pawn.name} has no ${name}[${weapon}].`);
        names.push(value);
    }

    // Engine.dll SetSkillAnim 0x7971c4..0x7972e8: A-I use flexible slot1, J-L slot0.
    const castIndex = "ABCDEFGHI".indexOf(key);
    if (castIndex >= 0 && key.length === 1) {
        add(arrCastAnimations[Math.floor(castIndex / 3)]);
        add("CastEndAnimName");
        add(arrMagicAnimations[castIndex % 3]);
        flexibleIndex = 1;
    } else if ("JKL".includes(key) && key.length === 1) {
        add("CastEndAnimName");
        add(arrMagicAnimations["JKL".indexOf(key)]);
        flexibleIndex = 0;
    } else if (arrSingleAnimations[key]) add(arrSingleAnimations[key]);
    else if (/^MIX0[1-9]$/.test(key)) {
        for (const index of arrMixAnimations[Number(key.slice(-1)) - 1]) add(`SpAtk${String(index).padStart(2, "0")}AnimName`);
    } else if (key && key !== "NONE") throw new Error(`Skill animation category '${category}' is not implemented.`);

    return { names, flexibleIndex };
}

export default getSkillAnimation;
