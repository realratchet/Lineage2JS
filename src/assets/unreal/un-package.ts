import BufferValue from "../buffer-value";
import UHeader from "./un-header";
import UGeneration from "./un-generation";
import UExport, { ObjectFlags_T } from "./un-export";
import UName from "./un-name";
import UImport from "./un-import";
import UTexture from "./un-texture";
import UMeshEmitter from "./emitters/un-mesh-emitter";
import UObject from "./un-object";
import "./un-object-mixin";
import UClass from "./un-class";
import UStruct from "./un-struct";
import UPlatte from "./un-palette";
import UStaticMesh from "./static-mesh/un-static-mesh";
import * as UnMaterials from "./un-material";
import ULevelInfo from "./un-level-info";
import UTerrainSector from "./un-terrain-sector";
import UZoneInfo from "./un-zone-info";
import UPhysicsVolume from "./un-physics-volume";
import USkyZoneInfo from "./un-sky-zone-info";
import UModel from "./model/un-model";
import UPolys from "./un-polys";
import UBrush from "./un-brush";
import ULevel from "./un-level";
import UAmbientSoundObject from "./un-ambient-sound";
import USound from "./un-sound";
import ULight from "./un-light";
import UTerrainInfo from "./un-terrain-info";
import UNMovableSunLight from "./un-movable-sunlight";
import UStaticMeshActor from "./static-mesh/un-static-mesh-actor";
import UWaterVolume from "./un-water-volume";
import UEmitter from "./un-emitter";
import UNSun from "./un-nsun";
import UNMoon from "./un-nmoon";
import UFogInfo from "./un-fog-info";
import UPlayerStart from "./un-player-start";
import UMusicVolume from "./un-music-volume";
import UMover from "./un-mover";
import UBlockingVolume from "./un-blocking-volume";
import UCamera from "./un-camera";
import UStaticMeshInstance from "./static-mesh/un-static-mesh-instance";
import ULevelSummary from "./un-level-summary";
import UDefaultPhysicsVolume from "./un-physics";
import UEncodedFile from "./un-encoded-file";
import UTextBuffer from "./un-text-buffer";
import UCubemap from "./un-cubemap";
import USkeletalMesh from "./skeletal-mesh/un-skeletal-mesh";
import UMeshAnimation from "./skeletal-mesh/un-mesh-animation";
import UFunction from "./un-function";
import UEnum from "./un-enum";
import UConst from "./un-const";
import * as UnProperties from "./un-properties";
import UState from "./un-state";
import UField from "./un-field";
import UFont from "./un-font";
import UWeapon from "./un-weapon";
import decodeObject3D from "../decoders/object3d-decoder";
import UPrimitive from "./un-primitive";
import UMesh from "./un-mesh";
import ULodMesh from "./un-lod-mesh";
import FBSPNode from "./bsp/un-bsp-node";
import FBSPSurf from "./bsp/un-bsp-surf";
import FVector from "./un-vector";
import FVert from "./model/un-vert";
import UAActor from "./un-aactor";
import UInfo from "./un-info";
import UPawn from "./un-pawn";
import UController from "./un-controller";
import UViewport from "./un-viewport";
import UClient from "./un-client";
import UPlayer from "./un-player";
import UTerrainPrimitive from "./un-terrain-primitive";
import UMeshInstance from "./un-mesh-instance";
import UConvexVolume from "./un-convex-volume";
import USkeletalMeshInstance from "./un-skeletal-mesh-instance";
import USpriteEmitter from "./emitters/un-sprite-emitter";
import UDecoLayer from "./un-deco-layer";
import FTIntMap from "./un-tint-map";
import { UPlane } from "./un-plane";
import { UParticle, UParticleColorScale, UParticleRevolutionScale, UParticleSound, UParticleTimeScale, UParticleVelocityScale } from "./emitters/un-particle-emitter";
import UMovableStaticMeshActor from "./static-mesh/un-movable-static-mesh-actor";

class UPackage extends UEncodedFile {
    public readonly loader: AssetLoader;

    public exports: UExport[];
    public imports: UImport[];
    public nameTable: UName[];
    public header: UHeader;
    public exportGroups: Record<string, { index: number; export: UExport; }[]>;
    public importGroups: Record<string, { import: UImport; index: number; }[]>;
    public readonly isCore: boolean;
    public readonly isEngine: boolean;
    public readonly isNative: boolean;
    public nameHash = new Map<string, number>();

    constructor(loader: AssetLoader, path: string) {
        super(path);
        this.loader = loader;

        this.isCore = this.path.toLocaleLowerCase().endsWith("core.u");
        this.isEngine = this.path.toLocaleLowerCase().endsWith("engine.u");
    }

