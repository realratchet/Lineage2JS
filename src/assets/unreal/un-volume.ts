import UBrush from "./un-brush";
import FPlane from "./un-plane";
import type { Vector4Arr, Matrix4Arr } from "./library-types";

export type IMusicVolumeBspNode = {
    plane: Vector4Arr;
    iFront: number;
    iBack: number;
    isCsg: boolean;
};

export type IVolumeBspDecodeInfo = {
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