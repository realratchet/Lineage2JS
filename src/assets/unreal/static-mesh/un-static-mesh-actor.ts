import UExport from "../un-export";
import UPackage from "../un-package";
import UAActor from "../un-aactor";
import UStaticMesh from "./un-static-mesh";
// import { Vector3, Mesh, Group } from "three";
import UStaticMeshIsntance from "./un-static-mesh-instance";
import FArray from "../un-array";
import BufferValue from "../../buffer-value";
import FNumber from "../un-number";
import USound from "../un-sound";

class UStaticMeshActor extends UAActor {
    protected mesh: UStaticMesh;
    protected instance: UStaticMeshIsntance;
    protected isRangeIgnored: boolean;
    protected colLocation: FVector;
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

    public async getDecodeInfo(): Promise<IBaseObjectDecodeInfo> {
        await Promise.all(this.promisesLoading);

        return {
            type: "StaticMeshActor",
            name: this.objectName,
            position: [this.location.x, this.location.z, this.location.y],
            scale: [this.scale.x, this.scale.z, this.scale.y],
            rotation: this.rotation.getEulerElements(),
            children: [await this.mesh.getDecodeInfo()]
        };
    }

    public async decodeMesh(): Promise<THREE.Group> {
        // debugger;

        const group = new Group();

        const instance = await this.mesh.decodeMesh();

        console.assert(!instance.parent)

        group.name = this.objectName;
        group.add(instance);
        group.position.set(this.location.x, this.location.z, this.location.y)
        // group.scale.set(0.001, 0.001, 0.001);

        // roll (x) | pitch (y) | yaw (z)

        this.rotation.getEuler(group.rotation);
        group.scale.set(Math.abs(this.scale.x), Math.abs(this.scale.z), Math.abs(this.scale.y));

        // debugger;

        // const roll = -(65535 - this.rotation.x) / 32768 * Math.PI;
        // const pitch = -(this.rotation.z) / 32768 * Math.PI;
        // const yaw = -(this.rotation.y) / 32768 * Math.PI;

        // group.rotation.set(
        //     // -Math.PI * 0.5,
        //     // 0,
        //     // 0
        //     2 * Math.PI - (65535 - roll) / 32768 * Math.PI,
        //     2 * Math.PI - pitch / 32768 * Math.PI,
        //     -yaw / 32768 * Math.PI
        // );

        // console.log(group.rotation);

        return group;
    }

    public load(pkg: UPackage, exp: UExport): this {
        // debugger;
        // this.readHeadOffset = 15;
        // pkg.seek(exp.offset.value as number, "set");

        // pkg.dump(1);

        // const unk02 = await pkg.read(new BufferValue(BufferValue.compat32)).value as number;

        // pkg.seek(5);
        // const unk03 = await pkg.read(new BufferValue(BufferValue.compat32)).value as number;
        // // const unk03 = await pkg.read(new BufferValue(BufferValue.compat32)).value as number;

        // debugger;

        super.load(pkg, exp);

        this.readHead = pkg.tell();

        // if (this.scale.vector.x !== 1 || this.scale.vector.y !== 1 || this.scale.vector.z !== 1) debugger;

        // const unk1 = await pkg.read(BufferValue.allocBytes(10)).value as DataView;

        // pkg.dump(1);

        // debugger;

        // const unk2 = await pkg.read(new BufferValue(BufferValue.compat32)).value as number;
        // const unk3 = await pkg.read(new BufferValue(BufferValue.compat32)).value as number;
        // // const unk4 = await pkg.read(new BufferValue(BufferValue.uint8)).value as number;

        // pkg.seek(8);

        // const unk4 = await pkg.read(new BufferValue(BufferValue.compat32)).value as number;

        this.readHead = pkg.tell();

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