    public isDecoded() { return !!this.buffer; }

    public async decode(): Promise<this> {
        if (this.buffer) return this;
        if (this.promiseDecoding) {
            await this.promiseDecoding;
            return this;
        }

        const readable = this.asReadable();
        const signature = await readable._doDecode();

        if (signature.value !== 0x9E2A83C1)
            throw new Error(`Invalid signature: '0x${signature.toString(16).toUpperCase()}' expected '0x9E2A83C1'`);

        const header = new UHeader();
        const uint32 = new BufferValue(BufferValue.uint32);
        const int32 = new BufferValue(BufferValue.uint32);

        header.version = readable.read(uint32).value as number;
        header.packageFlags = readable.read(int32).value as number;
        header.nameCount = readable.read(int32).value as number;
        header.nameOffset = readable.read(int32).value as number;
        header.exportCount = readable.read(int32).value as number;
        header.exportOffset = readable.read(int32).value as number;
        header.importCount = readable.read(int32).value as number;
        header.importOffset = readable.read(int32).value as number;

        const dbgNameCount = header.nameCount;
        const dbgNameOffset = header.nameOffset.toString(16).toUpperCase();
        const dbgExportCount = header.exportCount;
        const dbgExportOffset = header.exportOffset.toString(16).toUpperCase();
        const dbgImportCount = header.importCount;
        const dbgImportOffset = header.importOffset.toString(16).toUpperCase();

        console.log(`'${readable.path}' => Names:${dbgNameOffset}[${dbgNameCount}] Exports:${dbgExportOffset}[${dbgExportCount}] Imports:${dbgImportOffset}[${dbgImportCount}]`);

        if (readable.path === "assets/maps/20_21.unr") {
            console.assert(header.getArchiveFileVersion() === 123);
            console.assert(header.packageFlags === 0x1);
            console.assert(header.nameCount === 12165);
            console.assert(header.nameOffset === 0x40);
            console.assert(header.exportCount === 11379);
            console.assert(header.exportOffset === 0xFB1BF5);
            console.assert(header.importCount === 490);
            console.assert(header.importOffset === 0xFB0712);
        }

        if (header.getArchiveFileVersion() < 68) {
            header.heritageCount = readable.read(uint32).value as number;
            header.heritageOffset = readable.read(uint32).value as number;
        } else {
            readable.read(header.guid);

            const generationCount = readable.read(new BufferValue(BufferValue.int32)).value as number;

            if (readable.path === "assets/maps/20_21.unr") {
                console.assert(generationCount === 1);
            }

            for (let i = 0, gc = generationCount as number; i < gc; i++) {
                const gen = new UGeneration();

                gen.exportCount = readable.read(uint32).value as number;
                gen.nameCount = readable.read(uint32).value as number;

                header.generations.push(gen);
            }
        }

        const [nameTable, nameHash] = readable.loadNames(header);

        const exports = readable.loadExports(header, nameTable);
        const imports = readable.loadImports(header, nameTable);

        readable.exports = exports;
        readable.imports = imports;
        readable.nameTable = nameTable;
        readable.nameHash = nameHash;
        readable.header = header;

        if (this.isCore) {
            const nativeIndex = -(imports.length + 1);
            for (const imp of imports) {
                if (imp.className === "Package")
                    continue;

                if (imp.classPackage !== "Core")
                    continue;

                imp.classPackage = "Native";
                imp.idPackage = nativeIndex;

                {
                    const className = imp.objectName;

                    registerNameTable(nameTable, nameHash, className);

                    {
                        const exp = new UExport();

                        exp.index = exports.length
                        exp.idClass = -(imp.index + 1);
                        exp.idSuper = 0;
                        exp.idPackage = nativeIndex;
                        exp.idObjectName = nameHash.get(className);
                        exp.objectName = className;
                        exp.flags = ObjectFlags_T.Native;
                        exp.size = 0;
                        exp.offset = 0;

                        exports.push(exp);
                    }
                }
            }


            addPackageDependendency(nameTable, nameHash, imports, "Native")
            addClassDependency(nameTable, nameHash, imports, exports, "Native", "State");
            addClassDependency(nameTable, nameHash, imports, exports, "Native", "DelegateProperty");

        } else if (this.isEngine) {
            addPackageDependendency(nameTable, nameHash, imports, "Native")
            addClassDependency(nameTable, nameHash, imports, exports, "Native", "Font");
            addClassDependency(nameTable, nameHash, imports, exports, "Native", "Sound");

            addClassDependency(nameTable, nameHash, imports, exports, "Native", "Primitive");
            addClassDependency(nameTable, nameHash, imports, exports, "Native", "ConvexVolume");
            addClassDependency(nameTable, nameHash, imports, exports, "Native", "Model");
            addClassDependency(nameTable, nameHash, imports, exports, "Native", "Mesh");
            addClassDependency(nameTable, nameHash, imports, exports, "Native", "StaticMesh");
            addClassDependency(nameTable, nameHash, imports, exports, "Native", "MeshInstance");
            addClassDependency(nameTable, nameHash, imports, exports, "Native", "LodMeshInstance");
            addClassDependency(nameTable, nameHash, imports, exports, "Native", "SkeletalMeshInstance");

            addClassDependency(nameTable, nameHash, imports, exports, "Native", "MeshAnimation");
            addClassDependency(nameTable, nameHash, imports, exports, "Native", "StaticMeshInstance");

            addClassDependency(nameTable, nameHash, imports, exports, "Native", "Viewport");
            addClassDependency(nameTable, nameHash, imports, exports, "Native", "Player");

            addClassDependency(nameTable, nameHash, imports, exports, "Native", "TerrainSector");
            addClassDependency(nameTable, nameHash, imports, exports, "Native", "TerrainPrimitive");

            addClassDependency(nameTable, nameHash, imports, exports, "Native", "LevelBase");
            addClassDependency(nameTable, nameHash, imports, exports, "Native", "Level");

            addClassDependency(nameTable, nameHash, imports, exports, "Native", "Client");
        }

        readable.importGroups = readable.imports.reduce((accum, imp, index) => {
            const impType = imp.className;
            const list = accum[impType] = accum[impType] || [];

            list.push({ import: imp, index: -index - 1 });

            return accum;
        }, {} as Record<string, { import: UImport, index: number }[]>);

        readable.exportGroups = readable.exports.reduce((accum, exp, index) => {

            const expType = readable.getPackageName(exp.idClass as number) || "Class";
            const list = accum[expType] = accum[expType] || [];

            list.push({ index, export: exp });

            return accum;
        }, {} as Record<string, { index: number, export: UExport }[]>)

        Object.assign(this, readable, { isReadable: false });

        return this;
    }

