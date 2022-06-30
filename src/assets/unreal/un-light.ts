import hsvToColorPlane from "@client/utils/hsv-to-color-plane";
import { generateUUID } from "three/src/math/MathUtils";
import BufferValue from "../buffer-value";
import UAActor from "./un-aactor";
import { FPrimitiveArray } from "./un-array";
import FVector from "./un-vector";

class ULight extends UAActor {
    public effect: LightEffect_T;
    public lightness: number = 255;
    public radius: number;
    public hue: number = 0;
    public saturation: number = 127;
    public isDirectional: boolean = false;
    public type: LightType_T = 1;
    public hasCorona: boolean = false;
    public period: number = 0;
    public phase: number = 0;
    public cone: number = 0;
    public isDynamic: boolean = false;
    public lightOnTime: number;
    public lightOffTime: number;
    public skins: FPrimitiveArray<"uint8"> = new FPrimitiveArray(BufferValue.uint8);

    protected isIgnoredRange: boolean;

    protected getSignedMap() {
        return Object.assign({}, super.getSignedMap(), {
            "LightHue": false,
            "LightSaturation": false
        });
    }

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "LightEffect": "effect",
            "LightRadius": "radius",
            "LightBrightness": "lightness",
            "LightHue": "hue",
            "LightSaturation": "saturation",
            "bDirectional": "isDirectional",
            "LightType": "type",
            "bCorona": "hasCorona",
            "Skins": "skins",
            "LightPeriod": "period",
            "LightPhase": "phase",
            "LightCone": "cone",
            "bDynamicLight": "isDynamic",
            "bIgnoredRange": "isIgnoredRange",
            "LightOnTime": "lightOnTime",
            "LightOffTime": "lightOffTime",
        });
    }

    protected getRegionLineHelper(library: IDecodeLibrary, color: [number, number, number] = [1, 0, 1], ignoreDepth: boolean = false) {
        const lineGeometryUuid = generateUUID();
        const _a = this.region.getZone().location;
        const _b = this.location;

        const a = new FVector(_a.x, _a.z, _a.y);
        const b = new FVector(_b.x, _b.z, _b.y);

        const geoPosition = a.sub(b);
        const regionHelper = {
            type: "Edges",
            geometry: lineGeometryUuid,
            color,
            ignoreDepth
        } as IEdgesObjectDecodeInfo;

        library.geometries[lineGeometryUuid] = {
            indices: new Uint8Array([0, 1]),
            attributes: {
                positions: new Float32Array([
                    0, 0, 0,
                    geoPosition.x, geoPosition.y, geoPosition.z
                ])
            }
        };

        return regionHelper;
    }

    public async getDecodeInfo(library: IDecodeLibrary): Promise<ILightDecodeInfo> {
        await this.onLoaded();

        return {
            type: "Light",
            color: hsvToColorPlane(this.hue, this.saturation, this.lightness),
            cone: this.cone,
            lightType: this.type,
            lightEffect: this.effect,
            directional: this.isDirectional,
            radius: this.radius,
            name: this.objectName,
            position: this.location.getVectorElements(),
            scale: this.scale.getVectorElements(),
            rotation: this.rotation.getEulerElements(),
            children: [this.getRegionLineHelper(library, [1, 0, 0])]
        };
    }
}

export default ULight;
export { ULight };