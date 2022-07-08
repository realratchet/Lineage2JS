import UAActor from "../un-aactor";
import { FPrimitiveArray } from "../un-array";
import BufferValue from "../../buffer-value";
import FVector from "../un-vector";
import { generateUUID } from "three/src/math/MathUtils";
import hsvToRgb from "@client/utils/hsv-to-rgb";
import { FPlane } from "../un-plane";
import { FNTimeHSV } from "../un-time-light";
import FCoords from "../un-coords";
import FRotator from "../un-rotator";
import { sampleLightIntensity } from "../un-sample-light";
import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import { selectByTime, staticMeshAmbient, staticMeshLight } from "../un-time-list";

class UStaticMeshActor extends UAActor {
    protected mesh: UStaticMesh;
    protected instance: UStaticMeshInstance;
    protected isRangeIgnored: boolean;
    protected colLocation: FVector;
    protected touching: FPrimitiveArray = new FPrimitiveArray(BufferValue.int16);
    protected isUpdatingShadow: boolean;
    protected stepSound1: USound;
    protected stepSound2: USound;
    protected stepSound3: USound;
    protected isCollidingActors: boolean;
    protected isBlockingActors: boolean;
    protected isBlockingPlayers: boolean;
    protected isBlockingZeroExtentTraces: boolean;
    protected isBlockingNonZeroExtentTraces: boolean;
    protected isBlockingKarma: boolean;
    protected forcedRegion: number;
    protected forcedRegionTag: string;
    protected lodViewDuration: number;
    protected currentLod: number;
    protected isUnlit: boolean;
    protected isShadowCast: boolean;

    protected serverObjectID: number;
    protected serverObjectRealID: number;
    protected serverObjectType: number;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "StaticMesh": "mesh",
            "StaticMeshInstance": "instance",
            "bIgnoredRange": "isRangeIgnored",
            "ColLocation": "colLocation",
            "Touching": "touching",
            "bUpdateShadow": "isUpdatingShadow",
            "StepSound_1": "stepSound1",
            "StepSound_2": "stepSound2",
            "StepSound_3": "stepSound3",
            "bCollideActors": "isCollidingActors",
            "bBlockActors": "isBlockingActors",
            "bBlockPlayers": "isBlockingPlayers",
            "bBlockZeroExtentTraces": "isBlockingZeroExtentTraces",
            "bBlockNonZeroExtentTraces": "isBlockingNonZeroExtentTraces",
            "bBlockKarma": "isBlockingKarma",
            "ForcedRegion": "forcedRegion",
            "ForcedRegionTag": "forcedRegionTag",
            "L2LodViewDuration": "lodViewDuration",
            "L2CurrentLod": "currentLod",
            "bUnlit": "isUnlit",
            "bShadowCast": "isShadowCast",

            "L2ServerObjectType": "serverObjectType",
            "L2ServerObjectID": "serverObjectID",
            "L2ServerObjectRealID": "serverObjectRealID"
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
    //     const someColorPlane_64 = new FPlane(8.213098049163818359375e-1, 8.213098049163818359375e-1, 8.213098049163818359375e-1, 1);

    //     const hsvPlane_4 = someColorPlane_64.multiplyScalar(hsvPlane.lightness * 0.003921569);
    //     const hsvPlane_5 = hsvPlane_4.multiplyScalar(someColor_88);
    //     const hsvPlane_8 = hsvPlane_5.multiplyScalar(ambientBrightness);

    //     const coord = FCoords.fromRotator(new FRotator(
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

