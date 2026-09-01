import UAActor from "./un-aactor"
import type { USkeletalMesh, ISkinnedMeshObjectDecodeInfo } from "./skeletal-mesh/un-skeletal-mesh";
import type { DecodeLibraryBuilder } from "./decode-library-builder";
import type { Vector3Arr } from "./library-types";

export type INpcDefinition = {
    id: number;
    name: string;
    className: string;
    mesh: string;
    textures: string[];
    enterEvent: INpcEnterEvent | null;
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

export abstract class UPawn extends UAActor {
    declare protected mesh: USkeletalMesh;
    declare protected isUnlit: boolean;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Mesh": "mesh",
            "bUnlit": "isUnlit"
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