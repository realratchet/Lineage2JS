import UBrush from "./un-brush";
import type { IActorCollisionDecodeInfo } from "./un-aactor";
import FPlane from "./un-plane";
import type { IBSPNodeCollisionInfo_T } from "./bsp/un-bsp-node";
import type { Vector4Arr, Matrix4Arr } from "./library-types";
import type { IBoxDecodeInfo } from "./un-box";

export type IMusicVolumeBspNode = {
    plane: Vector4Arr;
    iFront: number;
    iBack: number;
    isCsg: boolean;
    collision?: IBSPNodeCollisionInfo_T;
};

export type IVolumeBspDecodeInfo = {
    bounds: IBoxDecodeInfo;
    isRootOutside: boolean;
    worldToLocal: Matrix4Arr;
    nodes: IMusicVolumeBspNode[];
};

export abstract class UVolume extends UBrush {
    declare protected locationPriority: number;

    protected getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "LocationPriority": "locationPriority"
        })
    }

    public getCollisionDecodeInfo(): IActorCollisionDecodeInfo {
        return {
            collideActors: this.isCollidingActors,
            collideWorld: this.isCollidingWorld,
            blockActors: this.isBlockingActors,
            blockPlayers: this.isBlockingPlayers,
            blockZeroExtent: this.isBlockingZeroExtentTraces,
            blockNonZeroExtent: this.isBlockingNonZeroExtentTraces,
            worldGeometry: this.isWorldGeometry,
            useCylinderCollision: false,
            collisionRadius: this.collisionRadius,
            collisionHeight: this.collisionHeight
        };
    }

    protected getWorldBspInfo(): IVolumeBspDecodeInfo {
        const brush = this.brush.loadSelf();
        const localToWorld = this.localToWorld();
        const matrixTA = localToWorld.transposeAdjoint();
        const tmpPlane = FPlane.make();

        const nodes: IMusicVolumeBspNode[] = brush.getBspNodes().map((node: any) => {
            const info: IMusicVolumeBspNode = { plane: node.plane.transformByUsingAdjointT(localToWorld, matrixTA, tmpPlane).getElements(), iFront: node.iFront, iBack: node.iBack, isCsg: brush.isCsg(node) };

            if (node.iCollisionBound < 0) return info;

            const hull = brush.getLeafHull(node), min = hull.bounds.min, max = hull.bounds.max;
            const worldMin = [Infinity, Infinity, Infinity], worldMax = [-Infinity, -Infinity, -Infinity];

            for (let c = 0; c < 8; c++) {
                const x = c & 1 ? max[0] : min[0], y = c & 2 ? max[1] : min[1], z = c & 4 ? max[2] : min[2];
                const px = localToWorld.planeX.x * x + localToWorld.planeY.x * y + localToWorld.planeZ.x * z + localToWorld.planeW.x;
                const py = localToWorld.planeX.y * x + localToWorld.planeY.y * y + localToWorld.planeZ.y * z + localToWorld.planeW.y;
                const pz = localToWorld.planeX.z * x + localToWorld.planeY.z * y + localToWorld.planeZ.z * z + localToWorld.planeW.z;

                worldMin[0] = Math.min(worldMin[0], px);
                worldMin[1] = Math.min(worldMin[1], py);
                worldMin[2] = Math.min(worldMin[2], pz);
                worldMax[0] = Math.max(worldMax[0], px);
                worldMax[1] = Math.max(worldMax[1], py);
                worldMax[2] = Math.max(worldMax[2], pz);
            }

            info.collision = {
                flags: hull.flags,
                bounds: { isValid: true, min: worldMin as any, max: worldMax as any },
                boxPlanes: [[0, 0, -1, 0.1 - min[2]], [0, 0, 1, max[2] + 0.1], [-1, 0, 0, 0.1 - min[0]], [1, 0, 0, max[0] - 0.1], [0, -1, 0, 0.1 - min[1]], [0, 1, 0, max[1] - 0.1]].map(plane => {
                    tmpPlane.set(plane[0], plane[1], plane[2], plane[3]);

                    return tmpPlane.transformByUsingAdjointT(localToWorld, matrixTA, tmpPlane).getElements();
                })
            };

            return info;
        });

        return {
            bounds: brush.getCollisionBoundingBox(this).getDecodeInfo(),
            isRootOutside: brush.getIsRootOutside(),
            worldToLocal: localToWorld.toArray(),
            nodes
        };
    }

    public getDecodeInfo(library?: any): any {
        return {
            uuid: this.uuid,
            type: "Volume",
            name: this.objectName,
            bounds: this.brush.loadSelf().decodeBoundsInfo()
        };
    }
}

export default UVolume;
