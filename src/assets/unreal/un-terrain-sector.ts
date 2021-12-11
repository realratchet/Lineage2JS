import UPackage from "./un-package";
import UObject from "./un-object";
import FBox from "./un-box";
import BufferValue from "../buffer-value";
import FArray from "./un-array";
import FUnknownStruct from "./un-unknown-struct";
import FNumber from "./un-number";
// import { Object3D, Texture, DataTexture, BufferGeometry, Float32Attribute, Uint16BufferAttribute, MeshBasicMaterial, Mesh, Float32BufferAttribute, DoubleSide, Sphere, Box3 } from "three";

// type UExport = import("./un-export").UExport;
// type UTerrainInfo = import("./un-terrain-info").UTerrainInfo;
// type UTerrainLayer = import("./un-terrain-layer").UTerrainLayer;

class UTerrainSector extends UObject {
    protected readHeadOffset = 0;
    protected boundingBox: FBox = new FBox();
    protected offsetX: number;
    protected offsetY: number;
    protected info: UTerrainInfo;
    protected cellNum: number;
    protected sectorWidth: number;

    protected unkId0: number;
    protected unkNum0: number;
    protected unkNum1: number;
    protected unkNum2: number;

    protected unkBuf0: any;

    protected unkArr8: FArray<FNumber> = new FArray(class FUnknownStructExt extends FUnknownStruct {
        public static readonly typeSize = 40;

        constructor() {
            super(40);
        }
    });