    protected findObjectRef(className: string, objectName: string, groupName: string = "None"): number {
        const isClass = className == "Class";

        for (const exp of this.exports) {
            if (exp.objectName !== objectName) continue;
            if (groupName !== "None") {
                if (exp.idPackage > 0) {
                    const pkg = this.exports[exp.idPackage - 1];

                    if (pkg && groupName !== pkg.objectName) {
                        continue;
                    }

                } else if (exp.idPackage < 0) {
                    debugger;
                } else {
                    debugger;
                }
            }

            if (isClass) {
                if (exp.idClass > 0) {
                    const other = this.exports[exp.idClass as number + 1];

                    if (other && className === other.objectName)
                        return exp.index + 1;

                    debugger;
                } else if (exp.idClass < 0) {
                    const clsImport = this.imports[-exp.idClass - 1];

                    if (clsImport && objectName === clsImport.objectName) {
                        if (clsImport.classPackage === "Native")
                            return -(clsImport.index + 1);

                        return exp.index + 1;
                    }
                } else if (exp.idClass === 0) return exp.index + 1;

            } else if (exp.idClass !== 0) {

                const obj = this.fetchObject(exp.idClass) as any as typeof UObject;

                if (obj) {
                    const inheritenceChain = obj instanceof UClass ? [obj.loadSelf().friendlyName] : obj.inheritenceChain;

                    if (!inheritenceChain)
                        debugger;

                    if (inheritenceChain.includes(className))
                        return exp.index + 1;
                }
            }
        }

        return 0;
    }

    public newObject<T extends UObject = UObject>(objclass: UClass | ObjectConstructor): T {
        if (objclass instanceof UClass) {
            const Constructor = objclass.buildClass<T>(this.loader.getPackage("native", "Script") as UNativePackage);

            return new Constructor();
        }

        const obj = new (objclass as ObjectConstructor)();

        return obj as T;
    }

