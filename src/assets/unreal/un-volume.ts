import UBrush from "./un-brush";
import type { Vector4Arr, Matrix4Arr } from "./library-types";

type IMusicVolumeBspNode = {
    plane: Vector4Arr;
    iFront: number;
    iBack: number;
    isCsg: boolean;
};

type IVolumeBspDecodeInfo = {
    isRootOutside: boolean;
    worldToLocal: Matrix4Arr;
    nodes: IMusicVolumeBspNode[];
};

abstract class UVolume extends UBrush {
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
        const pX = localToWorld.planeX, pY = localToWorld.planeY, pZ = localToWorld.planeZ;
        const det = pX.x * (pY.y * pZ.z - pY.z * pZ.y)
                  - pX.y * (pY.x * pZ.z - pY.z * pZ.x)
                  + pX.z * (pY.x * pZ.y - pY.y * pZ.x);

        const nodes: IMusicVolumeBspNode[] = brush.getBspNodes().map((node: any) => {
            const plane = node.plane;
            let nx = matrixTA.planeX.x * plane.x + matrixTA.planeY.x * plane.y + matrixTA.planeZ.x * plane.z;
            let ny = matrixTA.planeX.y * plane.x + matrixTA.planeY.y * plane.y + matrixTA.planeZ.y * plane.z;
            let nz = matrixTA.planeX.z * plane.x + matrixTA.planeY.z * plane.y + matrixTA.planeZ.z * plane.z;
            const length = Math.sqrt(nx * nx + ny * ny + nz * nz);

            if (length > 1e-8) {
                nx /= length;
                ny /= length;
                nz /= length;
            }

            if (det < 0) {
                nx = -nx;
                ny = -ny;
                nz = -nz;
            }

            const sx = plane.x * plane.w, sy = plane.y * plane.w, sz = plane.z * plane.w;
            const px = localToWorld.planeX.x * sx + localToWorld.planeY.x * sy + localToWorld.planeZ.x * sz + localToWorld.planeW.x;
            const py = localToWorld.planeX.y * sx + localToWorld.planeY.y * sy + localToWorld.planeZ.y * sz + localToWorld.planeW.y;
            const pz = localToWorld.planeX.z * sx + localToWorld.planeY.z * sy + localToWorld.planeZ.z * sz + localToWorld.planeW.z;

            return {
                plane: [nx, ny, nz, px * nx + py * ny + pz * nz] as Vector4Arr,
                iFront: node.iFront,
                iBack: node.iBack,
                isCsg: brush.isCsg(node)
            };
        });

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
export { UVolume };
export type { IMusicVolumeBspNode, IVolumeBspDecodeInfo };
