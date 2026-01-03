import UAActor, { EPhysics_T } from "../un-aactor";
import { UObject } from "@l2js/core";
import FVector from "../un-vector";
import FMatrix from "@client/assets/unreal/un-matrix";
import GMath from "@client/assets/unreal/un-gmath";
import { indexToTime, timeToIndex, timeToIndicesLerp } from "@client/assets/unreal/un-l2env";
import FBox from "@client/assets/unreal/un-box";
abstract class FAccessory extends UObject {
    // public unkBytes: Uint8Array;

    // public load(pkg: UPackage, tag?: PropertyTag): this {
    //     this.unkBytes = new Uint8Array(pkg.read(BufferValue.allocBytes(11)).bytes.buffer);

    //     return this;
    // }
}

abstract class UStaticMeshActor extends UAActor {

    declare protected mesh: GA.UStaticMesh | GA.UTexture;
    declare protected instance: GA.UStaticMeshInstance;

    declare protected colLocation: FVector;
    declare protected touching: C.FIndexArray;
    declare protected isUpdatingShadow: boolean;
    declare protected stepSound1: GA.USound;
    declare protected stepSound2: GA.USound;
    declare protected stepSound3: GA.USound;
    declare protected isCollidingActors: boolean;

    declare protected isBlockingZeroExtentTraces: boolean;
    declare protected isBlockingNonZeroExtentTraces: boolean;

    declare protected forcedRegion: number;

    declare protected lodViewDuration: number;
    declare protected currentLod: number;
    declare protected isUnlit: boolean;
    declare protected isShadowCast: boolean;

    declare protected serverObjectID: number;
    declare protected serverObjectRealID: number;
    declare protected serverObjectType: number;

    declare protected hasStaticLighting: boolean;
    declare protected isLightingVisibile: boolean;

    declare protected isAgitDefaultStaticMesh: boolean;
    declare protected agitID: number;
    declare protected accessoryIndex: number;
    declare protected accessoryTypeList: C.FArray<FAccessory>;

    declare protected disableSorting: boolean;
    declare protected lodBias: number;

    declare protected leaves: GA.FLeaf[];

    // protected _agitStatus: any;
    // protected _currAccessoryType: any;
    // protected _bTimeReactor: any;
    // protected _showTime: any;
    // protected _hideTime: any;
    // protected _bExactProjectileCollision: any;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "StaticMesh": "mesh",
            "StaticMeshInstance": "instance",

            "ColLocation": "colLocation",
            "Touching": "touching",
            "bUpdateShadow": "isUpdatingShadow",
            "StepSound_1": "stepSound1",
            "StepSound_2": "stepSound2",
            "StepSound_3": "stepSound3",
            "bCollideActors": "isCollidingActors",
            "bBlockZeroExtentTraces": "isBlockingZeroExtentTraces",
            "bBlockNonZeroExtentTraces": "isBlockingNonZeroExtentTraces",

            "ForcedRegion": "forcedRegion",

            "L2LodViewDuration": "lodViewDuration",
            "L2CurrentLod": "currentLod",
            "bUnlit": "isUnlit",
            "bShadowCast": "isShadowCast",

            "L2ServerObjectType": "serverObjectType",
            "L2ServerObjectID": "serverObjectID",
            "L2ServerObjectRealID": "serverObjectRealID",


            "bStaticLighting": "hasStaticLighting",
            "bLightingVisibility": "isLightingVisibile",

            "bAgitDefaultStaticMesh": "isAgitDefaultStaticMesh",
            "AgitID": "agitID",
            "AccessoryIndex": "accessoryIndex",
            "AccessoryTypeList": "accessoryTypeList",

            "bDisableSorting": "disableSorting",
            "LODBias": "lodBias",

            "Leaves": "leaves",