    public loadExportObject(index: number) {
        const entry = this.exports[index];
        const objname = entry.objectName;

        if (entry.idClass !== 0) {
            const objclass: UClass = this.fetchObject(entry.idClass) as UClass;

            if (!objclass) {
                debugger;
                throw Error("Could not find the object class for " + objname);
            }

            const object = entry.object = this.newObject(objclass) as UObject;

            object.setExport(this, entry);

        } else {
            let objbase = entry.idSuper === 0 ? null : this.fetchObject(entry.idSuper) as UClass;
            let pkg: UPackage = this;

            if (!objbase && objname !== "Object") {
                debugger;
                pkg = this.loader.getPackage("Core", "Script");

                if (!pkg.isDecoded()) throw new Error(`Package must be decoded: 'Core'`);

                objbase = pkg.fetchObjectByType("Class", "Object") as UClass;
            }

            if (!this.exports[index].object) {
                const obj = new UClass();

                this.exports[index].object = obj as unknown as UObject;

                if (entry.size === 0) {
                    if (entry.flags !== ObjectFlags_T.Native)
                        throw new Error("0xdeadbeef")

                    obj.friendlyName = objname;
                }

                obj.setExport(pkg, entry);
            }
        }
    }

    getImportEntry(objref: number) {
        if (objref === 0)
            return null;
        else if (objref > 0)
            throw Error("Expected an import table entry");

        const index = -objref - 1;
        if (index >= this.imports.length)
            throw Error("Import table entry out of bounds!");

        return this.imports[index];
    }

    public fetchObject<T extends UObject = UObject>(objref: number): T {
        if (objref > 0) {   // Export table object
            const index = objref - 1;

            if (index > this.exports.length)
                throw new Error("Invalid object reference");

            const entry = this.exports[index];

            if (!entry.object)
                this.loadExportObject(index);

            return entry.object as T;
        } else if (objref < 0) {    // Import table object

            const entry = this.getImportEntry(objref);
            let entrypackage = this.getImportEntry(entry.idPackage);

            let groupName = "None";
            if (entrypackage.idPackage !== 0)
                groupName = entrypackage.objectName;

            while (entrypackage.idPackage !== 0)
                entrypackage = this.getImportEntry(entrypackage.idPackage);

            const packageName = entrypackage.objectName;
            const objectName = entry.objectName;
            const className = entry.className;

            const pkg = this.loader.getPackage(packageName, className as SupportedImports_T);

            if (!pkg.isDecoded()) throw new Error(`Package must be decoded: '${packageName}'`);

            if (pkg.isNative && className === "State" && objectName === "State" && groupName === "None") {
                console.log(entry);
                debugger;
            }

            let obj = pkg.fetchObjectByType(className, objectName, groupName);

            if (obj === null) {
                console.log(pkg);
                debugger;
                throw new Error(`(${packageName}) [${className}, ${objectName}, ${groupName}] should not be null`);
            }

            // What a garbage engine!
            if (!obj && packageName == "UnrealI")
                debugger;
            // obj = Packages->GetPackage("UnrealShare")->GetUObject(className, objectName, groupName);
            else if (!obj && packageName == "UnrealShare")
                debugger
            // obj = Packages->GetPackage("UnrealI")->GetUObject(className, objectName, groupName);

            return obj as T;
        }

        return null;
    }

    public fetchObjectByType(className: string, objectName: string, groupName: string = "None") {
        const index = this.findObjectRef(className, objectName, groupName);

        return this.fetchObject(index);
    }

    public getPackageName(index: number) {
        return index < 0
            ? this.imports[-index - 1].objectName as string
            : index > 0
                ? this.exports[index].objectName as string
                : null;
    }

    protected loadImports(header: UHeader, nameTable: UName[]) {
        this.seek(header.importOffset as number, "set");

        const imports: UImport[] = [];
        const index = new BufferValue(BufferValue.compat32);
        const int32 = new BufferValue(BufferValue.int32);

        for (let i = 0, ic = header.importCount; i < ic; i++) {
            const uimport = new UImport();

            uimport.index = i;

            this.read(index);
            uimport.idClassPackage = index.value as number;
            uimport.classPackage = nameTable[uimport.idClassPackage].name;

            this.read(index);
            uimport.idClassName = index.value as number;
            uimport.className = nameTable[uimport.idClassName].name;

            uimport.idPackage = this.read(int32).value as number;

            this.read(index);
            uimport.idObjectName = index.value as number;
            uimport.objectName = nameTable[uimport.idObjectName].name;

            imports.push(uimport);
        }

        return imports;
    }

    protected loadNames(header: UHeader): [UName[], Map<string, number>] {
        this.seek(header.nameOffset as number, "set");

        const nameTable: UName[] = [];
        const nameHash = new Map<string, number>();

        const char = new BufferValue<"char">(BufferValue.char);
        const uint32 = new BufferValue<"uint32">(BufferValue.uint32);

        for (let i = 0, nc = header.nameCount as number; i < nc; i++) {
            const uname = new UName();

            uname.name = this.read(char).string;
            uname.flags = this.read(uint32).value as number;

            nameTable.push(uname);
            nameHash.set(uname.name, i);

            // console.log(`Name[${i}]: "${(uname.name)}"`);
        }

        return [nameTable, nameHash];
    }

