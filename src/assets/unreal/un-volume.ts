import UBrush from "./un-brush";
import type { IActorCollisionDecodeInfo } from "./un-aactor";
import FPlane from "./un-plane";
import type { Vector4Arr, Matrix4Arr } from "./library-types";
import type { IBoxDecodeInfo } from "./un-box";

export type IMusicVolumeBspNode = {
    plane: Vector4Arr;
    iFront: number;
    iBack: number;
    isCsg: boolean;
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

        const nodes: IMusicVolumeBspNode[] = brush.getBspNodes().map((node: any) => ({
            plane: node.plane.transformByUsingAdjointT(localToWorld, matrixTA, tmpPlane).getElements(),
            iFront: node.iFront,
            iBack: node.iBack,
            isCsg: brush.isCsg(node)
        }));

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