            // "AgitStatus": "_agitStatus",
            // "CurrAccessoryType": "_currAccessoryType",
            // "bTimeReactor": "_bTimeReactor",
            // "ShowTime": "_showTime",
            // "HideTime": "_hideTime",
            // "bExactProjectileCollision": "_bExactProjectileCollision",
        });
    }

    // protected decodeSunlight(): ILightAmbientMaterialModifier {
    //     const timeOfDay = 1.58344516754150390625e1;
    //     const hsvPlane = new FNTimeHSV(15, 1, 255, 160);
    //     const hsvPlaneNext = new FNTimeHSV(16, 1, 255, 160);

    //     const t = (timeOfDay - hsvPlane.time) / (hsvPlaneNext.time - hsvPlane.time);

    //     const brightness = (hsvPlaneNext.lightness - hsvPlane.lightness) * t + hsvPlane.lightness;



    //     const someColor_88 = 1.0;
    //     const ambientBrightness = 1;
    //     const someColorPlane_64 = FPlane.make(8.213098049163818359375e-1, 8.213098049163818359375e-1, 8.213098049163818359375e-1, 1);

    //     const hsvPlane_4 = someColorPlane_64.multiplyScalar(hsvPlane.lightness * 0.003921569);
    //     const hsvPlane_5 = hsvPlane_4.multiplyScalar(someColor_88);
    //     const hsvPlane_8 = hsvPlane_5.multiplyScalar(ambientBrightness);

    //     const coord = FCoords.fromRotator(FRotator.make(
    //         0,          // pitch
    //         0,          // yaw
    //         0  // roll
    //     ));

    //     debugger;

    //     // const plane FPlane:: operator* (& hsvPlane_80, (FPlane *)someColorPlane_64, 1 * 0.003921569)

    //     const someActorByte = 0x13;

    //     if (someActorByte === 0x13) {

    //     } else {
    //         debugger;
    //     }

    //     debugger;

    //     return {
    //         type: "Lighting",
    //         lightType: "Ambient",
    //         brightness: 3,
    //         color: color//[99,101,141].map(v => v / 255) as [number, number, number]
    //     };
    // }

    protected sampleLightTest() {
        let someFlag = 1;
        let someIterator = 0;
        let some_6float_struct_it = 0;
        let piStack48_it = 0;

        for (let k: number, vertexCount = 0xB3; k < vertexCount; k = k + 1) {
            // if (piStack48 & someFlag) !== 0) {
            //     // fStack132 = some_6float_struct->field2_0x8;
            //     // fStack136 = some_6float_struct->field1_0x4;
            //     // fStack140 = some_6float_struct->field0_0x0;
            //     // f_lightIntensity = &param_3->field5_0x8;
            //     // uStack128 = 0x3f800000;
            //     // someVector1.x =
            //     //      param_3->field17_0x38 * 1.0 +
            //     //      fStack132 * param_3->field13_0x28 +
            //     //      fStack136 * param_3->field9_0x18 + fStack140 * *f_lightIntensity;
            //     // someVector1.z =
            //     //      param_3->field19_0x40 * 1.0 +
            //     //      fStack132 * param_3->field15_0x30 +
            //     //      fStack136 * param_3->field11_0x20 + fStack140 * param_3->field7_0x10;
            //     // someVector1.y =
            //     //      param_3->field18_0x3c * 1.0 +
            //     //      fStack132 * param_3->field14_0x2c +
            //     //      fStack136 * param_3->field10_0x1c + fStack140 * param_3->field6_0xc;
            //     // fStack148 = some_6float_struct->field5_0x14;
            //     // fStack152 = some_6float_struct->field4_0x10;
            //     // fStack156 = some_6float_struct->field3_0xc;
            //     // pfStack44 = &fStack156;
            //     // uStack144 = 0;
            //     // FVector::SafeNormal((FVector *)&FStack172,&FStack76);
            //     // fVar2 = *(float *)(param_3->field0_0x0 + 0x2c0) * 0.5;
            //     // pfStack44 = (float *)((float)FStack116.z * fVar2);
            //     // fStack124 = (float)FStack116.y * fVar2;
            //     // fVar2 = (float)FStack116.x * fVar2;
            //     // lightIntensity =
            //     //      FDynamicLight::SampleIntensity
            //     //                (likelyLightActor,
            //     //                 (FVectorLike)
            //     //                 CONCAT48(someVector1.z,CONCAT44(someVector1.y,someVector1.x)),
            //     //                 (FVectorLike)CONCAT48(FStack76.z,CONCAT44(FStack76.y,FStack76.x)))
            //     // ;
            //     // colorPlane.z = (int)((float)pfStack44 * lightIntensity);
            //     // colorPlane.y = (int)(fStack124 * lightIntensity);
            //     // colorPlane.x = (int)(fVar2 * lightIntensity);
            //     // colorPlane.w = 0;
            //     // someVector2.x = (float)colorPlane.x;
            //     // someVector2.y = (float)colorPlane.y;
            //     // someVector2.z = (float)colorPlane.z;
            //     // f_lightIntensity = (float *)lightIntensity;
            //     // arr_vertexColor = (FColor *)FColor::FColor(&FStack224,&colorPlane);
            //     // FColor::operator+=(someIterator,*arr_vertexColor);
            //     // paVar4 = paStack32;
            // }
            someIterator = someIterator + 1;
            some_6float_struct_it = some_6float_struct_it + 1;
            let bVar3 = someFlag & 0x7f;
            someFlag = someFlag << 1;
            if (bVar3 === 0) {
                piStack48_it = piStack48_it + 1;
                someFlag = 1;
            }
        }
    }

    public localToWorld(): FMatrix {
        const result = FMatrix.make();

        const SR = GMath().sin(this.rotation.roll),
            SP = GMath().sin(this.rotation.pitch),
            SY = GMath().sin(this.rotation.yaw),
            CR = GMath().cos(this.rotation.roll),
            CP = GMath().cos(this.rotation.pitch),
            CY = GMath().cos(this.rotation.yaw);

        const LX = this.location.x,
            LY = this.location.y,
            LZ = this.location.z,
            PX = this.prePivot.x,
            PY = this.prePivot.y,
            PZ = this.prePivot.z;

        const DX = this.scale.x * this.drawScale,
            DY = this.scale.y * this.drawScale,
            DZ = this.scale.z * this.drawScale;

        result[0][0] = CP * CY * DX;
        result[0][1] = CP * DX * SY;
        result[0][2] = DX * SP;
        result[0][3] = 0;

        result[1][0] = DY * (CY * SP * SR - CR * SY);
        result[1][1] = DY * (CR * CY + SP * SR * SY);
        result[1][2] = -CP * DY * SR;
        result[1][3] = 0;

        result[2][0] = -DZ * (CR * CY * SP + SR * SY);
        result[2][1] = DZ * (CY * SR - CR * SP * SY);
        result[2][2] = CP * CR * DZ;
        result[2][3] = 0;

        result[3][0] = LX - CP * CY * DX * PX + CR * CY * DZ * PZ * SP - CY * DY * PY * SP * SR + CR * DY * PY * SY + DZ * PZ * SR * SY;
        result[3][1] = LY - (CR * CY * DY * PY + CY * DZ * PZ * SR + CP * DX * PX * SY - CR * DZ * PZ * SP * SY + DY * PY * SP * SR * SY);
        result[3][2] = LZ - (CP * CR * DZ * PZ + DX * PX * SP - CP * DY * PY * SR);
        result[3][3] = 1;

        return result;
    }

    public getDecodeInfo(library: GD.DecodeLibrary): string {
        // Implementation based on UStaticMesh::Illuminate (UnStaticMesh.cpp:673-830)

        // Load mesh info early - needed for export regardless of early exit
        const mesh = this.mesh.loadSelf() as GA.UStaticMesh;
        const meshInfo = mesh.getDecodeInfo(library, null);

        const level = this.getLevel();
        const baseModel = level.getModel();
        const localToWorld = this.localToWorld();

        // Calculate bounding box for leaves (needed for export and lighting)
        const predictedBox = mesh.getRenderBoundingBox(this).transformBy(localToWorld);

        this.instance?.loadSelf().setActor(this);

        // Check if actor is static or mover without dynamic lighting
        // Note: In TypeScript, we don't have AMover type, so we'll check physics instead
        const isStatic = this.physics === EPhysics_T.PHYS_None;
        const isMoverWithoutDynamicLight = false; // TODO: Check if mover has bDynamicLightMover

        if (!isStatic && !isMoverWithoutDynamicLight) {
            // For non-static actors, export but skip lighting calculation
            this._exportActorToLibrary(library, meshInfo, null, predictedBox);
            return this.uuid;
        }

        // Skip if hidden in editor
        if (this.isHiddenInEditor) {
            // Still export actor even if hidden
            this._exportActorToLibrary(library, meshInfo, null, predictedBox);
            return this.uuid;
        }

        // Get leaves for ambient lighting calculation
        let leaves: GA.FLeaf[] = [];
        if (baseModel) {
            leaves = baseModel.boxLeaves(predictedBox);
        }

        // Get instance colors and prepare for lighting application
        // Note: The instance already has pre-computed visibility bits for lights!
        const attributes = library.geometries[meshInfo.geometry].attributes;
        const vertexArrayLen = attributes.positions.length;

        // Get base instance colors - this already has pre-computed visibility bits!
        const instance = (this.instance ? this.instance.getDecodeInfo(library) : {
            color: new Float32Array(vertexArrayLen).fill(0),
            lights: { scene: [], ambient: [] }
        });
        const instanceColors = instance.color;

        // Use pre-computed scene lights from instance instead of recalculating visibility bits
        // This is MUCH faster - visibility bits are already computed and stored in instance.lights.scene

        // Apply ambient lighting (same as getDecodeInfo)
        const envManager = this.levelInfo.getL2Env();
        const ambActor = this.getAmbientLightingActor();
        const zone = this.getZone();
        const ambVector = zone.ambientVector;

        let ambGlow: number;
        if (ambActor.ambientGlow === 255) {
            ambGlow = 1.0; // Full brightness for unlit
        } else {
            ambGlow = ambActor.ambientGlow / 255;
        }

        const ambGlowVec = FVector.make(ambGlow, ambGlow, ambGlow);
        const ambColor = ambVector.add(ambGlowVec);

        if (this.isUnlit) {
            for (let i = 0; i < vertexArrayLen; i += 3) {
                instanceColors[i + 0] += 0.5;
                instanceColors[i + 1] += 0.5;
                instanceColors[i + 2] += 0.5;
            }
        } else {
            let ambientVector = FVector.make();
            for (let leaf of leaves) {
                const iZone = leaf.iZone;
                const zoneInfo = baseModel.getZoneActor(iZone).loadSelf();
                const zoneAmbientVector = zoneInfo.ambientVector;

                ambientVector.x = Math.max(ambientVector.x, zoneAmbientVector.x);
                ambientVector.y = Math.max(ambientVector.y, zoneAmbientVector.y);
                ambientVector.z = Math.max(ambientVector.z, zoneAmbientVector.z);
            }

            for (let i = 0; i < vertexArrayLen; i += 3) {
                instanceColors[i + 0] += ambColor.x * 0.5;
                instanceColors[i + 1] += ambColor.y * 0.5;
                instanceColors[i + 2] += ambColor.z * 0.5;
            }
        }

        // Apply scene lights using PRE-COMPUTED visibility bits from instance
        // This is the key optimization - visibility bits are already calculated and stored!
        // Use the optimized helper function that uses pre-computed visibility bits
        applyStaticMeshLight(envManager.getCurrentEnvLight(), vertexArrayLen, instanceColors, this.scaleGlow, localToWorld, attributes, instance.lights.scene);

        // Process Lineage2-specific environment lights (sunlight lights)
        // These use pre-computed visibility bits from instance.environmentLights
        if (this.instance && this.instance.environmentLights.length > 0) {
            const lightCount = this.instance.environmentLights.length;

            if (lightCount >= 2) {
                const [currEnvIndex, nextEnvIndex, lerp] = timeToIndicesLerp(envManager.getTimeOfDay(), lightCount);

                // Use the optimized helper function that uses pre-computed visibility bits
                applyStaticMeshLightEnv(
                    envManager,
                    vertexArrayLen,
                    instanceColors,
                    this.scaleGlow,
                    localToWorld,
                    attributes,
                    [
                        [lerp, this.instance.environmentLights[currEnvIndex].getDecodeInfo(library)],
                        [lerp - 1, this.instance.environmentLights[nextEnvIndex].getDecodeInfo(library)]
                    ],
                );
            }
        }

        // Apply sunlight ambient if sun-affected
        if (this.isSunAffected) {
            const ambient = envManager.getAmbientPlaneStaticMeshSunLight();

            for (let i = 0; i < vertexArrayLen; i += 3) {
                instanceColors[i + 0] += ambient.x;
                instanceColors[i + 1] += ambient.y;
                instanceColors[i + 2] += ambient.z;
            }
        }

        // Final clamp after all lighting calculations
        // Note: Values > 1.0 are valid for HDR color space, but we clamp to [0, 1] for non-HDR output
        for (let i = 0; i < vertexArrayLen; i += 3) {
            instanceColors[i + 0] = Math.max(0, Math.min(1, instanceColors[i + 0]));
            instanceColors[i + 1] = Math.max(0, Math.min(1, instanceColors[i + 1]));
            instanceColors[i + 2] = Math.max(0, Math.min(1, instanceColors[i + 2]));
        }

        // Export actor to library with calculated per-vertex colors
        this._exportActorToLibrary(library, meshInfo, instanceColors, predictedBox);

        return this.uuid;
    }

    private _exportActorToLibrary(library: GD.DecodeLibrary, meshInfo: any, instanceColors: Float32Array | null, predictedBox: GA.FBox): void {
        // Export actor to library (UE2 style: associated with leaves)
        this.instance?.loadSelf().setActor(this);

        // Use provided instance colors or get from instance
        const geometryInfo = library.geometries[meshInfo.geometry];
        if (!geometryInfo) {
            console.warn(`Geometry info not found for meshInfo.geometry: ${meshInfo.geometry}, actor: ${this.objectName}`);
            return;
        }

        const attributes = geometryInfo.attributes;
        if (!instanceColors) {
            const instance = (this.instance ? this.instance.getDecodeInfo(library) : {
                color: new Float32Array(attributes.positions.length).fill(0),
                lights: { scene: [], ambient: [] }
            });
            instanceColors = instance.color;
        }

        const level = this.getLevel();
        const baseModel = level.getModel();
        const zone = this.getZone();
        const bspZoneIndex = library.bspZoneIndexMap[zone.uuid];
        const zoneInfo = library.bspZones[bspZoneIndex].zoneInfo;

        // debugger;

        // Align position to user's coordinate system (THREE.js compatible)
        const _position = this.location.getVectorElements(); // [x, z, y] - already converted
        const _scale = [this.scale.x * this.drawScale, this.scale.z * this.drawScale, this.scale.y * this.drawScale]; // [x, z, y] scale

        const actorInfo = {
            uuid: this.uuid,
            type: "StaticMeshActor",
            name: this.objectName,
            position: _position,
            scale: _scale,
            quaternion: this.rotation?.getQuaternion().toArray() || [0, 0, 0, 1],
            instance: {
                mesh: meshInfo,
                type: "StaticMeshInstance",
                uuid: this.instance ? this.instance.uuid : null,
                name: this.instance ? this.instance.objectName : null,
                attributes: { colors: instanceColors }
            } as GD.IStaticMeshInstanceDecodeInfo,
            bounds: {
                min: [predictedBox.min.x, predictedBox.min.z, predictedBox.min.y],
                max: [predictedBox.max.x, predictedBox.max.z, predictedBox.max.y]
            }
        } as GD.IStaticMeshActorDecodeInfo;

        // ACCURATE UE2: Inflate bounding box slightly (5%) to prevent aggressive popping at view edges
        const extent = predictedBox.getExtents();
        const margin = extent.multiplyScalar(0.05);
        const inflatedBox = FBox.make(predictedBox.min.sub(margin), predictedBox.max.add(margin), 1);

        // Update actorInfo with inflated bounds
        actorInfo.bounds = {
            min: [inflatedBox.min.x, inflatedBox.min.z, inflatedBox.min.y],
            max: [inflatedBox.max.x, inflatedBox.max.z, inflatedBox.max.y]
        };

        // ACCURATE UE2: Associate actor with all intersected leaves using the inflated box
        let actorZoneMask = 0n;
        if (baseModel) {
            const origin = inflatedBox.getCenter();
            const inflatedExtent = inflatedBox.getExtents();
            const leafIndices = baseModel.boxLeavesRecursive(0, origin, inflatedExtent);

            for (const leafIndex of leafIndices) {
                if (library.leafActors[leafIndex]) {
                    library.leafActors[leafIndex].push(actorInfo);
                }
                const leaf = library.bspLeaves[leafIndex];
                if (leaf && leaf.zone !== undefined && leaf.zone >= 0) {
                    actorZoneMask |= (1n << BigInt(leaf.zone));
                }
            }
        }

        (actorInfo as any).zoneMask = actorZoneMask;

        library.geometryInstances[meshInfo.geometry]++;

        if (geometryInfo.bounds?.box) {
            const { min, max } = geometryInfo.bounds.box;
            const _min = min.map((v, i) => v + _position[i]);
            const _max = max.map((v, i) => v + _position[i]);

            zoneInfo.bounds.isValid = true;

            [[Math.min, zoneInfo.bounds.min], [Math.max, zoneInfo.bounds.max]].forEach(
                ([fn, arr]: [(...values: number[]) => number, GD.Vector3Arr]) => {
                    for (let i = 0; i < 3; i++)
                        arr[i] = fn(arr[i], _min[i], _max[i]);
                }
            );
        }
    }

    public doLoad(pkg: C.APackage, exp: C.UExport) {
        super.doLoad(pkg, exp);

        this.readHead = pkg.tell();

        // if (this.objectName === "Exp_StaticMeshActor3008")
        //     debugger;

        return this;
    }
}

