import DynamicLight from "./dynamic-light";
import { BufferGeometry, Material, Sphere, SkinnedMesh, Vector3 } from "three";
import { ColorByte } from "../utils/color-byte";
import type { IDynamicHairDecodeInfo } from "@l2js/engine/contracts/skeletal-mesh";
import type { PawnLight_T } from "../rendering/components/pawn-light-component";
import type MeshStaticMaterial from "../materials/mesh-static-material/mesh-static-material";

const tmpColorByte = new ColorByte();
const arrEmptyLights: DynamicLight[] = [];
const arrEmptyPawnLights: PawnLight_T[] = [];
const arrNoAmbient = [0, 0, 0];

export class LitSkinnedMesh extends SkinnedMesh {
    declare public readonly isLitSkinnedMesh: boolean;

    public scaledGlow: number = 1;
    public ambientGlow: number = 0;
    public isUnlit: boolean = false;
    public dynamicHairInfo: IDynamicHairDecodeInfo = null;
    public readonly meshOrigin = new Vector3();
    public tagAliases: string[] = [];
    public tagNames: string[] = [];
    public tagOrigins: Vector3Arr[] = [];

    public constructor(geometry: BufferGeometry, material: Material | Material[]) {
        super(geometry, material);

        (this as any).isLitSkinnedMesh = true;
    }

    public updateActorLighting(zoneInfo: any, lights: DynamicLight[], sunAmbient: ColorByte, pawnLights: readonly PawnLight_T[] = arrEmptyPawnLights, sphere: Sphere = null) {
        if (this.isUnlit) {
            // unlit renders at 1x: EnableLighting(0,0) + SetAmbientLight(255) (UnSkeletalMesh.cpp line 4900), 127 = 1.0 in the Modulate2X domain
            tmpColorByte.set(127, 127, 127);
            lights = arrEmptyLights;
            pawnLights = arrEmptyPawnLights;
        } else if (zoneInfo?.isSunAffected) {
            // one env plane, halved per byte (shr at 0x959d63) - the sun itself arrives as a hardware light
            tmpColorByte.copy(sunAmbient);
        } else {
            // SetAmbientLight 0x959d96 uses the unshifted zone color; retail measured (40,40,40).
            const ambient = zoneInfo?.ambient ?? arrNoAmbient;

            tmpColorByte.set(
                ambient[0] + this.ambientGlow,
                ambient[1] + this.ambientGlow,
                ambient[2] + this.ambientGlow
            );
        }

        const materials = this.material;
        const materialCount = Array.isArray(materials) ? materials.length : 1;

        for (let materialIndex = 0; materialIndex < materialCount; materialIndex++) {
            const material = Array.isArray(materials) ? materials[materialIndex] : materials;
            const uniforms = (material as any)?.uniforms;

            if (!uniforms?.actorLights) continue;

            (material as MeshStaticMaterial).updateActorLighting(tmpColorByte, this.scaledGlow, lights, pawnLights, sphere ? sphere.center : null, sphere ? sphere.radius : 0);
        }
    }
}

export default LitSkinnedMesh;
