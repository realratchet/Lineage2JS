import { type APackage, type Constructable_T, FArray } from "@l2js/core";
import type { UTexture } from "../un-texture";
import type { Vector3Arr } from "../library-types";

class FBSPVertex implements Constructable_T {
    public position: Vector3Arr;
    public u: number;
    public v: number;
    public u2: number;
    public v2: number;
    public normal: Vector3Arr | null;

    public load(pkg: APackage): this {
        const hasNormal = pkg.header.getArchiveFileVersion() >= 109;
        const data = pkg.read(hasNormal ? 10 * 4 : 7 * 4);

        this.position = [data.getFloat32(0, true), data.getFloat32(4, true), data.getFloat32(8, true)];
        this.u = data.getFloat32(12, true);
        this.v = data.getFloat32(16, true);
        this.u2 = data.getFloat32(20, true);
        this.v2 = data.getFloat32(24, true);
        this.normal = hasNormal ? [data.getFloat32(28, true), data.getFloat32(32, true), data.getFloat32(36, true)] : null;

        return this;
    }
}

class FBSPSection implements Constructable_T {
    public bspVertices = new FArray(FBSPVertex);
    public textureId: number;
    public texture: UTexture;

    public revision: number;
    public numNodes: number;
    public polyFlags: number;
    public lightmapTextureIndex: number;

    public load(pkg: APackage): this {
        this.bspVertices.load(pkg);
        this.revision = pkg.read("int32");

        this.textureId = pkg.read("compat32");

        this.numNodes = pkg.read("int32");
        this.polyFlags = pkg.read("int32");
        this.lightmapTextureIndex = pkg.read("int32");

        this.texture = pkg.fetchObject<UTexture>(this.textureId);

        return this;
    }
}

export default FBSPSection;
export { FBSPSection, FBSPVertex };
