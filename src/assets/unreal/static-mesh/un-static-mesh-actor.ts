import UAActor from "../un-aactor";
import { FPrimitiveArray } from "../un-array";
import BufferValue from "../../buffer-value";
import FVector from "../un-vector";
import { generateUUID } from "three/src/math/MathUtils";
import hsvToRgb from "@client/utils/hsv-to-rgb";
import { FPlane } from "../un-plane";
import { FNTimeHSV } from "../un-time-light";

class UStaticMeshActor extends UAActor {
    protected mesh: UStaticMesh;
    protected instance: UStaticMeshInstance;
    protected isRangeIgnored: boolean;
    protected colLocation: FVector;
    protected touching: FPrimitiveArray = new FPrimitiveArray(BufferValue.int16);
    protected isUpdatingShadow: boolean;
    protected stepSound1: USound;
    protected stepSound2: USound;
    protected stepSound3: USound;
    protected isCollidingActors: boolean;
    protected isBlockingActors: boolean;
    protected isBlockingPlayers: boolean;
    protected isBlockingZeroExtentTraces: boolean;
    protected isBlockingNonZeroExtentTraces: boolean;
    protected isBlockingKarma: boolean;
    protected forcedRegion: number;
    protected forcedRegionTag: string;
    protected lodViewDuration: number;
    protected currentLod: number;
    protected isUnlit: boolean;
    protected isShadowCast: boolean;

    protected serverObjectID: number;
    protected serverObjectRealID: number;
    protected serverObjectType: number;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "StaticMesh": "mesh",
            "StaticMeshInstance": "instance",
            "bIgnoredRange": "isRangeIgnored",
            "ColLocation": "colLocation",
            "Touching": "touching",
            "bUpdateShadow": "isUpdatingShadow",
            "StepSound_1": "stepSound1",
            "StepSound_2": "stepSound2",
            "StepSound_3": "stepSound3",
            "bCollideActors": "isCollidingActors",
            "bBlockActors": "isBlockingActors",
            "bBlockPlayers": "isBlockingPlayers",
            "bBlockZeroExtentTraces": "isBlockingZeroExtentTraces",
            "bBlockNonZeroExtentTraces": "isBlockingNonZeroExtentTraces",
            "bBlockKarma": "isBlockingKarma",
            "ForcedRegion": "forcedRegion",
            "ForcedRegionTag": "forcedRegionTag",
            "L2LodViewDuration": "lodViewDuration",
            "L2CurrentLod": "currentLod",
            "bUnlit": "isUnlit",
            "bShadowCast": "isShadowCast",

            "L2ServerObjectType": "serverObjectType",
            "L2ServerObjectID": "serverObjectID",
            "L2ServerObjectRealID": "serverObjectRealID"
        });
    }

    protected decodeSunlight(): ILightAmbientMaterialModifier {
        const hsvPlane = new FNTimeHSV(12, 1, 255, 160);

        const someColor_88 = 1.0;
        const ambientBrightness = 1;
        const someColorPlane_64 = new FPlane(8.213098049163818359375e-1, 8.213098049163818359375e-1, 8.213098049163818359375e-1, 1);

        const hsvPlane_4 = someColorPlane_64.multiplyScalar(hsvPlane.lightness * 0.003921569);
        const hsvPlane_5 = hsvPlane_4.multiplyScalar(someColor_88);
        const hsvPlane_8 = hsvPlane_5.multiplyScalar(ambientBrightness);

        // const plane FPlane:: operator* (& hsvPlane_80, (FPlane *)someColorPlane_64, 1 * 0.003921569)

        const someActorByte = 0x13;

        if(someActorByte === 0x13) {

        } else {
            debugger;
        }

        debugger;

        return {
            type: "Lighting",
            lightType: "Ambient",
            brightness: 3,
            color: color//[99,101,141].map(v => v / 255) as [number, number, number]
        };
    }

    public async getDecodeInfo(library: IDecodeLibrary): Promise<IBaseObjectDecodeInfo> {
        await this.onLoaded();

        if (this.instance) this.instance.setActor(this);

        // if (this.colLocation.sub(this.location).length() > 1e-3)
        //     debugger;

        const lights: ILightDecodeInfo[] = []
        // const lights: ILightDecodeInfo[] = (await this.instance.getDecodeInfo(library))
        //.filter((l: ILightDecodeInfo) => l.directional)
        // .filter((l: ILightDecodeInfo) => l.isDynamic)

        // debugger;

        const siblings = [...lights];
        const zone = this.getZone();

        let hasModifier = false;

        // if (zone?.ambientVector) {
        //     hasModifier = true;

        //     if (!(zone.uuid in library.materialModifiers)) {
        //         library.materialModifiers[zone.uuid] = {
        //             type: "Lighting",
        //             lightType: "Directional",
        //             brightness: zone.ambientBrightness,
        //             direction: zone.ambientVector.getVectorElements()
        //         } as ILightDirectionalMaterialModifier;
        //     }

        //     // debugger;
        // }

        let modifierUuid;

        if (this.isSunAffected) {
            hasModifier = true;
            modifierUuid = generateUUID();

            library.materialModifiers[modifierUuid] = this.decodeSunlight();
        }

        // console.log("Leaf | Mesh:", this.region.uuid);

        // debugger;

        const info = {
            type: "StaticMeshActor",
            name: this.objectName,
            position: this.colLocation.getVectorElements(),
            scale: this.scale.getVectorElements(),
            rotation: this.rotation.getEulerElements(),
            children: [await this.mesh.getDecodeInfo(library, hasModifier ? [modifierUuid] : null)/*, this.getRegionLineHelper(library)*/],
            siblings,
        } as IBaseObjectDecodeInfo;

        // debugger;

        return info;
    }

    public doLoad(pkg: UPackage, exp: UExport) {
        super.doLoad(pkg, exp);

        this.readHead = pkg.tell();


        // if (this.objectName === 'Exp_StaticMeshActor449')
        //     debugger;

        return this;
    }
}

export default UStaticMeshActor;
export { UStaticMeshActor };