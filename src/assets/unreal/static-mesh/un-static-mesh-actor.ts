import UAActor, { EPhysics_T } from "../un-aactor";
import { UObject } from "@l2js/core";
import FVector from "../un-vector";
import FMatrix from "@client/assets/unreal/un-matrix";
import GMath from "@client/assets/unreal/un-gmath";
import { indexToTime, timeToIndex, timeToIndicesLerp } from "@client/assets/unreal/un-l2env";
import FBox from "@client/assets/unreal/un-box";
import { Matrix4, Vector3, Quaternion } from "three";
import { FStaticMeshLightInfo } from "@client/assets/unreal/static-mesh/un-static-mesh-instance";

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

    public getDecodeInfo(library: GD.DecodeLibrary): string {
        const mesh = this.mesh.loadSelf() as GA.UStaticMesh;
        const meshInfo = mesh.getDecodeInfo(library, null);

        const level = this.getLevel();
        const baseModel = level.getModel();
        const localToWorld = this.localToWorld();

        // Calculate bounding box for leaves (needed for export and lighting)
        const predictedBox = mesh.getRenderBoundingBox(this).transformBy(localToWorld);

        this.instance?.loadSelf().setActor(this);

        const isStatic = this.physics === EPhysics_T.PHYS_None;
        const isMoverWithoutDynamicLight = false; // TODO: Check if mover has bDynamicLightMover

        if (!isStatic && !isMoverWithoutDynamicLight) {
            this._exportActorToLibrary(library, meshInfo, null, predictedBox, null);
            return this.uuid;
        }

        if (this.isHiddenInEditor) {
            // Still export actor even if hidden, is this really needed?
            this._exportActorToLibrary(library, meshInfo, null, predictedBox, null);
            return this.uuid;
        }

        let leaves: GA.FLeaf[] = [];
        if (baseModel) {
            leaves = baseModel.boxLeaves(predictedBox);
        }

        const attributes = library.geometries[meshInfo.geometry].attributes as { positions: Float32Array, normals: Float32Array };
        const vertexArrayLen = attributes.positions.length;
        const instance = this.instance ? this.instance.getDecodeInfo(library) : null

        const instanceColors = instance?.color ?? new Float32Array(vertexArrayLen).fill(0);

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


        // const lightInfo = {
        //     scene: instance.lights.scene.map
        // }

        // debugger;

        const mat4 = new Matrix4().fromArray(this.getWorldMatrixElements());

        // const lightInfos = {
        //     sceneLights: 
        // }

        // applyStaticMeshLight(envManager.getCurrentEnvLight(), vertexArrayLen, instanceColors, this.scaleGlow, localToWorld, attributes, this.instance.sceneLights, mat4);

        // if (this.instance && this.instance.environmentLights.length > 0) {
        //     const lightCount = this.instance.environmentLights.length;

        //     if (lightCount >= 2) {
        //         const [currEnvIndex, nextEnvIndex, lerp] = timeToIndicesLerp(envManager.getTimeOfDay(), lightCount);

        //         applyStaticMeshLightEnv(
        //             envManager,
        //             vertexArrayLen,
        //             instanceColors,
        //             this.scaleGlow,
        //             localToWorld,
        //             attributes,
        //             [
        //                 [lerp, this.instance.environmentLights[currEnvIndex].getDecodeInfo(library)],
        //                 [lerp - 1, this.instance.environmentLights[nextEnvIndex].getDecodeInfo(library)]
        //             ],
        //         );
        //     }
        // }

        if (this.isSunAffected) {
            const ambient = envManager.getAmbientPlaneStaticMeshSunLight();

            for (let i = 0; i < vertexArrayLen; i += 3) {
                instanceColors[i + 0] += ambient.x;
                instanceColors[i + 1] += ambient.y;
                instanceColors[i + 2] += ambient.z;
            }
        }

        for (let i = 0; i < vertexArrayLen; i += 3) {
            instanceColors[i + 0] = Math.max(0, Math.min(1, instanceColors[i + 0]));
            instanceColors[i + 1] = Math.max(0, Math.min(1, instanceColors[i + 1]));
            instanceColors[i + 2] = Math.max(0, Math.min(1, instanceColors[i + 2]));
        }

        // debugger;

        this._exportActorToLibrary(library, meshInfo, instanceColors, predictedBox, instance?.lights);

        return this.uuid;
    }

    private _exportActorToLibrary(library: GD.DecodeLibrary, meshInfo: any, instanceColors: Float32Array | null, predictedBox: GA.FBox, lights?: GD.ILightInstanceDecodeInfo): void {
        this.instance?.loadSelf().setActor(this);

        const geometryInfo = library.geometries[meshInfo.geometry];
        if (!geometryInfo) {
            console.warn(`Geometry info not found for meshInfo.geometry: ${meshInfo.geometry}, actor: ${this.objectName}`);
            return;
        }

        // const attributes = geometryInfo.attributes;
        // if (!instanceColors) {
        //     const instance = (this.instance ? this.instance.getDecodeInfo(library) : {
        //         color: new Float32Array(attributes.positions.length).fill(0),
        //         lights: { scene: [], ambient: [] }
        //     });
        //     instanceColors = instance.color;
        // }

        const level = this.getLevel();
        const baseModel = level.getModel();
        const zone = this.getZone();
        const bspZoneIndex = library.bspZoneIndexMap[zone.uuid];
        const zoneInfo = library.bspZones[bspZoneIndex].zoneInfo;

        const _position = this.location.getVectorElements();

        const actorInfo = {
            uuid: this.uuid,
            type: "StaticMeshActor",
            name: this.objectName,
            position: _position,
            scaledGlow: this.scaleGlow,
            scale: this.scale?.multiplyScalar(this.drawScale).getVectorElements() || [1, 1, 1],
            quaternion: this.rotation?.getQuaternionElements() || [0, 0, 0, 1],
            instance: {
                mesh: meshInfo,
                type: "StaticMeshInstance",
                uuid: this.instance?.uuid || null,
                name: this.instance?.objectName || null,
                attributes: { colors: instanceColors },
                lights
            } as GD.IStaticMeshInstanceDecodeInfo,
            bounds: {
                min: [predictedBox.min.x, predictedBox.min.z, predictedBox.min.y],
                max: [predictedBox.max.x, predictedBox.max.z, predictedBox.max.y]
            }
        } as GD.IStaticMeshActorDecodeInfo;

        const extent = predictedBox.getExtents();
        const margin = extent.multiplyScalar(0.05);
        const inflatedBox = FBox.make(predictedBox.min.sub(margin), predictedBox.max.add(margin), 1);

        actorInfo.bounds = {
            isValid: true,
            min: [inflatedBox.min.x, inflatedBox.min.z, inflatedBox.min.y],
            max: [inflatedBox.max.x, inflatedBox.max.z, inflatedBox.max.y]
        };

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
}