    protected loadExports(header: UHeader, nameTable: UName[]) {
        this.seek(header.exportOffset as number, "set");

        const exports: UExport[] = [];
        const compat32 = new BufferValue(BufferValue.compat32);
        const uint32 = new BufferValue(BufferValue.uint32);

        for (let i = 0, ec = header.exportCount as number; i < ec; i++) {
            const uexport = new UExport();

            uexport.idClass = this.read(compat32).value as number;
            uexport.idSuper = this.read(compat32).value as number;
            uexport.idPackage = this.read(uint32).value as number;
            uexport.idObjectName = this.read(compat32).value as number;

            uexport.index = i;
            uexport.objectName = nameTable[uexport.idObjectName as number].name;

            uexport.flags = this.read(uint32).value as number;
            uexport.size = this.read(compat32).value as number;

            if (uexport.size as number > 0)
                uexport.offset = this.read(compat32).value as number;

            exports.push(uexport);
        }

        return exports;
    }

    public toString() { return `Package=(${this.path}, imports=${this.imports.length}, exports=${this.exports.length})` }
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

class UNativePackage extends UPackage {
    public readonly isCore = false;
    public readonly isEngine = false;
    public readonly isNative = true;

    public readonly nativeClassess = new Map<NativeTypes_T, typeof UObject>();


    constructor(loader: AssetLoader) {
        super(loader, "__native__.u");
    }

    protected registerNativeClass(className: NativeTypes_T, baseClass: NativeTypes_T | "None" = "None"): void {
        if (!this.nameHash.has(className)) {
            const name = new UName();

            name.name = className;
            name.flags = 0;

            this.nameTable.push(name);
            this.nameHash.set(className, this.nameTable.length - 1);
        }

        const exp = new UExport();

        exp.index = this.exports.length
        exp.idClass = 0;
        exp.idSuper = baseClass === "None" ? 0 : this.findObjectRef("Class", baseClass);
        exp.idPackage = 0;
        exp.idObjectName = this.nameHash.get(className);
        exp.objectName = className;
        exp.flags = ObjectFlags_T.Native;
        exp.size = 0;
        exp.offset = 0;

        this.exports.push(exp);
    }

    public async decode(): Promise<this> {
        if (this.buffer) return this;

        const tStart = performance.now();

        this.imports = [];
        this.exports = [];
        this.nameTable = [];
        this.nameHash = new Map();

        this.registerNativeClass("Object");
        this.registerNativeClass("Field", "Object");
        this.registerNativeClass("Struct", "Field");
        this.registerNativeClass("State", "Struct");
        this.registerNativeClass("Class", "State");
        this.registerNativeClass("Function", "Struct");

        this.registerNativeClass("Const", "Field");
        this.registerNativeClass("Enum", "Field");

        this.registerNativeClass("Property", "Field");
        // this.registerNativeClass("PointerProperty", "Property");
        this.registerNativeClass("DelegateProperty", "Property");
        this.registerNativeClass("ByteProperty", "Property");
        this.registerNativeClass("ObjectProperty", "Property");
        this.registerNativeClass("ClassProperty", "ObjectProperty");
        // this.registerNativeClass("FixedArrayProperty", "Property");
        this.registerNativeClass("ArrayProperty", "Property");
        // this.registerNativeClass("MapProperty", "Property");
        this.registerNativeClass("StructProperty", "Property");
        this.registerNativeClass("IntProperty", "Property");
        this.registerNativeClass("BoolProperty", "Property");
        this.registerNativeClass("FloatProperty", "Property");
        this.registerNativeClass("NameProperty", "Property");
        this.registerNativeClass("StrProperty", "Property");
        // this.registerNativeClass("StringProperty", "Property");

        this.registerNativeClass("Texture", "Object");
        this.registerNativeClass("Font", "Object");
        this.registerNativeClass("Sound", "Object");

        this.registerNativeClass("Primitive", "Object");
        this.registerNativeClass("Model", "Primitive");
        this.registerNativeClass("ConvexVolume", "Primitive");
        this.registerNativeClass("StaticMesh", "Primitive");
        this.registerNativeClass("Mesh", "Primitive");
        this.registerNativeClass("MeshInstance", "Primitive");
        this.registerNativeClass("LodMeshInstance", "MeshInstance");
        this.registerNativeClass("SkeletalMeshInstance", "LodMeshInstance");

        this.registerNativeClass("MeshAnimation", "Object");
        this.registerNativeClass("StaticMeshInstance", "Object");

        this.registerNativeClass("Player", "Object");
        this.registerNativeClass("Viewport", "Player");

        this.registerNativeClass("TerrainSector", "Object");
        this.registerNativeClass("TerrainPrimitive", "Primitive");

        this.registerNativeClass("LevelBase", "Object");
        this.registerNativeClass("Level", "LevelBase");

        this.registerNativeClass("Client", "Object");

        this.buffer = new ArrayBuffer(0);

        console.log(`'${this.path}' loaded in ${performance.now() - tStart} ms`);

        return this;
    }