export default UStaticMeshActor;
export { UStaticMeshActor };

function fromColorPlane([r, g, b]: [number, number, number]) {
    let iVar1: number;

    /* 0x1000f  302  ??0FColor@@QAE@ABVFPlane@@@Z */
    iVar1 = Math.floor(r * 255.0);
    if (iVar1 < 0x0) {
        iVar1 = 0x0;
    }
    else if (0xfe < iVar1) {
        iVar1 = 0xff;
    }
    let _r = iVar1;
    iVar1 = Math.floor(g * 255.0);
    if (iVar1 < 0x0) {
        iVar1 = 0x0;
    }
    else if (0xfe < iVar1) {
        iVar1 = 0xff;
    }
    let _g = iVar1;
    iVar1 = Math.floor(b * 255.0);
    if (iVar1 < 0x0) {
        iVar1 = 0x0;
    }
    else if (0xfe < iVar1) {
        iVar1 = 0xff;
    }
    let _b = iVar1;

    return [_r, _g, _b];
}

function applyStaticMeshLightEnv(envManager: GA.UL2NEnvManager, vertexArrayLen: number, instanceColors: Float32Array, scaleGlow: number, localToWorld: FMatrix, attributes: { positions: Float32Array, normals: Float32Array }, lightEnvironment: [number, any][]) {
    const attrPositions = attributes.positions;
    const attrNormals = attributes.normals;

    const vertex = FVector.make();
    const normal = FVector.make();

    let r: number, g: number, b: number;

    const intensityArray = new Float32Array(instanceColors.length);

    for (let [lerp, lightInfo] of lightEnvironment) {
        if (!lightInfo) continue;

        if (!lightInfo || !lightInfo.light)
            debugger;

        const lightActor = lightInfo.light?.loadSelf();

        if (!lightActor) continue;

        const light = lightActor.getRenderInfo(envManager);

        const lightArray: C.FPrimitiveArray<"uint8"> = lightInfo.vertexFlags;
        const bitPtrIter = lightArray.iter();

        let bitMask = 0x1;
        let bitPtr = bitPtrIter.next().value;

        // const bytes = lightArray.getTypedArray();

        // debugger;

        const col = light.color;

        // debugger;

        for (let i = 0, vi = 0; i < vertexArrayLen; i += 3, vi++) {
            if ((bitPtr & bitMask) !== 0) {
                // debugger;

                const ox = i, oy = ox + 2, oz = ox + 1;

                vertex.set(attrPositions[ox], attrPositions[oy], attrPositions[oz]);
                normal.set(attrNormals[ox], attrNormals[oy], attrNormals[oz]);

                const samplingPoint = localToWorld.transformVector(vertex);
                const samplingNormal = localToWorld.transformNormal(normal).normalized();

                // if(i === 0) {
                //     debugger;
                // }

                const sampledInt = light.sampleIntensity(samplingPoint, samplingNormal);
                const intensity = lerp * 0.5 * scaleGlow * sampledInt;

                // debugger;

                // r = light.color.x * intensity;
                // g = light.color.y * intensity;
                // b = light.color.z * intensity;

                r = col.x * intensity;
                g = col.y * intensity;
                b = col.z * intensity;

                intensityArray[i + 0] = intensityArray[i + 0] + r;
                intensityArray[i + 1] = intensityArray[i + 1] + g;
                intensityArray[i + 2] = intensityArray[i + 2] + b;

                // console.log(`i => ${i} | int => ${intensity} | pos => ${samplingPoint} | rot => ${samplingNormal}`);
            }

            bitMask = (bitMask << 1) % 0x100; // check for byte overflow

            if (!bitMask) {
                bitPtr = bitPtrIter.next().value;
                bitMask = 1;
            }

            // if ((bitMask & 0x7f) === 0x0) {
            //     bitPtr = bitPtrIter.next().value;
            //     bitMask = 0x1;
            // } else bitMask = bitMask << 0x1;
        }
    }

    // const ambientColor = lightEnvironment ? lightEnvironment.color : [0, 0, 0];

    for (let i = 0; i < vertexArrayLen; i += 3) {
        instanceColors[i + 0] = instanceColors[i + 0] + (intensityArray[i + 0] /* (lightsScene.length - 1)*/) //+ ambientColor[0];
        instanceColors[i + 1] = instanceColors[i + 1] + (intensityArray[i + 1] /* (lightsScene.length - 1)*/) //+ ambientColor[1];
        instanceColors[i + 2] = instanceColors[i + 2] + (intensityArray[i + 2] /* (lightsScene.length - 1)*/) //+ ambientColor[2];
    }
}

