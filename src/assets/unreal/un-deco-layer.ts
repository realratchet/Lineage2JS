import UObject from "./un-object";
import FVector from "./un-vector";
import type { FRange, FRangeVector } from "./un-range";
import type { UTexture } from "./un-texture";
import type { UStaticMesh, IStaticMeshObjectDecodeInfo } from "./static-mesh/un-static-mesh";
import type { ATerrainInfo } from "./un-terrain-info";
import type { UTerrainSector } from "./un-terrain-sector";
import type { DecodeLibraryBuilder } from "./decode-library-builder";
import type { Vector3Arr } from "./library-types";
import type { IBaseObjectDecodeInfo } from "./decode-library";

export type ITerrainDecorationDecodeInfo = IBaseObjectDecodeInfo & {
    type: "TerrainDecoration",
    terrainSegment: string,
    mesh: IStaticMeshObjectDecodeInfo,
    matrices: Float32Array,
    colors: Uint8Array,
    terrainVertexIndices?: Uint16Array,
    fadeoutRadius: [number, number],
    drawOrder: number,
    forceRender: boolean
};

type DecoRandom_T = { seed: number };

const tmpLocation: Vector3Arr = [0, 0, 0];
const tmpNormal: Vector3Arr = [0, 0, 0];

function getSRand(random: DecoRandom_T) {
    random.seed = (Math.imul(random.seed, 196314165) + 907633515) | 0;

    return (random.seed & 0x007fffff) / 0x00800000;
}

function getRangeSRand(range: FRange, random: DecoRandom_T) {
    return range.max + (range.min - range.max) * getSRand(random);
}

function setDecorationMatrix(matrices: number[] | Float32Array, offset: number, location: Vector3Arr, normal: Vector3Arr, scale: Vector3Arr, randomYaw: boolean, random: DecoRandom_T) {
    const rad = Math.PI / 32768;
    const pitch = Math.atan2(normal[2], Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1])) / rad - 16384;
    const yaw = randomYaw ? Math.floor(65535 * getSRand(random)) : Math.atan2(normal[1], normal[0]) / rad;
    const sp = Math.sin(pitch * rad), cp = Math.cos(pitch * rad);
    const sy = Math.sin(yaw * rad), cy = Math.cos(yaw * rad);

    matrices[offset + 0] = cp * cy * scale[0];
    matrices[offset + 1] = cp * sy * scale[0];
    matrices[offset + 2] = sp * scale[0];
    matrices[offset + 3] = 0;
    matrices[offset + 4] = -sy * scale[1];
    matrices[offset + 5] = cy * scale[1];
    matrices[offset + 6] = 0;
    matrices[offset + 7] = 0;
    matrices[offset + 8] = -cy * sp * scale[2];
    matrices[offset + 9] = -sy * sp * scale[2];
    matrices[offset + 10] = cp * scale[2];
    matrices[offset + 11] = 0;
    matrices[offset + 12] = location[0];
    matrices[offset + 13] = location[1];
    matrices[offset + 14] = location[2];
    matrices[offset + 15] = 1;
}