    public getStructConstructor<T extends typeof UObject = typeof UObject>(constructorName: StructTypes_T): new () => T {
        let Constructor: any;

        switch (constructorName) {
            case "DecorationLayer": Constructor = UDecoLayer; break;
            case "TerrainIntensityMap": Constructor = FTIntMap; break;
            case "Plane": Constructor = UPlane; break;
            case "ParticleRevolutionScale": Constructor = UParticleRevolutionScale; break;
            case "ParticleTimeScale": Constructor = UParticleTimeScale; break;
            case "ParticleSound": Constructor = UParticleSound; break;
            case "ParticleVelocityScale": Constructor = UParticleVelocityScale; break;
            case "Particle": Constructor = UParticle; break;
            case "ParticleColorScale": Constructor = UParticleColorScale; break;
            default:
                Constructor = UObject;
                console.warn(`Native struct '${constructorName}' bindings defined`);
        }

        return Constructor;
    }

    public getConstructor<T extends typeof UObject = typeof UObject>(constructorName: UObjectTypes_T): new () => T {
        let Constructor: any;

        // if (constructorName.toLocaleLowerCase().includes("fog"))
        //     debugger;

        switch (constructorName) {
            case "Class": Constructor = UClass; break;
            case "Struct": Constructor = UStruct; break;
            case "Const": Constructor = UConst; break;
            case "Enum": Constructor = UEnum; break;
            case "Function": Constructor = UFunction; break;

            case "FloatProperty": Constructor = UnProperties.UFloatProperty; break;
            case "ByteProperty": Constructor = UnProperties.UByteProperty; break;
            case "StrProperty": Constructor = UnProperties.UStrProperty; break;
            case "IntProperty": Constructor = UnProperties.UIntProperty; break;
            case "BoolProperty": Constructor = UnProperties.UBoolProperty; break;
            case "NameProperty": Constructor = UnProperties.UNameProperty; break;
            case "ClassProperty": Constructor = UnProperties.UClassProperty; break;
            case "ArrayProperty": Constructor = UnProperties.UArrayProperty; break;
            case "StructProperty": Constructor = UnProperties.UStructProperty; break;
            case "ObjectProperty": Constructor = UnProperties.UObjectProperty; break;
            case "DelegateProperty": Constructor = UnProperties.UDelegateProperty; break;

            case "State": Constructor = UState; break;
            case "Font": Constructor = UFont; break;
            case "StaticMesh": Constructor = UStaticMesh; break;
            case "TerrainSector": Constructor = UTerrainSector; break;
            case "Mesh": Constructor = UMesh; break;
            case "MeshAnimation": Constructor = UMeshAnimation; break;
            case "Level": Constructor = ULevel; break;
            case "StaticMeshInstance": Constructor = UStaticMeshInstance; break;
            case "StaticMeshActor": Constructor = UStaticMeshActor; break;
            case "MovableStaticMeshActor": Constructor = UMovableStaticMeshActor; break;
            case "Model": Constructor = UModel; break;
            case "Viewport": Constructor = UViewport; break;
            case "Client": Constructor = UClient; break;
            case "Player": Constructor = UPlayer; break;
            case "TerrainPrimitive": Constructor = UTerrainPrimitive; break;
            case "MeshInstance": Constructor = UMeshInstance; break;
            case "SkeletalMeshInstance": Constructor = USkeletalMeshInstance; break;

            case "Texture": Constructor = UTexture; break;
            case "Palette": Constructor = UPlatte; break;

            case "Emitter": Constructor = UEmitter; break;
            case "MeshEmitter": Constructor = UMeshEmitter; break;
            case "SpriteEmitter": Constructor = USpriteEmitter; break;

            case "ZoneInfo": Constructor = UZoneInfo; break;
            case "LevelInfo": Constructor = ULevelInfo; break;
            case "SkyZoneInfo": Constructor = USkyZoneInfo; break;
            case "TerrainInfo": Constructor = UTerrainInfo; break;

            case "NSun": Constructor = UNSun; break;
            case "NMoon": Constructor = UNMoon; break;
            case "NMovableSunLight": Constructor = UNMovableSunLight; break;

            case "LevelSummary": Constructor = ULevelSummary; break;
            case "PlayerStart": Constructor = UPlayerStart; break;
            case "Brush": Constructor = UBrush; break;

            case "TexRotator": Constructor = UnMaterials.UTexRotator; break;
            case "TexPanner": Constructor = UnMaterials.UTexPanner; break;
            case "TexCoordSource": Constructor = UnMaterials.UTexCoordSource; break;
            case "ColorModifier": Constructor = UnMaterials.UColorModifier; break;
            case "TexOscillator": Constructor = UnMaterials.UTexOscillator; break;
            case "FadeColor": Constructor = UnMaterials.UFadeColor; break;
            case "Shader": Constructor = UnMaterials.UShader; break;
            case "FinalBlend": Constructor = UnMaterials.UFinalBlend; break;
            case "TexEnvMap": Constructor = UnMaterials.UTexEnvMap; break;
            case "Cubemap": Constructor = UCubemap; break;

            case "Camera": Constructor = UCamera; break;

            case "PhysicsVolume": Constructor = UPhysicsVolume; break;
            case "BlockingVolume": Constructor = UBlockingVolume; break;
            case "MusicVolume": Constructor = UMusicVolume; break;
            case "ConvexVolume": Constructor = UConvexVolume; break;

            case "AmbientSoundObject": Constructor = UAmbientSoundObject; break;
            case "Sound": Constructor = USound; break;

            case "Light": Constructor = ULight; break;

            case "Mover": Constructor = UMover; break;

            // Classes we don't care about atm are marked as UObject for general puprose constructor
            case "L2FogInfo": Constructor = UObject; break;
            case "L2SeamlessInfo": Constructor = UObject; break;
            case "SceneManager": Constructor = UObject; break;
            case "PathNode": Constructor = UObject; break;
            default:
                debugger;
                throw new Error(`Not implemented native class: ${constructorName}`);
        }

        return Constructor;
    }