    // likely lightning
    protected unkArr0: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.uint8) as any);
    protected unkArr1: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.uint8) as any);
    protected unkArr2: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.uint8) as any);
    protected unkArr3: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.uint8) as any);
    protected unkArr4: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.uint8) as any);
    protected unkArr5: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.uint8) as any);
    protected unkArr6: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.uint8) as any);
    protected unkArr7: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.uint8) as any);

    protected texInfo: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.uint16) as any);

    public constructor(terrainInfo: UTerrainInfo) {
        super();

        // debugger;

        this.info = terrainInfo;
    }

    public async getDecodeInfo(library: IDecodeLibrary): Promise<IStaticMeshObjectDecodeInfo> {
        if (this.uuid in library.geometries) return {
            type: "TerrainSegment",
            name: this.objectName,
            geometry: this.uuid,
            materials: this.uuid,
        } as IStaticMeshObjectDecodeInfo;

        library.geometries[this.uuid] = null;
        library.materials[this.uuid] = null;

        await Promise.all(this.promisesLoading);

        const iTerrainMap = library.materials[this.info.terrainMap.uuid] as ITextureDecodeInfo;
        const width = iTerrainMap.width;
        const data = iTerrainMap.buffer as Uint16Array;
        const vertices = new Float32Array(17 * 17 * 3), indices = new Uint16Array(16 * 16 * 6);
        const { x: sx, y: sy, z: sz } = this.info.terrainScale;

        for (let y = 0; y < 17; y++) {
            for (let x = 0; x < 17; x++) {
                const hmx = x + this.offsetX;
                const hmy = y + this.offsetY;
                const offset = Math.min(hmy, 255) * width + Math.min(hmx, 255);
                const height = (data[offset] - 32768) / 128;
                const idxOffset = (y * 17 + x) * 3;

                vertices[idxOffset + 0] = hmx * sx;
                vertices[idxOffset + 1] = height * sz / 2;
                vertices[idxOffset + 2] = hmy * sy;
            }
        }

        for (let y = 0; y < 16; y++) {
            for (let x = 0; x < 16; x++) {
                // const quadX = sectorX * 16 + x;
                // const quadZ = sectorY * 16 + y;
                // const quadIndex = quadZ * 256 + quadX;
                // const quadValue = this.info.quadVisibilityBitmap.getElem(quadIndex >> 3).value;
                // const isVisible = quadValue & (0x00000001 << (quadIndex % 8));
                const isVisible = true;
                const idxOffset = (y * 16 + x) * 6;

                if (!isVisible) {

                    indices[idxOffset + 0] = y * 17 + x;
                    indices[idxOffset + 1] = y * 17 + x;
                    indices[idxOffset + 2] = y * 17 + x;

                    indices[idxOffset + 3] = y * 17 + x;
                    indices[idxOffset + 4] = y * 17 + x;
                    indices[idxOffset + 5] = y * 17 + x;
                    continue;
                }

                indices[idxOffset + 0] = (y * 17 + x);
                indices[idxOffset + 1] = ((y + 1) * 17 + x);
                indices[idxOffset + 2] = (y * 17 + (x + 1));

                indices[idxOffset + 3] = (y * 17 + (x + 1));
                indices[idxOffset + 4] = ((y + 1) * 17 + x);
                indices[idxOffset + 5] = ((y + 1) * 17 + (x + 1));
            }
        }

        const itLayer = this.info.layers.values();
        const layerCount = this.info.layers.size;
        const uvs: { uv: Float32Array, map: string }[] = new Array(layerCount);

        debugger;

        for (let k = 0; k < layerCount; k++) {
            const layer = itLayer.next().value as UTerrainLayer;

            if (!layer.map || layer.map.mipmaps.getElemCount() === 0) {
                uvs[k] = { uv: null, map: null };
                continue;
            }

            const { uv } = uvs[k] = {
                uv: new Float32Array(17 * 17 * 2),
                map: await layer.map.getDecodeInfo(library)
            };

            // const usx = layer.scaleW * sx * 2.0;
            // const usy = layer.scaleH * sy * 2.0;

            for (let y = 0; y < 17; y++) {
                for (let x = 0; x < 17; x++) {
                    const hmx = x + this.offsetX;
                    const hmy = y + this.offsetY;
                    const idxOffset = (y * 17 + x) * 2;

                    uv[idxOffset + 0] = hmx / layer.map.width;
                    uv[idxOffset + 1] = hmy / layer.map.height;
                }
            }
        }

        library.geometries[this.uuid] = {
            attributes: {
                positions: vertices,
                uvs: uvs.map(x => x.uv)
            },
            indices,
            bounds: this.decodeBoundsInfo()
        };

        library.materials[this.uuid] = {
            materialType: "terrain",
            layers: uvs.map(x => x.map)
        } as IMaterialTerrainDecodeInfo;

        return {
            type: "TerrainSegment",
            geometry: this.uuid,
            materials: this.uuid
        };
    }

    public decodeBoundsInfo(): IBoundsDecodeInfo {
        return {
            box: this.boundingBox.isValid ? {
                min: [this.boundingBox.min.x, this.boundingBox.min.z, this.boundingBox.min.y],
                max: [this.boundingBox.max.x, this.boundingBox.max.z, this.boundingBox.max.y]
            } : null
        };
    }

    public async decodeMesh(heightMap: Texture) {
        // const [sectorX, sectorY] = [this.offsetX, this.offsetY].map(v => v / 256);
        const vertices = new Float32Array(17 * 17 * 3);
        const { data, width, height } = heightMap.image;

        // console.log(sectorX, sectorY, this.offsetX, this.offsetY);

        // debugger;

        const { x: sx, y: sy, z: sz } = this.info.terrainScale;

        // debugger;

        for (let y = 0; y < 17; y++) {
            for (let x = 0; x < 17; x++) {
                const hmx = x + this.offsetX;
                const hmy = y + this.offsetY;
                const offset = Math.min(hmy, 255) * width + Math.min(hmx, 255);
                const height = (data[offset] - 32768) / 128;
                const idxOffset = (y * 17 + x) * 3;

                vertices[idxOffset + 0] = hmx * sx;
                vertices[idxOffset + 1] = height * sz / 2;
                vertices[idxOffset + 2] = hmy * sy;
            }
        }

        const indices = new Uint16Array(16 * 16 * 6);

        for (let y = 0; y < 16; y++) {
            for (let x = 0; x < 16; x++) {
                // const quadX = sectorX * 16 + x;
                // const quadZ = sectorY * 16 + y;
                // const quadIndex = quadZ * 256 + quadX;
                // const quadValue = this.info.quadVisibilityBitmap.getElem(quadIndex >> 3).value;
                // const isVisible = quadValue & (0x00000001 << (quadIndex % 8));
                const isVisible = true;
                const idxOffset = (y * 16 + x) * 6;

                if (!isVisible) {

                    indices[idxOffset + 0] = y * 17 + x;
                    indices[idxOffset + 1] = y * 17 + x;
                    indices[idxOffset + 2] = y * 17 + x;

                    indices[idxOffset + 3] = y * 17 + x;
                    indices[idxOffset + 4] = y * 17 + x;
                    indices[idxOffset + 5] = y * 17 + x;
                    continue;
                }

                indices[idxOffset + 0] = (y * 17 + x);
                indices[idxOffset + 1] = ((y + 1) * 17 + x);
                indices[idxOffset + 2] = (y * 17 + (x + 1));

                indices[idxOffset + 3] = (y * 17 + (x + 1));
                indices[idxOffset + 4] = ((y + 1) * 17 + x);
                indices[idxOffset + 5] = ((y + 1) * 17 + (x + 1));
            }
        }

        const itLayer = this.info.layers.values();
        const layerCount = this.info.layers.size;
        const uvs = new Array(layerCount);

        for (let k = 0; k < layerCount; k++) {
            const layer = itLayer.next().value as UTerrainLayer;

            if (!layer.map || layer.map.mipmaps.getElemCount() === 0) {
                uvs[k] = { uv: null, map: null };
                continue;
            }

            const { uv } = uvs[k] = {
                uv: new Array(17 * 17 * 2),
                map: await layer.map.decodeMipmap(0)
            };

            // const usx = layer.scaleW * sx * 2.0;
            // const usy = layer.scaleH * sy * 2.0;

            for (let y = 0; y < 17; y++) {
                for (let x = 0; x < 17; x++) {
                    const hmx = x + this.offsetX;
                    const hmy = y + this.offsetY;
                    const idxOffset = (y * 17 + x) * 2;

                    uv[idxOffset + 0] = hmx / layer.map.width;
                    uv[idxOffset + 1] = hmy / layer.map.height;
                }
            }
        }

        const material = new MeshBasicMaterial({ /*color: Math.round(0xffffff * Math.random()), wireframe: true*/ color: 0xff00ff });
        const geometry = new BufferGeometry();
        const attrPosition = new Float32BufferAttribute(vertices, 3);
        const attrIndices = new Uint16BufferAttribute(indices, 1);
        const mesh = new Mesh(geometry, material);

        geometry.setIndex(attrIndices);

        if (this.boundingBox.isValid) {
            geometry.boundingBox = new Box3(this.boundingBox.min, this.boundingBox.max);
            geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new Sphere());
        } else {
            mesh.frustumCulled = false;
        }

        geometry.setAttribute("position", attrPosition);
        uvs
            .forEach(({ uv, map }, index) => {
                if (map === null) return;

                const attr = new Float32BufferAttribute(uv, 2);

                geometry.setAttribute(`uv${index === 0 ? "" : (index + 1)}`, attr);

                (material as any)[`map${index === 0 ? "" : (index + 1)}`] = map;
            });

        return mesh;
    }

    public doLoad(pkg: UPackage, exp: UExport) {
        // pkg.seek(exp.offset.value as number, "set");
        // console.info(exp.objectName);

        this.setReadPointers(exp);
        pkg.seek(this.readHead, "set");

        // pkg.dump(1, true, false);
        pkg.seek(1);

        this.unkId0 = pkg.read(new BufferValue(BufferValue.compat32)).value as number;

        // const uint16 = new BufferValue(BufferValue.uint16);
        // const int32 = new BufferValue(BufferValue.int32);
        const uint32 = new BufferValue(BufferValue.uint32);

        // pkg.dump(1, true, false);

        this.unkNum0 = pkg.read(uint32).value as number;
        this.unkNum1 = pkg.read(uint32).value as number;

        // console.log(this.unkNum0, this.unkNum1)

        // this.unkNum2 = pkg.read(uint16).value as number;

        // debugger;

        this.offsetX = pkg.read(uint32).value as number;
        this.offsetY = pkg.read(uint32).value as number;

        // console.log(this.offsetX, this.offsetY);

        // debugger;

        this.boundingBox.load(pkg);
        this.unkArr8.load(pkg);

        this.cellNum = pkg.read(uint32).value as number;
        this.sectorWidth = pkg.read(uint32).value as number;

        this.unkArr0.load(pkg);

        this.unkArr1.load(pkg);
        this.unkArr2.load(pkg);
        this.unkArr3.load(pkg);
        this.unkArr4.load(pkg);
        this.unkArr5.load(pkg);
        this.unkArr6.load(pkg);
        this.unkArr7.load(pkg);

        pkg.seek(64); // unknown 

        this.texInfo.load(pkg);

        return this;
    }
}

export default UTerrainSector;
export { UTerrainSector };