export default UStaticMeshActor;
export { UStaticMeshActor };


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

        // debugger;

        const lightActor = lightInfo.light?.loadSelf();

        if (!lightActor) continue;

        const light = lightActor.getRenderInfo(envManager);

        const lightArray: C.FPrimitiveArray<"uint8"> = lightInfo.vertexFlags;
        const bitPtrIter = lightArray.iter();

        let bitMask = 0x1;
        let bitPtr = bitPtrIter.next().value;

        const col = light.color;

        for (let i = 0, vi = 0; i < vertexArrayLen; i += 3, vi++) {
            if ((bitPtr & bitMask) !== 0) {
                const ox = i, oy = ox + 2, oz = ox + 1;

                vertex.set(attrPositions[ox], attrPositions[oy], attrPositions[oz]);
                normal.set(attrNormals[ox], attrNormals[oy], attrNormals[oz]);

                const samplingPoint = localToWorld.transformVector(vertex);
                const samplingNormal = localToWorld.transformNormal(normal).normalized();

                const sampledInt = light.sampleIntensity(samplingPoint, samplingNormal);
                const intensity = lerp * 0.5 * scaleGlow * sampledInt;
                r = col.x * intensity;
                g = col.y * intensity;
                b = col.z * intensity;

                intensityArray[i + 0] = intensityArray[i + 0] + r;
                intensityArray[i + 1] = intensityArray[i + 1] + g;
                intensityArray[i + 2] = intensityArray[i + 2] + b;
            }

            bitMask = (bitMask << 1) % 0x100; // check for byte overflow

            if (!bitMask) {
                bitPtr = bitPtrIter.next().value;
                bitMask = 1;
            }
        }
    }

    for (let i = 0; i < vertexArrayLen; i += 3) {
        instanceColors[i + 0] = instanceColors[i + 0] + (intensityArray[i + 0] /* (lightsScene.length - 1)*/) //+ ambientColor[0];
        instanceColors[i + 1] = instanceColors[i + 1] + (intensityArray[i + 1] /* (lightsScene.length - 1)*/) //+ ambientColor[1];
        instanceColors[i + 2] = instanceColors[i + 2] + (intensityArray[i + 2] /* (lightsScene.length - 1)*/) //+ ambientColor[2];
    }
}

