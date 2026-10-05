import type { APackage, UClass, UObject } from "@l2js/core";
import DecodeLibrary from "../decode-library";
import type { NpcSkillAttack_T, NpcSkillAttachOn_T, NpcSkillEffectAction_T, NpcSkillEffectPhase_T } from "../un-pawn";
import getNativeEffect from "./native-effects";
import { getNativeSkillBinding } from "./native-skill-bindings";
import createSkillVisualDefinition from "./skill-visual-definition";
import UConfigLocalization from "../conf-files/un-conf-localization";

let cacheSoulShot: UConfigLocalization = null;

async function getSoulShotEffects(id: number): Promise<{ sticks: string, books: string, hands: number[][] }> {
    // SpawnNTransientEffect 0x799053 / 0x79905b / 0x79934a / 0x7997b5.
    const grade = [2039, 2047, 2061].includes(id) ? 0 : id >= 2150 && id <= 2164 ? (id - 2150) % 5 + 1 : -1;

    if (grade < 0) return null;
    if (!cacheSoulShot) {
        const config = await new UConfigLocalization("assets/system/soulshot.int").decode();

        await config.load();
        cacheSoulShot = config;
    }

    const properties = cacheSoulShot.getProperties(["None", "D", "C", "B", "A", "S"][grade]);
    const prefix = id === 2039 || id >= 2150 && id <= 2154 ? "" : "Spirit";
    const sticks = properties.find(property => property.name === `${prefix}OnSticks`);
    const books = properties.find(property => property.name === `${prefix}OnBooks`);

    if (!sticks || !books) throw new Error(`Soulshot '${id}' has no charging effects.`);
    const hands = ["HAND", "1HS", "2HS", "DUAL", "POLE", "BOW", "THROW", "DUALFIST"].map(type => {
        const properties = cacheSoulShot.getProperties(type);

        return ["LH", "RH"].map(hand => {
            const property = properties.find(property => property.name === hand);
            const mode = property ? parseInt(property.value, 10) : NaN;

            if (![-1, 0, 1].includes(mode)) throw new Error(`Soulshot weapon '${type}.${hand}' has invalid mode '${mode}'.`);
            return mode;
        });
    });
    return { sticks: sticks.value, books: books.value, hands };
}

type SkillVisualDecodeOps_T = {
    loadPackage: (packageName: string) => Promise<APackage>;
    pullEffectTemplate: (path: string, pullScript?: boolean, weaponId?: number) => Promise<void>;
    pullSoundPath: (path: string, required?: boolean) => Promise<string>;
};

export function validatePlayerSkillSource(id: number, level: number, operationType: number): void {
    if (operationType !== 0 && operationType !== 1) throw new Error(`Player skill '${id}:${level}' operation type '${operationType}' is not supported.`);
}

function splitGroupedObjectPath(path: string): [string, string, string] {
    const parts = path.split(".");

    if (parts.length !== 3) throw new Error(`Object path '${path}' is not package.group.object.`);

    return [parts[0], parts[1], parts[2]];
}

function getAttachOn(attachOn: number): NpcSkillAttachOn_T {
    switch (attachOn) {
        case 0: return "none";
        case 1: return "rightHand";
        case 2: return "leftHand";
        case 3: return "boneSpecified";
        case 4: return "aliasSpecified";
        case 5: return "trail";
        default: throw new Error(`Skill action AttachOn '${attachOn}' is not implemented.`);
    }
}