    public async getDecodeInfo(library: IDecodeLibrary): Promise<IBaseObjectDecodeInfo> {
        await this.onLoaded();

        if (this.instance) this.instance.setActor(this);

        // if (this.colLocation.sub(this.location).length() > 1e-3)
        //     debugger;

        const lights: ILightDecodeInfo[] = []
            // const lights: ILightDecodeInfo[] = (await this.instance.getDecodeInfo(library))
            .filter((l: ILightDecodeInfo) => l.lightType === 7)
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

        //     if (!(modifierUuid in library.materialModifiers))    {
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

        const mesh = await this.mesh.getDecodeInfo(library, hasModifier ? [modifierUuid] : null);
        const attributes = library.geometries[mesh.geometry].attributes;
        const instance = (this.instance ? await this.instance.getDecodeInfo(library) : {
            color: new Float32Array(attributes.positions.length).fill(0),
            lights: { scene: [], ambient: [] }
        });


        const vertexArrayLen = attributes.positions.length;
        const instanceColors = instance.color;
        // const position = new FVector(), normal = new FVector(), color = new FPlane();
        const position = new Vector3(), normal = new Vector3(), color = new FPlane();

        const currentPosition = new Vector3().fromArray(this.location.getVectorElements());

        const scale = new Vector3().fromArray(this.scale.getVectorElements());
        const euler = new Euler().fromArray(this.rotation.getEulerElements());
        const quaternion = new Quaternion().setFromEuler(euler);

        const matrix = new Matrix4().compose(currentPosition, quaternion, scale);

        // debugger;

        // const invLightPosition = currentPosition.sub(lightPosition);

        let someFlag = 1;

        const lightPosition = new Vector3();
        const timeOfDay = 0;


        if (this.isSunAffected) {
            const ambient = selectByTime(timeOfDay, staticMeshAmbient);

            for (let i = 0; i < vertexArrayLen; i += 3) {
                instanceColors[i + 0] += ambient.r / 255;
                instanceColors[i + 1] += ambient.g / 255;
                instanceColors[i + 2] += ambient.b / 255;
            }
        }

        const trackingLight = new Array(vertexArrayLen / 3).fill(0);

        if (instance.lights.environment) {
            const lightInfo = instance.lights.environment
            const lightArray = lightInfo.vertexFlags;
            let lightArrIterator = 0, objectFlag = lightArray[lightArrIterator];

            const [r, g, b] = lightInfo.color;

            const euler = new Euler().fromArray(lightInfo.rotation);
            const direction = new Vector3(0, -1, -1).normalize().applyEuler(euler);

            for (let i = 0; i < vertexArrayLen; i += 3) {
                if ((objectFlag & someFlag) !== 0) {

                    position.fromArray(attributes.positions, i).applyMatrix4(matrix);
                    normal.fromArray(attributes.normals, i).applyMatrix4(matrix).normalize();

                    const intensity = sampleLightIntensity({
                        type: lightInfo.lightType,
                        direction,
                        position: lightPosition.fromArray(lightInfo.position),
                        radius: (lightInfo.radius + 1) * 25
                    }, position, normal);

                    instanceColors[i + 0] += r * intensity * lightInfo.lightness;
                    instanceColors[i + 1] += g * intensity * lightInfo.lightness;
                    instanceColors[i + 2] += b * intensity * lightInfo.lightness;
                    trackingLight[i / 3]++;
                }

                someFlag = someFlag << 0x1;

                if ((someFlag & 0x7f) === 0x0) {
                    lightArrIterator = lightArray[++lightArrIterator];
                    someFlag = 0x1;
                }
            }
        }


        instance.lights.scene.forEach(lightInfo => {
            const lightArray = lightInfo.vertexFlags;
            let lightArrIterator = 0, objectFlag = lightArray[lightArrIterator];

            const [r, g, b] = lightInfo.color;

            for (let i = 0; i < vertexArrayLen; i += 3) {
                if ((objectFlag & someFlag) !== 0) {
                    position.fromArray(attributes.positions, i).applyMatrix4(matrix);
                    normal.fromArray(attributes.normals, i).applyMatrix4(matrix).normalize();

                    // debugger;

                    const intensity = sampleLightIntensity({
                        type: lightInfo.lightType,
                        position: lightPosition.fromArray(lightInfo.position),
                        radius: (lightInfo.radius + 1) * 25
                    }, position, normal);


                    instanceColors[i + 0] += r * intensity;
                    instanceColors[i + 1] += g * intensity;
                    instanceColors[i + 2] += b * intensity;
                    trackingLight[i / 3]++;

                    // debugger;
                }

                someFlag = someFlag << 0x1;

                if ((someFlag & 0x7f) === 0x0) {
                    lightArrIterator = lightArray[++lightArrIterator];
                    someFlag = 0x1;
                }
            }
        });

        for (let i = 0; i < vertexArrayLen; i += 3) {
            const d = trackingLight[i / 3];

            if (d > 0) {
                instanceColors[i + 0] /= d;
                instanceColors[i + 1] /= d;
                instanceColors[i + 2] /= d;
            }
        }

        // const attributes = library.geometries[mesh.geometry].attributes;
        // const colors = new Float32Array(attributes.positions.length);
        // const color = Math.floor(Math.random() * 0x1000000);
        // const r = (color & 0xff0000) >> 16, g = (color & 0x00ff00) >> 8, b = color & 0x0000ff;

        // for (let i = 0; i < attributes.positions.length; i += 3) {
        //     colors[i + 0] = r / 255;
        //     colors[i + 1] = g / 255;
        //     colors[i + 2] = b / 255;
        // }

        const info = {
            type: "StaticMeshActor",
            name: this.objectName,
            position: this.colLocation.getVectorElements(),
            scale: this.scale.getVectorElements(),
            rotation: this.rotation.getEulerElements(),
            children: [
                { mesh, type: "StaticMeshInstance", attributes: { colors: instanceColors } } as IStaticMeshInstanceDecodeInfo
                // mesh,
                /*, this.getRegionLineHelper(library)*/
            ],
            siblings,
        } as IBaseObjectDecodeInfo;

        library.geometryInstances[mesh.geometry]++;

        // if(this.mesh.objectName === "Exp_StoneH_06") {
        //     debugger;
        // }

        // debugger;

        return info;
    }

    public doLoad(pkg: UPackage, exp: UExport) {
        super.doLoad(pkg, exp);

        this.readHead = pkg.tell();


        // if (this.objectName === 'Exp_StaticMeshActor449')
        //     debugger;

        return this;
    }
}

export default UStaticMeshActor;
export { UStaticMeshActor };