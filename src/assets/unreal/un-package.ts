import "./un-object-mixin";
import { ANativePackage, APackage, UObject } from "@l2js/core";
import UModel from "./model/un-model";
import ULevel from "./un-level";
import FScale from "./un-scale";
import FVector from "./un-vector";
import UBrush from "./un-brush";
import FColor from "./un-color";
import ULevelInfo from "./un-level-info";
import UZoneInfo from "./un-zone-info";
import UTerrainInfo from "./un-terrain-info";
import USkyZoneInfo from "./un-sky-zone-info";

class UPackage extends APackage {
    protected async readArrayBuffer() {
        const response = await fetch(this.path);

        if (!response.ok) throw new Error(response.statusText);

        const buffer = await response.arrayBuffer();

        return buffer;
    }

    public toBuffer(): ArrayBuffer { throw new Error("Method not implemented."); }
}
class UNativePackage extends ANativePackage {

    public getStructConstructor<T extends typeof UObject = typeof UObject>(constructorName: string): new () => T {
        let Constructor: any;

        switch (constructorName) {
            case "Scale": Constructor = FScale; break;
            case "Vector": Constructor = FVector; break;
            case "Color": Constructor = FColor; break;
            default:
                debugger;
                throw new Error(`Constructor of '${constructorName}' is not yet implemented.`);
        }

        return Constructor;
    }

    protected getNonNativeConstructor<T extends typeof UObject = typeof UObject>(constructorName: C.NativeTypes_T): new () => T {
        let Constructor: any;

        switch (constructorName) {
            case "Level": Constructor = ULevel; break;
            case "Model": Constructor = UModel; break;
            case "Brush": Constructor = UBrush; break;

            case "LevelInfo": Constructor = ULevelInfo; break;
            case "ZoneInfo": Constructor = UZoneInfo; break;
            case "SkyZoneInfo": Constructor = USkyZoneInfo; break;
            case "TerrainInfo": Constructor = UTerrainInfo; break;

            //         case "Font": Constructor = UFont; break;
            //         case "StaticMesh": Constructor = UStaticMesh; break;
            //         case "TerrainSector": Constructor = UTerrainSector; break;
            //         case "Mesh": Constructor = UMesh; break;
            //         case "MeshAnimation": Constructor = UMeshAnimation; break;
            //         case "Level": Constructor = ULevel; break;
            //         case "StaticMeshInstance": Constructor = UStaticMeshInstance; break;
            //         case "StaticMeshActor": Constructor = UStaticMeshActor; break;
            //         case "MovableStaticMeshActor": Constructor = UMovableStaticMeshActor; break;
            //         case "Viewport": Constructor = UViewport; break;
            //         case "Client": Constructor = UClient; break;
            //         case "Player": Constructor = UPlayer; break;
            //         case "TerrainPrimitive": Constructor = UTerrainPrimitive; break;
            //         case "MeshInstance": Constructor = UMeshInstance; break;
            //         case "SkeletalMeshInstance": Constructor = USkeletalMeshInstance; break;

            //         case "Texture": Constructor = UTexture; break;
            //         case "Palette": Constructor = UPlatte; break;

            //         case "Emitter": Constructor = UEmitter; break;
            //         case "MeshEmitter": Constructor = UMeshEmitter; break;
            //         case "SpriteEmitter": Constructor = USpriteEmitter; break;



            //         case "NSun": Constructor = UNSun; break;
            //         case "NMoon": Constructor = UNMoon; break;
            //         case "NMovableSunLight": Constructor = UNMovableSunLight; break;

            //         case "LevelSummary": Constructor = ULevelSummary; break;
            //         case "PlayerStart": Constructor = UPlayerStart; break;

            //         case "TexRotator": Constructor = UnMaterials.UTexRotator; break;
            //         case "TexPanner": Constructor = UnMaterials.UTexPanner; break;
            //         case "TexCoordSource": Constructor = UnMaterials.UTexCoordSource; break;
            //         case "ColorModifier": Constructor = UnMaterials.UColorModifier; break;
            //         case "TexOscillator": Constructor = UnMaterials.UTexOscillator; break;
            //         case "FadeColor": Constructor = UnMaterials.UFadeColor; break;
            //         case "Shader": Constructor = UnMaterials.UShader; break;
            //         case "FinalBlend": Constructor = UnMaterials.UFinalBlend; break;
            //         case "TexEnvMap": Constructor = UnMaterials.UTexEnvMap; break;
            //         case "Cubemap": Constructor = UCubemap; break;

            //         case "Camera": Constructor = UCamera; break;

            //         case "PhysicsVolume": Constructor = UPhysicsVolume; break;
            //         case "BlockingVolume": Constructor = UBlockingVolume; break;
            //         case "MusicVolume": Constructor = UMusicVolume; break;
            //         case "ConvexVolume": Constructor = UConvexVolume; break;

            //         case "AmbientSoundObject": Constructor = UAmbientSoundObject; break;
            //         case "Sound": Constructor = USound; break;

            //         case "Light": Constructor = ULight; break;

            //         case "Mover": Constructor = UMover; break;

            //         // Classes we don't care about atm are marked as UObject for general puprose constructor
            //         case "L2FogInfo": Constructor = UObject; break;
            //         case "L2SeamlessInfo": Constructor = UObject; break;
            //         case "SceneManager": Constructor = UObject; break;
            //         case "PathNode": Constructor = UObject; break;

            default:
                debugger;
                throw new Error(`Constructor of '${constructorName}' is not yet implemented.`);
        }

        return Constructor;
    }