export async function decodeSkillVisuals(library: DecodeLibrary, attacks: readonly NpcSkillAttack_T[], loadPackage: SkillVisualDecodeOps_T["loadPackage"], pullEffectTemplate: SkillVisualDecodeOps_T["pullEffectTemplate"], pullSoundPath: SkillVisualDecodeOps_T["pullSoundPath"]): Promise<void> {
    const decodedEffects = new Map<string, { actions: NpcSkillEffectAction_T[], flyingTime: number }>();
    const pulledEffects = new Set<string>();

    for (const attack of attacks) {
        const visualPath = attack.visualEffect;
        let visual: UObject = null;

        if (visualPath && visualPath.toLowerCase() !== "none") {
            const [packageName, groupName, objectName] = splitGroupedObjectPath(visualPath);
            const pkg = await loadPackage(packageName);

            visual = pkg.fetchObjectByType<UObject>("SkillVisualEffect", objectName, groupName);

            // Core.dll StaticLoadObject 0x1016d4f5 -> ULinkerLoad::Create 0x1014dfed uses outer index -1.
            if (!visual) visual = pkg.fetchObjectByType<UObject>("SkillVisualEffect", objectName);

            if (visual) visual.loadSelf();
        }

        // Engine.dll SetMagicInfo 0x79b45e; MagicProcess 0x7b4f65 branches on the resolved object.
        const soulshot = visual ? null : await getSoulShotEffects(attack.id);
        const native = visual ? null : soulshot ? { effects: [], soundPhases: ["casting"] as NpcSkillEffectPhase_T[] } : getNativeSkillBinding(attack.name, attack.id);

        if (!visual && !native)
            throw new Error(`Skill '${attack.id}:${attack.level}' (${attack.name}) has no resolved visual or implemented native recipe.`);

        const decoded = Object.assign({}, attack, { visual: createSkillVisualDefinition(visual ? [] : null, native) });

        if (soulshot) {
            decoded.visual.soulshot = soulshot;
            await pullEffectTemplate(soulshot.sticks, true);
            await pullEffectTemplate(soulshot.books, true);
        }

        library.npcSkillAttacks.push(decoded);

        for (const path of native ? native.effects : []) {
            const weapon = getNativeEffect(path, native.effectGroup).find(effect => effect.weaponId !== undefined);

            await pullEffectTemplate(path, true, weapon?.weaponId);
        }

        decoded.sounds = decoded.sounds.slice();
        for (let i = decoded.sounds.length - 1; i >= 0; i--) {
            const sound = decoded.sounds[i];

            if (!visual && !decoded.visual.soundPhases.includes(sound.phase)) continue;
            // Engine.dll PlaySkillSound 0x797cfc/0x797d20 resolves the unchanged FName; 0x797d2b skips NULL.
            if (!library.sounds[sound.sound]) {
                const name = await pullSoundPath(sound.sound, false);

                if (name) library.sounds[sound.sound] = name;
                else decoded.sounds.splice(i, 1);
            }
        }

        if (!visual) continue;

        const cached = decodedEffects.get(visualPath.toLowerCase());

        if (cached) {
            decoded.visual.actions = cached.actions;
            decoded.flyingTime = cached.flyingTime;
            continue;
        }

        const phases: [string, NpcSkillEffectPhase_T][] = [["CastingActions", "casting"], ["ShotActions", "shot"], ["ExplosionActions", "explosion"]];

        decoded.flyingTime = Number(visual.propertyDict.get("FlyingTime")) || 0;

        for (const [property, phase] of phases) {
            const infos = visual.propertyDict.get(property) as UObject[];

            if (!infos) continue;

            for (const rawInfo of infos) {
                const info = rawInfo.loadSelf();
                const action = (info.propertyDict.get("Action") as UObject).loadSelf();
                const effectClass = action.propertyDict.get("EffectClass") as UClass;

                if (!effectClass) continue;

                const offset = action.propertyDict.get("offset") as any;
                const effectPath = effectClass.name;

                decoded.visual.actions!.push({
                    phase,
                    specificStage: Number(info.propertyDict.get("SpecificStage")) || 0,
                    effectClass: effectPath,
                    attachOn: getAttachOn(Number(action.propertyDict.get("AttachOn")) || 0),
                    attachBoneName: String(action.propertyDict.get("AttachBoneName") || "None"),
                    isAbsolute: !!action.propertyDict.get("bAbsolute"),
                    spawnDelay: Number(action.propertyDict.get("SpawnDelay")) || 0,
                    useCharacterRotation: !!action.propertyDict.get("bUseCharacterRotation"),
                    offset: offset && typeof offset.getElements === "function" ? offset.getElements() : [0, 0, 0],
                    relativeToCylinder: !!action.propertyDict.get("bRelativeToCylinder"),
                    spawnOnTarget: !!action.propertyDict.get("bSpawnOnTarget"),
                    sizeScale: !!action.propertyDict.get("bSizeScale"),
                    onMultiTarget: !!action.propertyDict.get("bOnMultiTarget")
                });

                if (pulledEffects.has(effectPath.toLowerCase())) continue;

                pulledEffects.add(effectPath.toLowerCase());
                await pullEffectTemplate(effectPath);
            }
        }

        decodedEffects.set(visualPath.toLowerCase(), { actions: decoded.visual.actions!, flyingTime: decoded.flyingTime });

    }
}

export default decodeSkillVisuals;
