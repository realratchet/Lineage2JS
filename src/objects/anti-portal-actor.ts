import { Box3, Plane, Vector3, type Frustum } from "three";
import { EDrawType_T } from "../assets/unreal/un-aactor";
import type { AntiPortalDecodeInfo_T } from "../assets/unreal/un-anti-portal-actor";
import type { ScriptNativeCall_T, ScriptValue_T } from "../ue-script/vm";
import { planesContainBounds } from "../rendering/anti-portal-volume";
import Actor, { type ActorInfo_T } from "./actor";
import type { SectorObject } from "./zone-object";

export type ActorAntiPortalVolume_T = { name: string, zoneMask: bigint, planes: Plane[], edgePlanes: Plane[] };

const MAX_VOLUME_PLANES = 32;
const tmpNearest = new Vector3();

export class AntiPortalActor extends Actor {
    public readonly bounds = new Box3();
    public readonly zoneMask: bigint;
    protected readonly faces: { plane: Plane, vertices: Vector3[] }[];
    protected readonly edges: AntiPortalDecodeInfo_T["edges"];
    protected readonly arrDistances: Float64Array;
    protected volume: ActorAntiPortalVolume_T;
    protected readonly cullDistance: number;

    public constructor(actorInfo: ActorInfo_T, info: AntiPortalDecodeInfo_T) {
        super(actorInfo);

        this.bounds.min.fromArray(info.bounds.min);
        this.bounds.max.fromArray(info.bounds.max);
        this.zoneMask = info.zoneMask;
        this.cullDistance = info.cullDistance;
        this.faces = info.faces.map(({ plane: [x, y, z, w], vertices }) => ({ plane: new Plane(new Vector3(x, y, z), w), vertices: vertices.map(vertex => new Vector3().fromArray(vertex)) }));
        this.edges = info.edges;
        this.arrDistances = new Float64Array(this.faces.length);
    }

    public setUnrealScriptProperty(id: string, value: ScriptValue_T): void {
        super.setUnrealScriptProperty(id, value);
        if (id.toLowerCase() === "drawtype") {
            const level = this.getLevel() as SectorObject;

            if (level) level.invalidateVisibility();
        }
    }

    public callUnrealNative(call: ScriptNativeCall_T): ScriptValue_T {
        if (call.name.toLowerCase() !== "setdrawtype") return super.callUnrealNative(call);

        this.setUnrealScriptProperty("DrawType", call.args[0] as number);
        return undefined;
    }

    public createVolume(): ActorAntiPortalVolume_T {
        return { name: this.name, zoneMask: this.zoneMask, planes: [], edgePlanes: this.edges.map(() => new Plane()) };
    }

    public extrude(position: Vector3, frustum: Frustum, tanHalfFov: number, volume = this.volume || (this.volume = this.createVolume())): boolean {
        const { planes, edgePlanes } = volume;
        planes.length = 0;
        if (this.getUnrealScriptProperty("DrawType") !== EDrawType_T.DT_AntiPortal || !frustum.intersectsBox(this.bounds)) return false;
        if (this.cullDistance && this.bounds.clampPoint(position, tmpNearest).distanceToSquared(position) * tanHalfFov * tanHalfFov > this.cullDistance * this.cullDistance) return false;

        // Engine.dll 0x917cd0 extrudes edges shared by a front and a back face.
        for (let i = 0; i < this.faces.length; i++) {
            const face = this.faces[i], distance = this.arrDistances[i] = face.plane.distanceToPoint(position);

            if (distance > 0) planes.push(face.plane);
            if (planes.length === MAX_VOLUME_PLANES) return true;
        }

        if (!planes.length) return false;
        for (let i = 0; i < this.edges.length; i++) {
            const [a, b, va, vb] = this.edges[i], fa = this.arrDistances[a], fb = this.arrDistances[b];
            if (fa * fb >= 0) continue;

            const first = this.faces[a].vertices[va], second = this.faces[b].vertices[vb];
            const plane = edgePlanes[i].setFromCoplanarPoints(position, fb > 0 ? second : first, fb > 0 ? first : second);
            if (plane.normal.lengthSq() > 0) planes.push(plane);
            if (planes.length === MAX_VOLUME_PLANES) break;
        }
        return true;
    }

    public containsBounds(min: ArrayLike<number>, max: ArrayLike<number>): boolean {
        return !!this.volume && planesContainBounds(this.volume.planes, min, max);
    }
}

export default AntiPortalActor;