    // protected createObject<T extends UObject = UObject>(className: UObjectTypes_T, ...params: any[]) {
    //     let Constructor: typeof UObject = null;

    //     debugger;

    //     // if (className === "Class" && exp.objectName !== "Object")
    //     //     debugger;

    //     switch (className) {
    //         case "Class": {
    //             Constructor = UClass;
    //             // console.info(`Creating class: ${exp.objectName} [${exp.index}]`);
    //             debugger;
    //         } break
    //         case "Struct": Constructor = UStruct; break;
    //         case "Texture": Constructor = UTexture; break;
    //         case "Palette": Constructor = UPlatte; break;
    //         case "StaticMesh": Constructor = UStaticMesh; break;
    //         case "Shader": Constructor = UShader; break;
    //         case "LevelInfo": Constructor = ULevelInfo; break;
    //         case "TerrainSector": Constructor = UTerrainSector; break;
    //         case "ZoneInfo": Constructor = UZoneInfo; break;
    //         case "PhysicsVolume": Constructor = UPhysicsVolume; break;
    //         case "SkyZoneInfo": Constructor = USkyZoneInfo; break;
    //         case "Model": Constructor = UModel; break;
    //         case "Polys": Constructor = UPolys; break;
    //         case "Brush": Constructor = UBrush; break;
    //         case "Level": Constructor = ULevel; break;
    //         case "AmbientSoundObject": Constructor = UAmbientSoundObject; break;
    //         case "Sound": Constructor = USound; break;
    //         case "Light": Constructor = ULight; break;
    //         case "TerrainInfo": Constructor = UTerrainInfo; break;
    //         case "NMovableSunLight": Constructor = UNMovableSunLight; break;
    //         case "StaticMeshActor": Constructor = UStaticMeshActor; break;
    //         case "WaterVolume": Constructor = UWaterVolume; break;
    //         case "Emitter": Constructor = UEmitter; break;
    //         case "NSun": Constructor = UNSun; break;
    //         case "NMoon": Constructor = UNMoon; break;
    //         case "L2FogInfo": Constructor = UFogInfo; break;
    //         case "PlayerStart": Constructor = UPlayerStart; break;
    //         case "MusicVolume": Constructor = UMusicVolume; break;
    //         case "Mover": Constructor = UMover; break;
    //         case "BlockingVolume": Constructor = UBlockingVolume; break;
    //         case "Camera": Constructor = UCamera; break;
    //         case "FadeColor": Constructor = UFadeColor; break;
    //         case "StaticMeshInstance": Constructor = UStaticMeshInstance; break;
    //         case "TexRotator": Constructor = UTexRotator; break;
    //         case "TexPanner": Constructor = UTexPanner; break;
    //         case "ColorModifier": Constructor = UColorModifier; break;
    //         case "TexOscillator": Constructor = UTexOscillator; break;
    //         case "LevelSummary": Constructor = ULevelSummary; break;
    //         case "DefaultPhysicsVolume": Constructor = UDefaultPhysicsVolume; break;
    //         case "TextBuffer": Constructor = UTextBuffer; break;
    //         case "FinalBlend": Constructor = UFinalBlend; break;
    //         case "TexEnvMap": Constructor = UTexEnvMap; break;
    //         case "Cubemap": Constructor = UCubemap; break;
    //         case "SkeletalMesh": Constructor = USkeletalMesh; break;
    //         case "MeshAnimation": Constructor = UMeshAnimation; break;
    //         case "Function": Constructor = UFunction; break;
    //         case "Enum": Constructor = UEnum; break;
    //         case "Const": Constructor = UConst; break;
    //         case "ByteProperty": Constructor = UnProperties.UByteProperty; break;
    //         case "ObjectProperty": Constructor = UnProperties.UObjectProperty; break;
    //         case "StructProperty": Constructor = UnProperties.UStructProperty; break;
    //         case "IntProperty": Constructor = UnProperties.UIntProperty; break;
    //         case "BoolProperty": Constructor = UnProperties.UBoolProperty; break;
    //         case "NameProperty": Constructor = UnProperties.UNameProperty; break;
    //         case "FloatProperty": Constructor = UnProperties.UFloatProperty; break;
    //         case "ArrayProperty": Constructor = UnProperties.UArrayProperty; break;
    //         case "ClassProperty": Constructor = UnProperties.UClassProperty; break;
    //         case "StrProperty": Constructor = UnProperties.UStrProperty; break;
    //         case "State": Constructor = UState; break;
    //         case "Font": Constructor = UFont; break;
    //         case "Weapon": Constructor = UWeapon; break;
    //         default: throw new Error(`Unknown object type: ${className}`);
    //     }

