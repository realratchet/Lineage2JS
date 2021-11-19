import UObject from "./un-object";
import UPackage from "./un-package";
import UExport from "./un-export";
import BufferValue from "../buffer-value";
import ULevelInfo from "./un-level-info";
import UPointRegion from "./un-point-region";
import UPhysicsVolume from "./un-physics-volume";
import FVector from "./un-vector";
import UAActor from "./un-aactor";
import FArray from "./un-array";
import FUnknownStruct from "./un-unknown-struct";
import FNumber from "./un-number";

class ULight extends UAActor {
    public effect: number;
    public brightness: number;
    public radius: number;
    public hue: number;
    public saturation: number;
    public isDirectional: boolean = false;
    public type: number;
    public hasCorona: boolean;
    public period: number;
    public phase: number;
    public cone: number;
    public isDynamic: number;
    public skins: FArray<number> = new FArray(FNumber.forType(BufferValue.uint8) as any);

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "LightEffect": "effect",
            "LightBrightness": "brightness",
            "LightRadius": "radius",
            "LightHue": "hue",
            "LightSaturation": "saturation",
            "bDirectional": "isDirectional",
            "LightType": "type",
            "bCorona": "hasCorona",
            "Skins": "skins",
            "LightPeriod": "period",
            "LightPhase": "phase",
            "LightCone": "cone",
            "bDynamicLight": "isDynamic"
        });
    }

    public async load(pkg: UPackage, exp: UExport): Promise<this> {
        await super.load(pkg, exp);

        // debugger;

        return this;
    }

    // public async load(pkg: UPackage, exp: UExport): Promise<this> {

    //     this.objectName = `Exp_${exp.objectName}`;

    //     this.setReadPointers(exp);
    //     pkg.seek(this.readHead, "set");

    //     // const unkBuffer = await pkg.read(BufferValue.allocBytes(15)).value as DataView;

    //     // this.readHead = pkg.tell();

    //     debugger;

    //     await this.readNamedProps(pkg);

    //     debugger;

    //     return this;

    //     // await super.load(pkg, exp);

    //     // debugger;

    //     // return this;
    // }
}

export default ULight;
export { ULight };