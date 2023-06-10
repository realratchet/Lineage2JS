import { Box3, Color, Fog, Object3D, Sphere, Vector4 } from "three";

const tmpColor = new Color();
const tmpVec4 = new Vector4();

class ZoneObject extends Object3D {
    public fog: Fog = null;

    public readonly boundsRender = new Box3();
    public readonly boundsRenderSphere = new Sphere();

    public readonly isCullable: boolean = true;
    public readonly isZoneObject = true;
    public readonly type: "Zone" | "Sector" = "Zone";

    public setRenderBounds(min: GD.Vector3Arr, max: GD.Vector3Arr): this {

        this.boundsRender.min.fromArray(min);
        this.boundsRender.max.fromArray(max);
        this.boundsRender.getBoundingSphere(this.boundsRenderSphere);

        return this;
    }

    public setFogInfo(start: number, end: number, color: ColorArr): this {
        this.fog = new Fog(tmpColor.fromArray(color), start, end);

        return this;
    }

    // public update(enableZoneCulling: boolean, frustum: THREE.Frustum) {
    //     if (this.isCullable && enableZoneCulling && !frustum.intersectsSphere(this.boundsRenderSphere)) {
    //         this.children = [];
    //         return false;
    //     }

    //     this.children = this.childObjects;
    //     this.childZones.forEach(z => z.update(enableZoneCulling, frustum));

    //     return true;
    // }
}

class SectorObject extends Object3D {
    public readonly isSectorObject = true;
    public readonly type = "Sector";
    public readonly zones = new Object3D();
    public readonly helpers = new Object3D();

    public bspZones: BSPZoneData[];
    public bspNodes: BSPNodeData[];
    public bspLeaves: BSPLeafData[];
    public index: THREE.Vector2;
    public sunTexture: MapData_T;

    constructor() {
        super();

        this.helpers.name = "SectorHelpers";
        this.zones.name = "SectorZones";

        this.add(this.helpers, this.zones);
    }

    public setBSPInfo(bspZones: IBSPZoneDecodeInfo_T[], bspNodes: IBSPNodeDecodeInfo_T[], bspLeaves: IBSPLeafDecodeInfo_T[]) {
        this.bspZones = bspZones.map(BSPZoneData.fromInfo);
        this.bspNodes = bspNodes.map(BSPNodeData.fromInfo);
        this.bspLeaves = bspLeaves.map(BSPLeafData.fromInfo);
    }

    public findPositionZone(position: THREE.Vector3) {
        const findZonePosition = tmpVec4.set(position.x, position.y, position.z, -1);

        let nodeIndex = 0;
        let leaf: number;
        let node: BSPNodeData;

        while (true) {
            node = this.bspNodes[nodeIndex];
            const plane = node.plane;
            const side = findZonePosition.dot(plane);

            if (node.front >= 0 && side >= 0) nodeIndex = node.front;
            else if (node.back >= 0 && side <= 0) nodeIndex = node.back;
            else {
                leaf = side >= 0 ? node.leaves[0] : node.leaves[1];
                break;
            }
        }


        // debugger;

        const foundZone = node.zones[1];

        // console.log(foundZone, nodeIndex, `(${node.leaves.join(", ")})`, `[${leaf}]`);

        // debugger;


        return foundZone;
    }

    public setSun(sunMaterial: MapData_T) { this.sunTexture = sunMaterial; }
}

class BSPZoneData {
    public connectivity: bigint;
    public visibility: bigint;

    protected constructor() { }

    public static fromInfo(info: IBSPZoneDecodeInfo_T) {
        const zone = new BSPZoneData();

        zone.connectivity = info.connectivity
        zone.visibility = info.visibility;

        return zone;
    }
}

class BSPLeafData {
    public zone: number
    public permiating: number
    public volumetric: number
    public visibleZones: bigint

    protected constructor() { }

    public static fromInfo(info: IBSPLeafDecodeInfo_T) {
        const leaf = new BSPLeafData();

        leaf.zone = info.zone;
        leaf.permiating = info.permiating;
        leaf.volumetric = info.volumetric;
        leaf.visibleZones = info.visibleZones;

        return leaf;
    }
}

class BSPNodeData {
    public back: number;
    public front: number;
    public plane = new Vector4();
    public readonly leaves: [number, number] = [0, 0];
    public readonly zones: [number, number] = [0, 0];
    public collision?: ICollisionInfo;

    protected constructor() { }

    public static fromInfo(info: IBSPNodeDecodeInfo_T) {
        const node = new BSPNodeData();

        [node.front, node.back] = info.children;

        node.plane.fromArray(info.plane);

        node.leaves[0] = info.leaves[0];
        node.leaves[1] = info.leaves[1];

        node.zones[0] = info.zones[0];
        node.zones[1] = info.zones[1];

        if ("collision" in info) {
            const bounds = new Box3();

            bounds.min.fromArray(info.collision.bounds.min);
            bounds.max.fromArray(info.collision.bounds.max);

            node.collision = {
                flags: info.collision.flags,
                bounds
            };
        }

        return node;
    }
}

export default ZoneObject;
export { ZoneObject, SectorObject };

interface ICollisionInfo {
    bounds: THREE.Box3,
    flags: number[]
}