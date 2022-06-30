import UAActor from "../un-aactor";
import { FPrimitiveArray } from "../un-array";
import BufferValue from "../../buffer-value";
import FVector from "../un-vector";

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
    protected lodViewDuration: number;
    protected currentLod: number;
    protected isUnlit: boolean;
    protected isShadowCast: boolean;

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
            "L2LodViewDuration": "lodViewDuration",
            "L2CurrentLod": "currentLod",
            "bUnlit": "isUnlit",
            "bShadowCast": "isShadowCast",
        });
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

        if (zone?.ambientVector) {
            hasModifier = true;

            if (!(zone.uuid in library.materialModifiers)) {
                library.materialModifiers[zone.uuid] = {
                    type: "Ambient",
                    brightness: zone.ambientBrightness,
                    direction: zone.ambientVector.getVectorElements()
                } as IAmbientMaterialModifier;
            }

            // debugger;
        }

        console.log("Leaf | Mesh:", this.region.uuid);

        // debugger;

        const info = {
            type: "StaticMeshActor",
            name: this.objectName,
            position: this.colLocation.getVectorElements(),
            scale: this.scale.getVectorElements(),
            rotation: this.rotation.getEulerElements(),
            children: [await this.mesh.getDecodeInfo(library, hasModifier ? [zone.uuid] : null), this.getRegionLineHelper(library)],
            siblings,
        } as IBaseObjectDecodeInfo;

        debugger;

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