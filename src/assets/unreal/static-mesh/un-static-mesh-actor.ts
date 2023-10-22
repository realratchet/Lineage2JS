import UAActor, { EPhysics_T } from "../un-aactor";
import { UObject } from "@l2js/core";
import FVector from "../un-vector";
import FMatrix from "@client/assets/unreal/un-matrix";
import GMath from "@client/assets/unreal/un-gmath";
import { Euler, MathUtils, Matrix4, Quaternion, Vector3 } from "three";
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
        // if (this.objectName === "Exp_StaticMeshActor140" || this.objectName === "Exp_StaticMeshActor141")
        //     debugger;

        this.instance?.loadSelf().setActor(this);

        // debugger;

        // if (this.colLocation.sub(this.location).length() > 1e-3)
        //     debugger;

        const lights: GD.ILightDecodeInfo[] = []
            // const lights: ILightDecodeInfo[] = (await this.instance.getDecodeInfo(library))
            .filter((l: GD.ILightDecodeInfo) => l.lightType === 7)
        //.filter((l: ILightDecodeInfo) => l.directional)
        // .filter((l: ILightDecodeInfo) => l.isDynamic)

        // debugger;

        const siblings = [...lights];
        const zone = this.getZone();

        let hasModifier = false;
        let modifierUuid: string;

        // if (zone?.ambientVector) {
        //     hasModifier = true;
        //     modifierUuid = zone.uuid;

        //     if (!(modifierUuid in library.materialModifiers)) {
        //         library.materialModifiers[modifierUuid] = {
        //             type: "Lighting",
        //             lightType: "Directional",
        //             brightness: zone.ambientBrightness,
        //             direction: zone.ambientVector.getVectorElements()
        //         } as ILightDirectionalMaterialModifier;
        //     }

        //     // debugger;
        // }

        // if (this.isSunAffected) {
        //     hasModifier = true;
        //     modifierUuid = generateUUID();

        //     library.materialModifiers[modifierUuid] = this.decodeSunlight();
        // }

        // console.log("Leaf | Mesh:", this.region.uuid);

        // debugger;

        // if (this.objectName === "Exp_StaticMeshActor810")
        //     debugger;

        // debugger;
        // console.clear();
        console.warn(this.exp.objectName)

        const mesh = this.mesh.loadSelf();
        const env = this.levelInfo.getL2Env();
        const level = this.getLevel();
        const baseModel = level.getModel();

        const localToWorld = this.localToWorld();

        // if (this.instance)
        //     debugger;

        // debugger;

        const meshInfo = mesh.getDecodeInfo(library, hasModifier ? [modifierUuid] : null);
        const attributes = library.geometries[meshInfo.geometry].attributes;
        const instance = (this.instance ? this.instance.getDecodeInfo(library) : {
            color: new Float32Array(attributes.positions.length).fill(0),
            lights: { scene: [], ambient: [] }
        });

        // if (mesh.name === "Exp_oren_curumadungeon77" && instance.lights.scene.length === 10) {
        //     console.log("probably object:", this.exportIndex + 1);
        // }

        const vertexArrayLen = attributes.positions.length;
        const instanceColors = instance.color;
        // const position = new FVector(), normal = new FVector(), color = new FPlane();
        // const position = new Vector3(), normal = new Vector3(), color = FPlane.make();

        // const currentPosition = new Vector3().fromArray(this.location.getVectorElements());

        // const scale = new Vector3().fromArray(this.scale.getVectorElements()).multiplyScalar(this.drawScale);
        // const euler = new Euler().fromArray(this.rotation?.getEulerElements() || [0, 0, 0, "XYZ"]);
        // const quaternion = new Quaternion().setFromEuler(euler);

        // // let someFlag = 0x1;

        // const matrix = new Matrix4().compose(currentPosition, quaternion, scale);
        // // const lightPosition = new Vector3();



        // if ((vertexArrayLen / 3) === 0x84 && this.instance.sceneLights.length === 0xE) {
        //     console.log("correct:", this.objectName, "exp:", this.exportIndex + 1);
        //     // debugger;
        // }

        // if (this.mesh.vertexStream.vert.length === 0xb3)
        //     debugger;

        // const baseColor = env.getBaseColorPlaneStaticMeshSunLight()
        // debugger;

        let predictedBox: FBox;

        if (this.physics !== EPhysics_T.PHYS_None) {
            debugger;
            throw new Error("not implemented");
        } else {
            predictedBox = (this.mesh as GA.UStaticMesh).getRenderBoundingBox(this).transformBy(this.localToWorld());
        }

        let leaves: GA.FLeaf[];

        if (baseModel) {
            leaves = baseModel.boxLeaves(predictedBox);
        } else leaves = new Array<GA.FLeaf>();

        if (!this.forcedVisibilityZoneTag) {
            debugger;
            throw new Error("not implemented");
        }


        {
            const ambActor = this.getAmbientLightingActor();
            const zone = this.getZone();
            const ambVector = zone.ambientVector;

            let ambGlow: number;

            if (ambActor.ambientGlow === 255) {
                debugger;
                throw new Error("not yet implemented")
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
                    const zoneInfo = baseModel.getZoneActor(iZone);
                    const zoneAmbientVector = zoneInfo.ambientVector;

                    ambientVector.x = Math.max(ambientVector.x, zoneAmbientVector.x);
                    ambientVector.y = Math.max(ambientVector.y, zoneAmbientVector.y);
                    ambientVector.z = Math.max(ambientVector.z, zoneAmbientVector.z);
                }

                let ambColor = ambientVector;
                // let ambColor = FVector.make();

                for (let i = 0; i < vertexArrayLen; i += 3) {
                    instanceColors[i + 0] += ambColor.x * 0.5;
                    instanceColors[i + 1] += ambColor.y * 0.5;
                    instanceColors[i + 2] += ambColor.z * 0.5;
                }

                // debugger;

                // if (zone?.ambientVector) {
                //     for (let i = 0; i < vertexArrayLen; i += 3) {
                //         instanceColors[i + 0] += ambColor.x * 0.5;
                //         instanceColors[i + 1] += ambColor.y * 0.5;
                //         instanceColors[i + 2] += ambColor.z * 0.5;
                //     }
                // }
            }

        }

        // if (this.getAmbientLightingActor().ambientGlow > 0) {
        //     debugger;
        // }

        // if (this.isUnlit) {
        //     for (let i = 0; i < vertexArrayLen; i += 3) {
        //         instanceColors[i + 0] += 0.5;
        //         instanceColors[i + 1] += 0.5;
        //         instanceColors[i + 2] += 0.5;
        //     }
        // }
        //  else
        // if (zone?.ambientVector) {
        //     for (let i = 0; i < vertexArrayLen; i += 3) {
        //         instanceColors[i + 0] += (zone.ambientVector.x * this.ambientGlow) * 0.5;
        //         instanceColors[i + 1] += (zone.ambientVector.y * this.ambientGlow) * 0.5;
        //         instanceColors[i + 2] += (zone.ambientVector.z * this.ambientGlow) * 0.5;
        //     }
        // }

        // if(this.)

        applyStaticMeshLight(env, vertexArrayLen, instanceColors, this.scaleGlow, localToWorld, attributes, instance.lights.scene);

        if (this.instance?.environmentLights.length > 0) {
            const lightCount = this.instance.environmentLights.length;

            if (lightCount < 2)
                debugger;

            const [currEnvIndex, nextEnvIndex, lerp] = timeToIndicesLerp(env.timeOfDay, lightCount);
            // const staticMeshLight = env.getBaseColorPlaneStaticMeshSunLight();

            // debugger;

            applyStaticMeshLightEnv(
                env,
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

            // debugger;
        }

        // pos: -1.189912890625e5, 2.3474190625e5, -3.3475771484375e3
        // nor: 3.45625668764114379882812e-1, -1.58267430961132049560547e-2, 9.3823897838592529296875e-1

        // if (this.hasStaticLighting) {
        //     const ambient = env.selectByTime(env.color).getColor();

        //     for (let i = 0; i < vertexArrayLen; i += 3) {
        //         instanceColors[i + 0] += ambient[0];
        //         instanceColors[i + 1] += ambient[1];
        //         instanceColors[i + 2] += ambient[2];
        //     }
        // }

        if (this.isSunAffected) {
            const ambient = env.selectByTime(env.ambientStaticMesh).getColor();

            for (let i = 0; i < vertexArrayLen; i += 3) {
                instanceColors[i + 0] += ambient[0];
                instanceColors[i + 1] += ambient[1];
                instanceColors[i + 2] += ambient[2];
            }
        }
        // else {
        //     console.warn("-------->>", this.objectName)
        // }

        // debugger;

        // if (instance.lights.environment) {
        //     const lightInfo = instance.lights.environment;
        //     const lightArray = lightInfo.vertexFlags;
        //     let lightArrIterator = 0, objectFlag = lightArray[lightArrIterator];

        //     const [r, g, b] = lightInfo.color;

        //     const euler = new Euler().fromArray(lightInfo.rotation);
        //     const direction = new Vector3(0, -1, -1).normalize().applyEuler(euler);

        //     for (let i = 0; i < vertexArrayLen; i += 3) {
        //         if ((objectFlag & someFlag) !== 0) {

        //             position.fromArray(attributes.positions, i).applyMatrix4(matrix);
        //             normal.fromArray(attributes.normals, i).multiply(scale).applyQuaternion(quaternion).normalize();

        //             // debugger;

        //             const intensity = sampleLightIntensity({
        //                 type: lightInfo.lightType,
        //                 effect: lightInfo.lightEffect,
        //                 direction,
        //                 position: lightPosition.fromArray(lightInfo.position),
        //                 radius: (lightInfo.radius + 1) * 25
        //             }, position as any, normal as any);

        //             instanceColors[i + 0] = Math.min(1, instanceColors[i + 0] + r * intensity * lightInfo.lightness);
        //             instanceColors[i + 1] = Math.min(1, instanceColors[i + 1] + g * intensity * lightInfo.lightness);
        //             instanceColors[i + 2] = Math.min(1, instanceColors[i + 2] + b * intensity * lightInfo.lightness);

        //             // debugger;
        //         }

        //         if ((someFlag & 0x7f) === 0x0) {
        //             objectFlag = lightArray[++lightArrIterator];
        //             someFlag = 0x1;
        //         } else someFlag = someFlag << 0x1;
        //     }
        // }

        // // debugger;    

        // instance.lights.scene.forEach((lightInfo: any, index: any) => {
        //     const lightArray = lightInfo.vertexFlags;
        //     const euler = new Euler().fromArray(lightInfo.rotation);
        //     const direction = new Vector3(1, 0, 0).applyEuler(euler);
        //     let lightArrIterator = 0, objectFlag = lightArray[lightArrIterator];

        //     const [r, g, b] = lightInfo.color;

        //     //  debugger;

        //     someFlag = 0x1;

        //     for (let i = 0; i < vertexArrayLen; i += 3) {

        //         if ((objectFlag & someFlag) !== 0) {
        //             position.fromArray(attributes.positions, i).applyMatrix4(matrix);
        //             normal.fromArray(attributes.normals, i).multiply(scale).applyQuaternion(quaternion).normalize();

        //             // debugger;

        //             const intensity = sampleLightIntensity({
        //                 type: lightInfo.lightType,
        //                 effect: lightInfo.lightEffect,
        //                 position: lightPosition.fromArray(lightInfo.position),
        //                 direction,
        //                 radius: (lightInfo.radius + 1) * 25
        //             }, position as any, normal as any);

        //             instanceColors[i + 0] = Math.min(1, instanceColors[i + 0] + clamp(r * intensity * 255, 0, 255) / 255);
        //             instanceColors[i + 1] = Math.min(1, instanceColors[i + 1] + clamp(g * intensity * 255, 0, 255) / 255);
        //             instanceColors[i + 2] = Math.min(1, instanceColors[i + 2] + clamp(b * intensity * 255, 0, 255) / 255);

        //             // debugger;
        //         }

        //         if ((someFlag & 0x7f) === 0x0) {
        //             objectFlag = lightArray[++lightArrIterator];
        //             someFlag = 0x1;
        //         } else someFlag = someFlag << 0x1;
        //     }
        // });

        // const attributes = library.geometries[mesh.geometry].attributes;
        // const colors = new Float32Array(attributes.positions.length);
        // const color = Math.floor(Math.random() * 0x1000000);
        // const r = (color & 0xff0000) >> 16, g = (color & 0x00ff00) >> 8, b = color & 0x0000ff;

        // for (let i = 0; i < attributes.positions.length; i += 3) {
        //     colors[i + 0] = r / 255;
        //     colors[i + 1] = g / 255;
        //     colors[i + 2] = b / 255;
        // }

        const zoneInfo = library.bspZones[library.bspZoneIndexMap[this.getZone().uuid]].zoneInfo;
        const _position = this.location.getVectorElements();
        const actorInfo = {
            uuid: this.uuid,
            type: "StaticMeshActor",
            name: this.objectName,
            position: _position,
            scale: this.scale.getVectorElements().map(v => v * this.drawScale) as [number, number, number],
            rotation: this.rotation?.getEulerElements() || [0, 0, 0, "XYZ"],
            instance: {
                mesh: meshInfo,
                type: "StaticMeshInstance",
                uuid: this.instance ? this.instance.uuid : null,
                name: this.instance ? this.instance.objectName : null,
                attributes: { colors: instanceColors }
            } as GD.IStaticMeshInstanceDecodeInfo
        } as GD.IStaticMeshActorDecodeInfo;

        zoneInfo.children.push(actorInfo);

        library.geometryInstances[meshInfo.geometry]++;

        if (library.geometries[meshInfo.geometry].bounds?.box) {
            const { min, max } = library.geometries[meshInfo.geometry].bounds.box;
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

        // if(this.objectName === "Exp_StaticMeshActor1893") {
        //     debugger;
        // }

        // debugger;

        return this.uuid;
    }

    public doLoad(pkg: GA.UPackage, exp: C.UExport) {
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

function applyStaticMeshLightEnv(env: GA.UL2NEnvLight, vertexArrayLen: number, instanceColors: Float32Array, scaleGlow: number, localToWorld: FMatrix, attributes: { positions: Float32Array, normals: Float32Array }, lightEnvironment: [number, any][]) {
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

        const light = lightActor.getRenderInfo(env);

        const lightArray: C.FPrimitiveArray<"uint8"> = lightInfo.vertexFlags;
        const bitPtrIter = lightArray.iter();

        let bitMask = 0x1;
        let bitPtr = bitPtrIter.next().value;

        // const bytes = lightArray.getTypedArray();

        // debugger;

        const col = env.getBaseColorPlaneStaticMeshSunLight();
        const bri = env.getBrightnessStaticMeshSunLight() * 0.0039215689;

        debugger;

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

                const intensity = scaleGlow * 0.5 * light.sampleIntensity(samplingPoint, samplingNormal) * scaleGlow;

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