function applyStaticMeshLight(env: GA.UL2NEnvManager, vertexArrayLen: number, instanceColors: Float32Array, scaleGlow: number, localToWorld: FMatrix, attributes: { positions: Float32Array, normals: Float32Array }, lightsScene: FStaticMeshLightInfo[], mat4) {
    const attrPositions = attributes.positions;
    const attrNormals = attributes.normals;

    const vertex = FVector.make();
    const normal = FVector.make();

    let r: number, g: number, b: number;

    const intensityArray = new Float32Array(instanceColors.length);

    let j_i = -1;

    for (let lightInfo of lightsScene) {
        j_i++;
        if (!lightInfo) continue;

        if (!lightInfo || !lightInfo.light)
            debugger;

        const lightActor: GA.ULight = lightInfo.light?.loadSelf();

        if (!lightActor) continue;

        // debugger;

        const light = lightActor.getRenderInfo(env);

        if (light.dynamic) {
            debugger;
            continue;
        }

        const lightArray: C.FPrimitiveArray<"uint8"> = lightInfo.vertexFlags;
        const bitPtrIter = lightArray.iter();

        let bitMask = 0x1;
        let bitPtr = bitPtrIter.next().value;

        for (let i = 0, vi = 0; i < vertexArrayLen; i += 3, vi++) {
            if ((bitPtr & bitMask) !== 0) {
                const ox = i, oy = ox + 2, oz = ox + 1;

                vertex.set(attrPositions[ox], attrPositions[oy], attrPositions[oz]);
                normal.set(attrNormals[ox], attrNormals[oy], attrNormals[oz]);

                const samplingPoint = localToWorld.transformVector(vertex, vertex);
                const samplingNormal = localToWorld.transformNormal(normal, normal).normalized();

                // if (vi === 288 && j_i === 3)
                //     debugger

                const intensity = scaleGlow * light.sampleIntensity(samplingPoint, samplingNormal);

                // if (Math.abs(intensity) > 0)
                //     debugger;

                1
                // debugger;


                // {
                //     const v = new Vector3(attrPositions[ox], attrPositions[oz], attrPositions[oy]).applyMatrix4(mat4);
                //     const n = new Vector3(attrNormals[ox], attrNormals[oz], attrNormals[oy]).transformDirection(mat4);

                //     const dvx = v.x - samplingPoint.x, dvy = v.z - samplingPoint.y, dvz = v.y - samplingPoint.z;
                //     const dnx = n.x - samplingNormal.x, dny = n.z - samplingNormal.y, dnz = n.y - samplingNormal.z;

                //     // console.log(`diff position: ${dvx}, ${dvy}, ${dvz}`);
                //     // console.log(`diff normal: ${dnx}, ${dny}, ${dnz}`);

                //     debugger;

                //     if (
                //         Math.abs(dvx) > 1e-5 || Math.abs(dvy) > 1e-5 || Math.abs(dvz) > 1e-5 ||
                //         Math.abs(dnx) > 1e-5 || Math.abs(dny) > 1e-5 || Math.abs(dnz) > 1e-5
                //     )
                //         debugger;
                // }

                r = light.color.x * intensity;
                g = light.color.y * intensity;
                b = light.color.z * intensity;

                if (vi === 311) {
                    console.log(`j_i: ${j_i}, vi: ${vi}, intensity: ${intensity}, r: ${r}, g: ${g}, b: ${b}`);
                }

                intensityArray[i + 0] = intensityArray[i + 0] + r;
                intensityArray[i + 1] = intensityArray[i + 1] + g;
                intensityArray[i + 2] = intensityArray[i + 2] + b;
            }

            bitMask = (bitMask << 1) % 0x100; // check for byte overflow

            if (!bitMask) {
                bitPtr = bitPtrIter.next().value;
                bitMask = 1;
            }
        }
    }

    // debugger

    for (let i = 0; i < vertexArrayLen; i += 3) {
        instanceColors[i + 0] = instanceColors[i + 0] + (intensityArray[i + 0] /* (lightsScene.length - 1)*/) //+ ambientColor[0];
        instanceColors[i + 1] = instanceColors[i + 1] + (intensityArray[i + 1] /* (lightsScene.length - 1)*/) //+ ambientColor[1];
        instanceColors[i + 2] = instanceColors[i + 2] + (intensityArray[i + 2] /* (lightsScene.length - 1)*/) //+ ambientColor[2];
    }
}