    //     const object = (new (Constructor as any)(...params) as T);

    //     return object;
    // }

    public fetchObject<T extends UObject = UObject>(objref: number): T {
        if (objref <= 0) return null;

        const entry = this.exports[objref - 1];
        const Constructor = this.getConstructor(entry.objectName as NativeTypes_T) as any as T;

        const object = Constructor as T;
        const pkg = this.loader.getPackage("Core", "Script");

        if (!pkg.isDecoded()) throw new Error(`Package must be decoded: 'Core'`)

        return object;
    }
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

function registerNameTable(nameTable: UName[], nameHash: Map<string, number>, value: string) {
    if (nameHash.has(value)) return nameHash.get(value);

    const name = new UName();

    name.name = value;
    name.flags = 0;

    nameTable.push(name);
    nameHash.set(value, nameTable.length - 1);

    return name;
}

function addPackageDependendency(nameTable: UName[], nameHash: Map<string, number>, imports: UImport[], classPackage: string) {
    registerNameTable(nameTable, nameHash, "Native");

    const imp = new UImport();

    const className = "Package";
    const idClassName = nameHash.get("Package");
    const idClassPackage = nameHash.get(classPackage);

    imp.className = className;
    imp.classPackage = classPackage;
    imp.idClassName = idClassName;
    imp.idClassPackage = idClassPackage;
    imp.idObjectName = idClassPackage;
    imp.idPackage = 0
    imp.index = imports.length;
    imp.objectName = classPackage;

    imports.push(imp);
}
function addClassDependency(nameTable: UName[], nameHash: Map<string, number>, imports: UImport[], exports: UExport<UObject>[], classPackage: string, objectName: string) {
    registerNameTable(nameTable, nameHash, objectName);

    const imp = new UImport();
    const exp = new UExport();
    const idObjectName = nameHash.get(objectName);

    const nativePackage = imports.find(imp => imp.className === "Package" && imp.classPackage === classPackage);
    const nativeIndex = -(nativePackage.index + 1);

    imp.className = "Class";
    imp.classPackage = classPackage;
    imp.idClassName = nameHash.get("Class");
    imp.idClassPackage = nameHash.get(classPackage);
    imp.idObjectName = idObjectName;
    imp.idPackage = nativeIndex;
    imp.index = imports.length;
    imp.objectName = objectName;

    exp.index = exports.length
    exp.idClass = -(imp.index + 1);
    exp.idSuper = 0;
    exp.idPackage = nativeIndex;
    exp.idObjectName = idObjectName;
    exp.objectName = objectName;
    exp.flags = ObjectFlags_T.Native;
    exp.size = 0;
    exp.offset = 0;

    imports.push(imp);
    exports.push(exp);

    return { imp, exp };
}

