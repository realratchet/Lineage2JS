import UVolume from "@client/assets/unreal/un-volume";

abstract class UMusicVolume extends UVolume {
    declare protected musicId: number;
    declare protected isMusicForced: boolean;
    declare protected isMusicLooped: boolean;

    protected getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "nMusicID": "musicId",
            "bForcePlayMusic": "isMusicForced",
            "bLoopMusic": "isMusicLooped",
        })
    }

    public getDecodeInfo(library: GD.DecodeLibrary) {
        const region = this.getRegion()?.loadSelf();

        const brush = this.brush.loadSelf();
        const localToWorld = this.localToWorld();
        const matrixTA = localToWorld.transposeAdjoint();
        // Compute determinant of upper-left 3x3 for sign check
        const pX = localToWorld.planeX, pY = localToWorld.planeY, pZ = localToWorld.planeZ;
        const det = pX.x * (pY.y * pZ.z - pY.z * pZ.y)
                  - pX.y * (pY.x * pZ.z - pY.z * pZ.x)
                  + pX.z * (pY.x * pZ.y - pY.y * pZ.x);

        // Pre-bake world-space BSP planes at export time (UE2: TransformByUsingAdjointT)
        const bspNodes: GD.IMusicVolumeBspNode[] = brush.getBspNodes().map((n: any) => {
            const p = n.plane; // local-space plane {x,y,z,w}

            // UE2: newNorm = TA.TransformNormal(plane_normal).SafeNormal()
            let nx = matrixTA.planeX.x * p.x + matrixTA.planeY.x * p.y + matrixTA.planeZ.x * p.z;
            let ny = matrixTA.planeX.y * p.x + matrixTA.planeY.y * p.y + matrixTA.planeZ.y * p.z;
            let nz = matrixTA.planeX.z * p.x + matrixTA.planeY.z * p.y + matrixTA.planeZ.z * p.z;

            let len = Math.sqrt(nx * nx + ny * ny + nz * nz);
            if (len > 1e-8) { nx /= len; ny /= len; nz /= len; }

            // UE2: if (M.Determinant() < 0) newNorm *= -1
            if (det < 0) { nx = -nx; ny = -ny; nz = -nz; }

            // UE2: pointOnPlane = M.TransformFVector(plane_normal * W)
            const sx = p.x * p.w, sy = p.y * p.w, sz = p.z * p.w;
            const px = localToWorld.planeX.x * sx + localToWorld.planeY.x * sy + localToWorld.planeZ.x * sz + localToWorld.planeW.x;
            const py = localToWorld.planeX.y * sx + localToWorld.planeY.y * sy + localToWorld.planeZ.y * sz + localToWorld.planeW.y;
            const pz = localToWorld.planeX.z * sx + localToWorld.planeY.z * sy + localToWorld.planeZ.z * sz + localToWorld.planeW.z;

            // W = dot(pointOnPlane, normal)
            const w = px * nx + py * ny + pz * nz;

            return {
                plane: [nx, ny, nz, w] as GD.Vector4Arr,
                iFront: n.iFront,
                iBack: n.iBack,
                isCsg: brush.isCsg(n)
            };
        });

        const decodeInfo: GD.IMusicVolumeDecodeInfo = {
            ...super.getDecodeInfo(),
            type: "MusicVolume",
            musicId: this.musicId,
            isMusicForced: this.isMusicForced,
            isMusicLooped: this.isMusicLooped,
            zoneNumber: region.getZoneNumber(),
            priority: this.locationPriority,
            bsp: {
                isRootOutside: brush.getIsRootOutside(),
                worldToLocal: localToWorld.toArray(),
                nodes: bspNodes
            }
        };

        return decodeInfo;
    }
}

export default UMusicVolume;
export { UMusicVolume };
