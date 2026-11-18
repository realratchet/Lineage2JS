import UAActor from "./un-aactor";
import type { IBoxDecodeInfo } from "./un-box";
import type UConvexVolume from "./un-convex-volume";
import type { Vector3Arr, Vector4Arr } from "./library-types";
import type UModel from "./model/un-model";

export type AntiPortalDecodeInfo_T = {
    uuid: string,
    bounds: IBoxDecodeInfo,
    faces: { plane: Vector4Arr, vertices: Vector3Arr[] }[],
    edges: [number, number, number, number][],
    zoneMask: bigint,
    cullDistance: number
};

export abstract class UAntiPortalActor extends UAActor {
    declare protected readonly antiPortal: UConvexVolume;
    declare protected readonly cullDistance: number;

    protected getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), { "AntiPortal": "antiPortal", "CullDistance": "cullDistance" });
    }

    public getDecodeInfo(model: UModel): AntiPortalDecodeInfo_T | null {
        if (!this.antiPortal) return null;

        const volume = this.antiPortal.loadSelf();
        const matrix = this.localToWorld(), adjoint = matrix.transposeAdjoint();
        const box = volume.getRenderBoundingBox().transformBy(matrix);
        const zoneMask = model.boxLeaves(box, this.forcedRegionTag, this.forcedRegion).reduce((mask, leaf) => mask | 1n << BigInt(leaf.iZone), 0n);
        const faces = volume.faces.map(({ plane, vertices }) => {
            const world = plane.transformByUsingAdjointT(matrix, adjoint);
            const points = vertices.map(vertex => matrix.transformVector(vertex).getElements());

            return { plane: [world.x, world.y, world.z, -world.w] as Vector4Arr, vertices: points };
        });

        return { uuid: this.uuid, bounds: box.getDecodeInfo(), faces, edges: volume.edges, zoneMask, cullDistance: this.cullDistance };
    }
}

export default UAntiPortalActor;