function applyStaticMeshLight(env: GA.UL2NEnvLight, vertexArrayLen: number, instanceColors: Float32Array, scaleGlow: number, localToWorld: FMatrix, attributes: { positions: Float32Array, normals: Float32Array }, lightsScene: any[]) {
    // if ((vertexArrayLen / 3) !== 0x42)
    //     return;
    // if ((vertexArrayLen / 3) !== 0x69)
    //     return;
    // if ((vertexArrayLen / 3) === 0xC)
    //     return;
    const attrPositions = attributes.positions;
    const attrNormals = attributes.normals;

    const vertex = FVector.make();
    const normal = FVector.make();

    let r: number, g: number, b: number;

    const intensityArray = new Float32Array(instanceColors.length);

    // debugger;

    let i = -1;

    for (let lightInfo of lightsScene) {
        i++;
        if (!lightInfo) continue;

        if (!lightInfo || !lightInfo.light)
            debugger;

        const lightActor = lightInfo.light?.loadSelf();

        if (!lightActor) continue;

        const light = lightActor.getRenderInfo(env);

        if (light.dynamic) continue;

        const lightArray: C.FPrimitiveArray<"uint8"> = lightInfo.vertexFlags;
        const bitPtrIter = lightArray.iter();

        let bitMask = 0x1;
        let bitPtr = bitPtrIter.next().value;

        // const _arr = lightArray.getTypedArray()
        // const _sum = lightArray.getTypedArray().reduce((acc, v) => acc + (v ? 1 : 0), 0)

        // if (_sum > 0)
        //     debugger;

        // if (_sum === 0)
        //     continue;

        // debugger;

        for (let i = 0, vi = 0; i < vertexArrayLen; i += 3, vi++) {
            if ((bitPtr & bitMask) !== 0) {
                // debugger;
                const ox = i, oy = ox + 2, oz = ox + 1;

                vertex.set(attrPositions[ox], attrPositions[oy], attrPositions[oz]);
                normal.set(attrNormals[ox], attrNormals[oy], attrNormals[oz]);

                const samplingPoint = localToWorld.transformVector(vertex);
                const samplingNormal = localToWorld.transformNormal(normal).normalized();

                // if(i === 0) {
                //     debugger;
                // }

                const intensity = scaleGlow * light.sampleIntensity(samplingPoint, samplingNormal);

                r = light.color.x * intensity;
                g = light.color.y * intensity;
                b = light.color.z * intensity;

                intensityArray[i + 0] = intensityArray[i + 0] + r;
                intensityArray[i + 1] = intensityArray[i + 1] + g;
                intensityArray[i + 2] = intensityArray[i + 2] + b;

                // console.log(`i => ${i} | int => ${intensity} | pos => ${samplingPoint} | rot => ${samplingNormal}`);
            }

            bitMask = (bitMask << 1) % 0x100; // check for byte overflow

            if (!bitMask) {
                bitPtr = bitPtrIter.next().value;
                bitMask = 1;
            }

            // const bResetMask = (bitMask << 1) === 0;

            // bitMask = bitMask << 1;

            // if (bResetMask) {
            //     bitPtr = bitPtrIter.next().value;
            //     bitMask = 1;
            // }

            // if ((bitMask & 0x7f) === 0x0) {
            //     bitPtr = bitPtrIter.next().value;
            //     bitMask = 0x1;
            // } else bitMask = bitMask << 0x1;
        }
    }

    // debugger;

    // const ambientColor = lightEnvironment ? lightEnvironment.color : [0, 0, 0];

    for (let i = 0; i < vertexArrayLen; i += 3) {
        instanceColors[i + 0] = instanceColors[i + 0] + (intensityArray[i + 0] /* (lightsScene.length - 1)*/) //+ ambientColor[0];
        instanceColors[i + 1] = instanceColors[i + 1] + (intensityArray[i + 1] /* (lightsScene.length - 1)*/) //+ ambientColor[1];
        instanceColors[i + 2] = instanceColors[i + 2] + (intensityArray[i + 2] /* (lightsScene.length - 1)*/) //+ ambientColor[2];
    }
}