    // public readonly nativeClassess = new Map<C.NativeTypes_T, typeof UObject>();


    // constructor(loader: C.AAssetLoader) {
    //     super(loader, "__native__.u");
    // }

    // protected registerNativeClass(className: NativeTypes_T, baseClass: NativeTypes_T | "None" = "None"): void {
    //     if (!this.nameHash.has(className)) {
    //         const name = new UName();

    //         name.name = className;
    //         name.flags = 0;

    //         this.nameTable.push(name);
    //         this.nameHash.set(className, this.nameTable.length - 1);
    //     }

    //     const exp = new UExport();

    //     exp.index = this.exports.length
    //     exp.idClass = 0;
    //     exp.idSuper = baseClass === "None" ? 0 : this.findObjectRef("Class", baseClass);
    //     exp.idPackage = 0;
    //     exp.idObjectName = this.nameHash.get(className);
    //     exp.objectName = className;
    //     exp.flags = ObjectFlags_T.Native;
    //     exp.size = 0;
    //     exp.offset = 0;

    //     this.exports.push(exp);
    // }

    // public async decode(): Promise<this> {
    //     if (this.buffer) return this;

    //     const tStart = performance.now();

    //     this.imports = [];
    //     this.exports = [];
    //     this.nameTable = [];
    //     this.nameHash = new Map();

    //     this.registerNativeClass("Object");
    //     this.registerNativeClass("Field", "Object");
    //     this.registerNativeClass("Struct", "Field");
    //     this.registerNativeClass("State", "Struct");
    //     this.registerNativeClass("Class", "State");
    //     this.registerNativeClass("Function", "Struct");

    //     this.registerNativeClass("Const", "Field");
    //     this.registerNativeClass("Enum", "Field");

    //     this.registerNativeClass("Property", "Field");
    //     // this.registerNativeClass("PointerProperty", "Property");
    //     this.registerNativeClass("DelegateProperty", "Property");
    //     this.registerNativeClass("ByteProperty", "Property");
    //     this.registerNativeClass("ObjectProperty", "Property");
    //     this.registerNativeClass("ClassProperty", "ObjectProperty");
    //     // this.registerNativeClass("FixedArrayProperty", "Property");
    //     this.registerNativeClass("ArrayProperty", "Property");
    //     // this.registerNativeClass("MapProperty", "Property");
    //     this.registerNativeClass("StructProperty", "Property");
    //     this.registerNativeClass("IntProperty", "Property");
    //     this.registerNativeClass("BoolProperty", "Property");
    //     this.registerNativeClass("FloatProperty", "Property");
    //     this.registerNativeClass("NameProperty", "Property");
    //     this.registerNativeClass("StrProperty", "Property");
    //     // this.registerNativeClass("StringProperty", "Property");

    //     this.registerNativeClass("Texture", "Object");
    //     this.registerNativeClass("Font", "Object");
    //     this.registerNativeClass("Sound", "Object");

    //     this.registerNativeClass("Primitive", "Object");
    //     this.registerNativeClass("Model", "Primitive");
    //     this.registerNativeClass("ConvexVolume", "Primitive");
    //     this.registerNativeClass("StaticMesh", "Primitive");
    //     this.registerNativeClass("Mesh", "Primitive");
    //     this.registerNativeClass("MeshInstance", "Primitive");
    //     this.registerNativeClass("LodMeshInstance", "MeshInstance");
    //     this.registerNativeClass("SkeletalMeshInstance", "LodMeshInstance");

    //     this.registerNativeClass("MeshAnimation", "Object");
    //     this.registerNativeClass("StaticMeshInstance", "Object");

    //     this.registerNativeClass("Player", "Object");
    //     this.registerNativeClass("Viewport", "Player");

    //     this.registerNativeClass("TerrainSector", "Object");
    //     this.registerNativeClass("TerrainPrimitive", "Primitive");

    //     this.registerNativeClass("LevelBase", "Object");
    //     this.registerNativeClass("Level", "LevelBase");

    //     this.registerNativeClass("Client", "Object");

    //     this.buffer = new ArrayBuffer(0);

