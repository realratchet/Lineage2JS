import UAActor from "../un-aactor";
import { FPrimitiveArray } from "../un-array";
import BufferValue from "../../buffer-value";

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
    protected isSelected: boolean;

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
            "bSelected": "isSelected"
        });
    }

    public async getDecodeInfo(library: IDecodeLibrary): Promise<IBaseObjectDecodeInfo> {
        await this.onLoaded();

        if (this.instance) this.instance.setActor(this);

        // if (this.colLocation.sub(this.location).length() > 1e-3)
        //     debugger;

        const lights: any[] = [];
        // const lights: ILightDecodeInfo[] = (await this.instance.getDecodeInfo(library)).filter(l => l.directional);

        const siblings = [...lights];

        // debugger;

        const info = {
            type: "StaticMeshActor",
            name: this.objectName,
            position: this.colLocation.getVectorElements(),
            scale: this.scale.getVectorElements(),
            rotation: this.rotation.getEulerElements(),
            children: [await this.mesh.getDecodeInfo(library)/*, this.getRegionLineHelper(library)*/],
            siblings,
        } as IBaseObjectDecodeInfo;

        // debugger;

        return info;
    }

    public doLoad(pkg: UPackage, exp: UExport) {
        // debugger;
        // this.readHeadOffset = 15;
        // pkg.seek(exp.offset.value as number, "set");

        // pkg.dump(1);

        // const unk02 = await pkg.read(new BufferValue(BufferValue.compat32)).value as number;

        // pkg.seek(5);
        // const unk03 = await pkg.read(new BufferValue(BufferValue.compat32)).value as number;
        // // const unk03 = await pkg.read(new BufferValue(BufferValue.compat32)).value as number;

        // debugger;

        super.doLoad(pkg, exp);

        this.readHead = pkg.tell();


        // if (this.scale.vector.x !== 1 || this.scale.vector.y !== 1 || this.scale.vector.z !== 1) debugger;

        // const unk1 = await pkg.read(BufferValue.allocBytes(10)).value as DataView;

        // pkg.dump(1);

        // debugger;

        // const unk2 = pkg.read(new BufferValue(BufferValue.compat32)).value as number;
        // const unk3 = pkg.read(new BufferValue(BufferValue.compat32)).value as number;
        // // const unk4 = await pkg.read(new BufferValue(BufferValue.uint8)).value as number;

        // pkg.seek(8);

        // const unk4 = pkg.read(new BufferValue(BufferValue.compat32)).value as number;
        // const unk5 = pkg.read(new BufferValue(BufferValue.compat32)).value as number;
        // const unk6 = pkg.read(new BufferValue(BufferValue.compat32)).value as number;

        // this.readHead = pkg.tell();

        // debugger;

        // // const obj2 = await pkg.fetchObject(unk2);
        // // debugger;
        // // const obj3 = await pkg.fetchObject(unk3);
        // // debugger;
        // // const obj4 = await pkg.fetchObject(unk4);

        // debugger;

        // // await this.readNamedProps(pkg);

        // // const prop2 = await pkg.read(BufferValue.allocBytes(5)).value as DataView;

        // debugger;

        return this;
    }
}

export default UStaticMeshActor;
export { UStaticMeshActor };