export abstract class UDecoLayer extends UObject {
    declare protected readonly showOnTerrain: number;
    declare protected readonly scaleMap: UTexture;
    declare protected readonly densityMap: UTexture;
    declare protected readonly colorMap: UTexture;
    declare public readonly staticMesh: UStaticMesh;
    declare protected readonly scaleMultiplier: FRangeVector;
    declare protected readonly ambientSoundType: number[];
    declare protected readonly size: number;
    declare protected readonly fadeoutRadius: FRange;
    declare protected readonly densityMultiplier: FRange;
    declare protected readonly maxPerQuad: number;
    declare protected readonly seed: number;
    declare protected readonly alignToTerrain: number;
    declare protected readonly drawOrder: number;
    declare protected readonly isShowOnInvisibleTerrain: number;
    declare protected readonly dirLighting: number;
    declare protected readonly disregardTerrainLighting: number;
    declare protected readonly randomYaw: number;
    declare protected readonly isForcingRender: number;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "ShowOnTerrain": "showOnTerrain",
            "ScaleMap": "scaleMap",
            "DensityMap": "densityMap",
            "ColorMap": "colorMap",
            "StaticMesh": "staticMesh",
            "ScaleMultiplier": "scaleMultiplier",
            "Seed": "seed",
            "AlignToTerrain": "alignToTerrain",
            "AmbientSoundType": "ambientSoundType",
            "FadeoutRadius": "fadeoutRadius",
            "DensityMultiplier": "densityMultiplier",
            "MaxPerQuad": "maxPerQuad",
            "DrawOrder": "drawOrder",
            "ShowOnInvisibleTerrain": "isShowOnInvisibleTerrain",
            "LitDirectional": "dirLighting",
            "DisregardTerrainLighting": "disregardTerrainLighting",
            "RandomYaw": "randomYaw",
            "bForceRender": "isForcingRender"
        });
    }

    public getDecodeInfo(builder: DecodeLibraryBuilder, info: ATerrainInfo, sectors: UTerrainSector[], decoLayerOffset: number): ITerrainDecorationDecodeInfo[] {
        if (!this.showOnTerrain || !this.staticMesh || !this.densityMap || this.maxPerQuad <= 0) return [];

        const library = builder.library;
        const mesh = builder.pullStaticMesh(this.staticMesh);
        const scaleRange = this.scaleMultiplier.getDecodeInfo(library);
        const fadeoutRadius = this.fadeoutRadius.getDecodeInfo(library);
        const inverted = info.isInvertedTerrain();
        const result: ITerrainDecorationDecodeInfo[] = [];

        sectors.forEach((sector, sectorIndex) => {
            const { offsetX, offsetY, quadsX, quadsY } = sector.getDecorationInfo();
            const random: DecoRandom_T = { seed: (this.seed + sectorIndex) | 0 };
            const matrices: number[] = [];
            const colors: number[] = [];
            const terrainVertexIndices: number[] = [];

            for (let y = 0; y < quadsY; y++) {
                for (let x = 0; x < quadsX; x++) {
                    const globalX = offsetX + x;
                    const globalY = offsetY + y;

                    if (!this.isShowOnInvisibleTerrain && !info.getQuadVisibilityBitmap(globalX, globalY)) continue;

                    const density = info.getLayerAlpha(globalX, globalY, 0, this.densityMap) / 255;

                    for (let i = 0; i < this.maxPerQuad; i++) {
                        if (getSRand(random) >= density * getRangeSRand(this.densityMultiplier, random)) continue;

                        const randX = getSRand(random);
                        const randY = getSRand(random);
                        const base = info.vertices[info.getGlobalVertex(globalX + (randX > randY ? 1 : 0), globalY + (randX > randY ? 0 : 1))];
                        const a = info.vertices[info.getGlobalVertex(globalX, globalY)];
                        const b = info.vertices[info.getGlobalVertex(globalX + 1, globalY + 1)];
                        const ax = a.x - base.x, ay = a.y - base.y, az = a.z - base.z;
                        const bx = b.x - base.x, by = b.y - base.y, bz = b.z - base.z;
                        const scaleX = randX > randY ? 1 - randX : randX;
                        const scaleY = randX > randY ? randY : 1 - randY;

                        FVector.setElements(tmpLocation, (base.x + ax * scaleX) + bx * scaleY, (base.y + ay * scaleX) + by * scaleY, (base.z + az * scaleX) + bz * scaleY);
                        FVector.setElements(tmpNormal, ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx);
                        FVector.safeNormalElements(tmpNormal, tmpNormal);
                        if (tmpNormal[2] < 0) FVector.scaleElements(tmpNormal, -1, tmpNormal);
                        if (inverted) FVector.scaleElements(tmpNormal, -1, tmpNormal);
                        if (!this.alignToTerrain) FVector.setElements(tmpNormal, 0, 0, inverted ? -1 : 1);

                        FVector.setElements(tmpLocation, tmpLocation[0] + tmpNormal[0] * decoLayerOffset, tmpLocation[1] + tmpNormal[1] * decoLayerOffset, tmpLocation[2] + tmpNormal[2] * decoLayerOffset);

                        const scale: Vector3Arr = [
                            scaleRange.max[0] + (scaleRange.min[0] - scaleRange.max[0]) * getSRand(random),
                            scaleRange.max[1] + (scaleRange.min[1] - scaleRange.max[1]) * getSRand(random),
                            scaleRange.max[2] + (scaleRange.min[2] - scaleRange.max[2]) * getSRand(random)
                        ];

                        if (this.scaleMap) {
                            const mapScale = info.getTextureColor(globalX, globalY, this.scaleMap);
                            scale[0] *= mapScale[0];
                            scale[1] *= mapScale[1];
                            scale[2] *= mapScale[2];
                        }

                        const matrixOffset = matrices.length;
                        matrices.length += 16;
                        setDecorationMatrix(matrices, matrixOffset, tmpLocation, tmpNormal, scale, !!this.randomYaw, random);

                        const color = this.colorMap ? info.getTextureColor(globalX, globalY, this.colorMap) : [1, 1, 1] as Vector3Arr;
                        const baseColor = this.disregardTerrainLighting ? 127 : 255;
                        colors.push(Math.floor(baseColor * color[0]), Math.floor(baseColor * color[1]), Math.floor(baseColor * color[2]));
                        if (!this.disregardTerrainLighting) terrainVertexIndices.push(y * 17 + x);
                    }
                }
            }

            if (matrices.length === 0) return;

            result.push({
                uuid: `${this.uuid}:${sector.uuid}`,
                type: "TerrainDecoration",
                name: `${this.objectName || "DecorationLayer"}_${sectorIndex}`,
                terrainSegment: sector.uuid,
                mesh,
                matrices: new Float32Array(matrices),
                colors: new Uint8Array(colors),
                terrainVertexIndices: this.disregardTerrainLighting ? undefined : new Uint16Array(terrainVertexIndices),
                fadeoutRadius,
                drawOrder: this.drawOrder,
                forceRender: !!this.isForcingRender
            });
        });

        return result;
    }
}

export default UDecoLayer;