    //     console.log(`'${this.path}' loaded in ${performance.now() - tStart} ms`);

    //     return this;
    // }

    // public getStructConstructor<T extends typeof UObject = typeof UObject>(constructorName: StructTypes_T): new () => T {
    //     let Constructor: any;

    //     switch (constructorName) {
    //         case "DecorationLayer": Constructor = UDecoLayer; break;
    //         case "TerrainIntensityMap": Constructor = FTIntMap; break;
    //         case "Plane": Constructor = UPlane; break;
    //         case "ParticleRevolutionScale": Constructor = UParticleRevolutionScale; break;
    //         case "ParticleTimeScale": Constructor = UParticleTimeScale; break;
    //         case "ParticleSound": Constructor = UParticleSound; break;
    //         case "ParticleVelocityScale": Constructor = UParticleVelocityScale; break;
    //         case "Particle": Constructor = UParticle; break;
    //         case "ParticleColorScale": Constructor = UParticleColorScale; break;
    //         default:
    //             Constructor = UObject;
    //             console.warn(`Native struct '${constructorName}' bindings defined`);
    //     }

    //     return Constructor;
    // }

    // public getConstructor<T extends typeof UObject = typeof UObject>(constructorName: UObjectTypes_T): new () => T {
    //     let Constructor: any;

    //     // if (constructorName.toLocaleLowerCase().includes("fog"))
    //     //     debugger;

    //     switch (constructorName) {

    //         default:
    //             debugger;
    //             throw new Error(`Not implemented native class: ${constructorName}`);
    //     }

    //     return Constructor;
    // }

    // // protected createObject<T extends UObject = UObject>(className: UObjectTypes_T, ...params: any[]) {
    // //     let Constructor: typeof UObject = null;

    // //     debugger;

    // //     // if (className === "Class" && exp.objectName !== "Object")
    // //     //     debugger;

    // //     switch (className) {
    // //         case "Class": {
    // //             Constructor = UClass;
    // //             // console.info(`Creating class: ${exp.objectName} [${exp.index}]`);
    // //             debugger;
    // //         } break
    // //         case "Struct": Constructor = UStruct; break;
    // //         case "Texture": Constructor = UTexture; break;
    // //         case "Palette": Constructor = UPlatte; break;
    // //         case "StaticMesh": Constructor = UStaticMesh; break;
    // //         case "Shader": Constructor = UShader; break;
    // //         case "LevelInfo": Constructor = ULevelInfo; break;
    // //         case "TerrainSector": Constructor = UTerrainSector; break;
    // //         case "ZoneInfo": Constructor = UZoneInfo; break;
    // //         case "PhysicsVolume": Constructor = UPhysicsVolume; break;
    // //         case "SkyZoneInfo": Constructor = USkyZoneInfo; break;
    // //         case "Model": Constructor = UModel; break;
    // //         case "Polys": Constructor = UPolys; break;
    // //         case "Brush": Constructor = UBrush; break;
    // //         case "Level": Constructor = ULevel; break;
    // //         case "AmbientSoundObject": Constructor = UAmbientSoundObject; break;
    // //         case "Sound": Constructor = USound; break;
    // //         case "Light": Constructor = ULight; break;
    // //         case "TerrainInfo": Constructor = UTerrainInfo; break;
    // //         case "NMovableSunLight": Constructor = UNMovableSunLight; break;
    // //         case "StaticMeshActor": Constructor = UStaticMeshActor; break;
    // //         case "WaterVolume": Constructor = UWaterVolume; break;
    // //         case "Emitter": Constructor = UEmitter; break;
    // //         case "NSun": Constructor = UNSun; break;
    // //         case "NMoon": Constructor = UNMoon; break;
    // //         case "L2FogInfo": Constructor = UFogInfo; break;
    // //         case "PlayerStart": Constructor = UPlayerStart; break;
    // //         case "MusicVolume": Constructor = UMusicVolume; break;
    // //         case "Mover": Constructor = UMover; break;
    // //         case "BlockingVolume": Constructor = UBlockingVolume; break;
    // //         case "Camera": Constructor = UCamera; break;
    // //         case "FadeColor": Constructor = UFadeColor; break;
    // //         case "StaticMeshInstance": Constructor = UStaticMeshInstance; break;
    // //         case "TexRotator": Constructor = UTexRotator; break;
    // //         case "TexPanner": Constructor = UTexPanner; break;
    // //         case "ColorModifier": Constructor = UColorModifier; break;
    // //         case "TexOscillator": Constructor = UTexOscillator; break;
    // //         case "LevelSummary": Constructor = ULevelSummary; break;
    // //         case "DefaultPhysicsVolume": Constructor = UDefaultPhysicsVolume; break;
    // //         case "TextBuffer": Constructor = UTextBuffer; break;
    // //         case "FinalBlend": Constructor = UFinalBlend; break;
    // //         case "TexEnvMap": Constructor = UTexEnvMap; break;
    // //         case "Cubemap": Constructor = UCubemap; break;
    // //         case "SkeletalMesh": Constructor = USkeletalMesh; break;
    // //         case "MeshAnimation": Constructor = UMeshAnimation; break;
    // //         case "Function": Constructor = UFunction; break;
    // //         case "Enum": Constructor = UEnum; break;
    // //         case "Const": Constructor = UConst; break;
    // //         case "ByteProperty": Constructor = UnProperties.UByteProperty; break;
    // //         case "ObjectProperty": Constructor = UnProperties.UObjectProperty; break;
    // //         case "StructProperty": Constructor = UnProperties.UStructProperty; break;
    // //         case "IntProperty": Constructor = UnProperties.UIntProperty; break;
    // //         case "BoolProperty": Constructor = UnProperties.UBoolProperty; break;
    // //         case "NameProperty": Constructor = UnProperties.UNameProperty; break;
    // //         case "FloatProperty": Constructor = UnProperties.UFloatProperty; break;
    // //         case "ArrayProperty": Constructor = UnProperties.UArrayProperty; break;
    // //         case "ClassProperty": Constructor = UnProperties.UClassProperty; break;
    // //         case "StrProperty": Constructor = UnProperties.UStrProperty; break;
    // //         case "State": Constructor = UState; break;
    // //         case "Font": Constructor = UFont; break;
    // //         case "Weapon": Constructor = UWeapon; break;
    // //         default: throw new Error(`Unknown object type: ${className}`);
    // //     }

