// import { BufferValue } from "@l2js/core";
// import UHeader from "./un-header";
// import UGeneration from "./un-generation";
// import UExport, { ObjectFlags_T } from "./un-export";
// import UName from "./un-name";
// import UImport from "./un-import";
// import UTexture from "./un-texture";
// import UMeshEmitter from "./emitters/un-mesh-emitter";
// import { UObject } from "@l2js/core";
// import "./un-object-mixin";
// import UClass from "./un-class";
// import UStruct from "./un-struct";
// import UPlatte from "./un-palette";
// import UStaticMesh from "./static-mesh/un-static-mesh";
// import * as UnMaterials from "./un-material";
// import ULevelInfo from "./un-level-info";
// import UTerrainSector from "./un-terrain-sector";
// import UZoneInfo from "./un-zone-info";
// import UPhysicsVolume from "./un-physics-volume";
// import USkyZoneInfo from "./un-sky-zone-info";
// import UModel from "./model/un-model";
// import UPolys from "./un-polys";
// import UBrush from "./un-brush";
// import ULevel from "./un-level";
// import UAmbientSoundObject from "./un-ambient-sound";
// import USound from "./un-sound";
// import ULight from "./un-light";
// import UTerrainInfo from "./un-terrain-info";
// import UNMovableSunLight from "./un-movable-sunlight";
// import UStaticMeshActor from "./static-mesh/un-static-mesh-actor";
// import UWaterVolume from "./un-water-volume";
// import UEmitter from "./un-emitter";
// import UNSun from "./un-nsun";
// import UNMoon from "./un-nmoon";
// import UFogInfo from "./un-fog-info";
// import UPlayerStart from "./un-player-start";
// import UMusicVolume from "./un-music-volume";
// import UMover from "./un-mover";
// import UBlockingVolume from "./un-blocking-volume";
// import UCamera from "./un-camera";
// import UStaticMeshInstance from "./static-mesh/un-static-mesh-instance";
// import ULevelSummary from "./un-level-summary";
// import UDefaultPhysicsVolume from "./un-physics";
// import UTextBuffer from "./un-text-buffer";
// import UCubemap from "./un-cubemap";
// import USkeletalMesh from "./skeletal-mesh/un-skeletal-mesh";
// import UMeshAnimation from "./skeletal-mesh/un-mesh-animation";
// import UFunction from "./un-function";
// import UEnum from "./un-enum";
// import UConst from "./un-const";
// import * as UnProperties from "./un-properties";
// import UState from "./un-state";
// import UField from "./un-field";
// import UFont from "./un-font";
// import UWeapon from "./un-weapon";
// import decodeObject3D from "../decoders/object3d-decoder";
// import UPrimitive from "./un-primitive";
// import UMesh from "./un-mesh";
// import ULodMesh from "./un-lod-mesh";
// import FBSPNode from "./bsp/un-bsp-node";
// import FBSPSurf from "./bsp/un-bsp-surf";
// import FVector from "./un-vector";
// import FVert from "./model/un-vert";
// import UAActor from "./un-aactor";
// import UInfo from "./un-info";
// import UPawn from "./un-pawn";
// import UController from "./un-controller";
// import UViewport from "./un-viewport";
// import UClient from "./un-client";
// import UPlayer from "./un-player";
// import UTerrainPrimitive from "./un-terrain-primitive";
// import UMeshInstance from "./un-mesh-instance";
// import UConvexVolume from "./un-convex-volume";
// import USkeletalMeshInstance from "./un-skeletal-mesh-instance";
// import USpriteEmitter from "./emitters/un-sprite-emitter";
// import UDecoLayer from "./un-deco-layer";
// import FTIntMap from "./un-tint-map";
// import { UPlane } from "./un-plane";
// import { UParticle, UParticleColorScale, UParticleRevolutionScale, UParticleSound, UParticleTimeScale, UParticleVelocityScale } from "./emitters/un-particle-emitter";
// import UMovableStaticMeshActor from "./static-mesh/un-movable-static-mesh-actor";
import { AUNativePackage, AUPackage, UObject } from "@l2js/core";

