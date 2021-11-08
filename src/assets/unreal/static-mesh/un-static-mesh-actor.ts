import UExport from "../un-export";
import UPackage from "../un-package";
import UAActor from "../un-aactor";
import UStaticMesh from "./un-static-mesh";
import { Vector3, Mesh, Group } from "three";
import UStaticMeshIsntance from "./un-static-mesh-instance";
import FArray from "../un-array";
import BufferValue from "../../buffer-value";
import FNumber from "../un-number";
import USound from "../un-sound";

class UStaticMeshActor extends UAActor {
    protected mesh: UStaticMesh;
    protected instance: UStaticMeshIsntance;
    protected group: string;
    protected isRangeIgnored: boolean;
    protected colLocation: Vector3;
    protected touching: FArray = new FArray(FNumber.forType(BufferValue.int16) as any);
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

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "StaticMesh": "mesh",
            "Group": "group",
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
            "L2CurrentLod": "currentLod"
        });
    }

    public async decodeMesh(): Promise<Group> {
        const group = new Group();

        const instance = await this.mesh.decodeMesh();

        console.assert(!instance.parent)

        group.add(instance);
        group.position.set(this.location.x, this.location.z, this.location.y);

        // debugger;

        return group;
    }

    public async load(pkg: UPackage, exp: UExport): Promise<this> {
        // debugger;

        await super.load(pkg, exp);

        return this;
    }
}

export default UStaticMeshActor;
export { UStaticMeshActor };