    // //     const object = (new (Constructor as any)(...params) as T);

    // //     return object;
    // // }

    // public fetchObject<T extends UObject = UObject>(objref: number): T {
    //     if (objref <= 0) return null;

    //     const entry = this.exports[objref - 1];
    //     const Constructor = this.getConstructor(entry.objectName as NativeTypes_T) as any as T;

    //     const object = Constructor as T;
    //     const pkg = this.loader.getPackage("Core", "Script");

    //     if (!pkg.isDecoded()) throw new Error(`Package must be decoded: 'Core'`)

    //     return object;
    // }
}

export default UPackage;
export { UPackage, UNativePackage };

(global.console as any).assert = function (cond: Function, text: string, dontThrow: boolean) {
    if (cond) return;
    if (dontThrow) {
        debugger;
    } else {
        debugger;
        throw new Error(text || "Assertion failed!");
    }
};

// function registerNameTable(nameTable: UName[], nameHash: Map<string, number>, value: string) {
//     if (nameHash.has(value)) return nameHash.get(value);

//     const name = new UName();

//     name.name = value;
//     name.flags = 0;

//     nameTable.push(name);
//     nameHash.set(value, nameTable.length - 1);

//     return name;
// }

// function addPackageDependendency(nameTable: UName[], nameHash: Map<string, number>, imports: UImport[], classPackage: string) {
//     registerNameTable(nameTable, nameHash, "Native");

//     const imp = new UImport();

//     const className = "Package";
//     const idClassName = nameHash.get("Package");
//     const idClassPackage = nameHash.get(classPackage);

//     imp.className = className;
//     imp.classPackage = classPackage;
//     imp.idClassName = idClassName;
//     imp.idClassPackage = idClassPackage;
//     imp.idObjectName = idClassPackage;
//     imp.idPackage = 0
//     imp.index = imports.length;
//     imp.objectName = classPackage;

//     imports.push(imp);
// }
// function addClassDependency(nameTable: UName[], nameHash: Map<string, number>, imports: UImport[], exports: UExport<UObject>[], classPackage: string, objectName: string) {
//     registerNameTable(nameTable, nameHash, objectName);

//     const imp = new UImport();
//     const exp = new UExport();
//     const idObjectName = nameHash.get(objectName);

//     const nativePackage = imports.find(imp => imp.className === "Package" && imp.classPackage === classPackage);
//     const nativeIndex = -(nativePackage.index + 1);

//     imp.className = "Class";
//     imp.classPackage = classPackage;
//     imp.idClassName = nameHash.get("Class");
//     imp.idClassPackage = nameHash.get(classPackage);
//     imp.idObjectName = idObjectName;
//     imp.idPackage = nativeIndex;
//     imp.index = imports.length;
//     imp.objectName = objectName;

//     exp.index = exports.length
//     exp.idClass = -(imp.index + 1);
//     exp.idSuper = 0;
//     exp.idPackage = nativeIndex;
//     exp.idObjectName = idObjectName;
//     exp.objectName = objectName;
//     exp.flags = ObjectFlags_T.Native;
//     exp.size = 0;
//     exp.offset = 0;

//     imports.push(imp);
//     exports.push(exp);

//     return { imp, exp };
// }