class UPackage extends AUPackage {
    protected async readArrayBuffer() {
        const response = await fetch(this.path);

        if (!response.ok) throw new Error(response.statusText);

        const buffer = await response.arrayBuffer();

        return buffer;
    }

    public toBuffer(): ArrayBuffer { throw new Error("Method not implemented."); }
}

enum PackageFlags_T {
    NoFlags = 0,
    AllowDownload = 0x0001, // Allow downloading package
    ClientOptional = 0x0002, // Purely optional for clients
    ServerSideOnly = 0x0004, // Only needed on the server side
    BrokenLinks = 0x0008, // Loaded from linker with broken import links
    Unsecure = 0x0010, // Not trusted
    Need = 0x8000 // Client needs to download this package
}

class UNativePackage extends AUNativePackage {

    public getStructConstructor<T extends typeof UObject = typeof UObject>(constructorName: string): new () => T {
        throw new Error("Not implemented yet");
    }

    protected getNonNativeConstructor<T extends typeof UObject = typeof UObject>(constructorName: C.NativeTypes_T): new () => T {
        throw new Error("Not implemented yet");
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
    //         case "Class": Constructor = UClass; break;
    //         case "Struct": Constructor = UStruct; break;
    //         case "Const": Constructor = UConst; break;
    //         case "Enum": Constructor = UEnum; break;
    //         case "Function": Constructor = UFunction; break;

    //         case "FloatProperty": Constructor = UnProperties.UFloatProperty; break;
    //         case "ByteProperty": Constructor = UnProperties.UByteProperty; break;
    //         case "StrProperty": Constructor = UnProperties.UStrProperty; break;
    //         case "IntProperty": Constructor = UnProperties.UIntProperty; break;
    //         case "BoolProperty": Constructor = UnProperties.UBoolProperty; break;
    //         case "NameProperty": Constructor = UnProperties.UNameProperty; break;
    //         case "ClassProperty": Constructor = UnProperties.UClassProperty; break;
    //         case "ArrayProperty": Constructor = UnProperties.UArrayProperty; break;
    //         case "StructProperty": Constructor = UnProperties.UStructProperty; break;
    //         case "ObjectProperty": Constructor = UnProperties.UObjectProperty; break;
    //         case "DelegateProperty": Constructor = UnProperties.UDelegateProperty; break;

    //         case "State": Constructor = UState; break;
    //         case "Font": Constructor = UFont; break;
    //         case "StaticMesh": Constructor = UStaticMesh; break;
    //         case "TerrainSector": Constructor = UTerrainSector; break;
    //         case "Mesh": Constructor = UMesh; break;
    //         case "MeshAnimation": Constructor = UMeshAnimation; break;
    //         case "Level": Constructor = ULevel; break;
    //         case "StaticMeshInstance": Constructor = UStaticMeshInstance; break;
    //         case "StaticMeshActor": Constructor = UStaticMeshActor; break;
    //         case "MovableStaticMeshActor": Constructor = UMovableStaticMeshActor; break;
    //         case "Model": Constructor = UModel; break;
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

    //         case "ZoneInfo": Constructor = UZoneInfo; break;
    //         case "LevelInfo": Constructor = ULevelInfo; break;
    //         case "SkyZoneInfo": Constructor = USkyZoneInfo; break;
    //         case "TerrainInfo": Constructor = UTerrainInfo; break;

    //         case "NSun": Constructor = UNSun; break;
    //         case "NMoon": Constructor = UNMoon; break;
    //         case "NMovableSunLight": Constructor = UNMovableSunLight; break;

    //         case "LevelSummary": Constructor = ULevelSummary; break;
    //         case "PlayerStart": Constructor = UPlayerStart; break;
    //         case "Brush": Constructor = UBrush; break;

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
export { UPackage, PackageFlags_T, UNativePackage };

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

