import UAActor from "./un-aactor"
import type { USkeletalMesh, ISkinnedMeshObjectDecodeInfo } from "./skeletal-mesh/un-skeletal-mesh";
import type { DecodeLibraryBuilder } from "./decode-library-builder";
import type { Vector3Arr } from "./library-types";
import type { SkillVisualDefinition_T } from "./skills/skill-visual-definition";
import type { UClass } from "@l2js/core";

export enum WeaponType {
    WT_HAND,
    WT_1HS,
    WT_2HS,
    WT_DUAL,
    WT_POLE,
    WT_BOW,
    WT_THROW,
    WT_DUALFIST
}

export enum RideType_T {
    RD_NONE,
    RD_STRIDER,
    RD_WYVERN
}

// Retail Pawn.NActionList omits the editor leak's NACT_SKILLINPUTWAIT.
export enum NActionList_T {
    NACT_NONE,
    NACT_MELLEATTACK,
    NACT_BOWATTACK,
    NACT_PICITEM,
    NACT_CHANGEITEM,
    NACT_SKILLUSE,
    NACT_THROWATTACK,
    NACT_SHOTATTACK,
    NACT_PRIVATESTORE,
    NACT_OBSERVING
}

export type INpcDefinition = {
    movementAnimationRate: number;
    id: number;
    name: string;
    className: string;
    mesh: string;
    textures: string[];
    alternateTextures: string[];
    skillAttacks: NpcSkillAttack_T[];
    enterEvent: INpcEnterEvent | null;
    questMark: { minLevel: number; maxLevel: number; classIds: number[] } | null;
    sounds: IPawnSoundsDecodeInfo;
};

export type NpcSkillAttack_T = {
    id: number;
    level: number;
    name: string;
    animation: string;
    animationCategory: string;
    castStyle: number;
    isMagic: boolean;
    hitTime: number;
    castRange?: number;
    isMultiShot: boolean;
    flyingTime: number;
    visualEffect: string;
    visual: SkillVisualDefinition_T;
    visualTimeScale?: number;
    assets?: import("./decode-library").DecodeLibrary;
    passive?: boolean;
    previewTarget?: "self";
    sounds: NpcSkillSound_T[];
};

export type NpcSkillSound_T = { phase: NpcSkillEffectPhase_T, sound: string, volume: number, radius: number, charClassId?: number };

export type NpcSkillEffectPhase_T = "casting" | "preshot" | "shot" | "explosion";

// EAttachMethod ordinals from the leaked EngineClasses.h, converted to member names at the decode boundary
export type NpcSkillAttachOn_T = "none" | "rightHand" | "leftHand" | "boneSpecified" | "aliasSpecified" | "trail";

export type NpcSkillEffectAction_T = {
    phase: NpcSkillEffectPhase_T;
    specificStage: number;
    effectClass: string;
    attachOn: NpcSkillAttachOn_T;
    attachBoneName: string;
    isAbsolute: boolean;
    spawnDelay: number;
    useCharacterRotation: boolean;
    offset: Vector3Arr;
    relativeToCylinder: boolean;
    spawnOnTarget: boolean;
    sizeScale: boolean;
    onMultiTarget: boolean;
};

export type INpcEnterEvent = {
    sound: string;
    soundVolume: number;
    soundRadius: number;
    isRise: number;
    spawnType: number;
    effect: string;
    animation: string;
};

export type ICharacterGroup = {
    index: number,
    name: string,
    faceVariants: number,
    hairStyles: number[],
    hairColours: Record<number, number[]>,
    armor: ICharacterArmorOptions
};

export type ICharacterArmorOption = { id: number, label: string };

export type ICharacterArmorOptions = {
    chest: ICharacterArmorOption[],
    legs: ICharacterArmorOption[],
    gloves: ICharacterArmorOption[],
    boots: ICharacterArmorOption[]
};

export type ICharacterArmorSelection = {
    chest: number,
    legs: number,
    gloves: number,
    boots: number
};

export type IPawnSoundSetDecodeInfo = {
    sounds: (string | null)[];
    volume: number;
    radius: number;
};

export type IPawnSoundsDecodeInfo = {
    attack?: IPawnSoundSetDecodeInfo;
    defense: IPawnSoundSetDecodeInfo;
    damage: IPawnSoundSetDecodeInfo & { random: number };
    item: IPawnSoundSetDecodeInfo | null;
    shield?: IPawnSoundSetDecodeInfo | null;
    critical?: { sound: string | null; volume: number; radius: number };
    soulshot?: { sound: string | null; volume: number; radius: number };
};

export type ICharacterEquipment = {
    rightHand: number;
    leftHand: number;
    head?: number;
    hair?: number;
    enchantLevel?: number;
};

export type IWeaponEnchantMesh = {
    mesh: string;
    skin: string;
    scale: [number, number, number];
    offset: [number, number, number];
    colors: number[][];
};

export type IWeaponEnchantEffect = {
    path: string;
    offset: [number, number, number];
    scale: number;
    velocityScale: number;
    opacity: number;
    num: number;
};

export type IPawnEquipmentDecodeInfo = {
    attackSound?: IPawnSoundSetDecodeInfo | null;
    weaponType: number;
    items: { mesh: string; skins: string[]; bone: string | number; extraMesh?: boolean; enchantMesh?: IWeaponEnchantMesh; enchantEffect?: IWeaponEnchantEffect }[];
};

export type INpcBowDecodeInfo = {
    weaponMesh: string;
    weaponSkins: string[];
    curvature: number;
    attackRange: number;
    ammo: number;
};

export type INpcEquipment = {
    rightHand: number;
    leftHand?: number;
    chest?: number;
    attackRange: number;
};

export abstract class UPawn extends UAActor {
    declare protected mesh: USkeletalMesh;
    declare protected isUnlit: boolean;
    declare public readonly effectSpawnBoneIndex: number;
    declare public readonly damageEffect: UClass;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Mesh": "mesh",
            "bUnlit": "isUnlit",
            "EffectSpawnBoneIdx": "effectSpawnBoneIndex",
            "DamageEffect": "damageEffect"
        });
    }

    public getDecodeInfo(builder: DecodeLibraryBuilder): ISkinnedMeshObjectDecodeInfo {
        if (!this.mesh) {
            console.warn(`Pawn '${this.objectName}' has no mesh, skipping`);
            return null;
        }

        const meshInfo = Object.assign({}, builder.pullSkeletalMesh(this.mesh));

        meshInfo.name = this.objectName;
        meshInfo.position = this.location.getElements();
        meshInfo.scale = this.scale.getElements().map(v => v * this.drawScale) as Vector3Arr;
        meshInfo.quaternion = this.rotation.getQuaternionElements();
        meshInfo.scaledGlow = this.scaleGlow ?? 1;
        meshInfo.ambient = { glow: this.getAmbientLightingActor().ambientGlow ?? 0, isUnlit: !!this.isUnlit };

        return meshInfo;
    }
}

export default UPawn;
