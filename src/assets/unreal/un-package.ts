import BufferValue from "../buffer-value";
import UHeader from "./un-header";
import UGeneration from "./un-generation";
import UExport, { ObjectFlags_T } from "./un-export";
import UName from "./un-name";
import UImport from "./un-import";
import UTexture from "./un-texture";
import UObject from "./un-object";
import "./un-object-mixin";
import UClass from "./un-class";
import UStruct from "./un-struct";
import UPlatte from "./un-palette";
import UStaticMesh from "./static-mesh/un-static-mesh";
import { UShader, UFadeColor, UTexRotator, UTexPanner, UColorModifier, UTexOscillator, UFinalBlend, UTexEnvMap } from "./un-material";
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
import UDependencyGraph from "./un-dependency-graph";
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


class UPackage extends UEncodedFile {
    public readonly loader: AssetLoader;

    public exports: UExport[];
    public imports: UImport[];
    public nameTable: UName[];
    public header: UHeader;
    public exportGroups: GenericObjectContainer_T<{ index: number; export: UExport; }[]>;
    public importGroups: GenericObjectContainer_T<{ import: UImport; index: number; }[]>;
    public readonly isCore: boolean;
    public readonly isEngine: boolean;

    public readonly nativeClassess = new Map<NativeTypes_T, typeof UObject>();
    public nameHash = new Map<string, number>();

    constructor(loader: AssetLoader, path: string) {
        super(path);
        this.loader = loader;

        this.isCore = this.path.toLocaleLowerCase().endsWith("core.u");
        this.isEngine = this.path.toLocaleLowerCase().endsWith("engine.u");
    }

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

        readable.importGroups = readable.imports.reduce((accum, imp, index) => {
            const impType = imp.className;
            const list = accum[impType] = accum[impType] || [];

            list.push({ import: imp, index: -index - 1 });

            return accum;
        }, {} as GenericObjectContainer_T<{ import: UImport, index: number }[]>);

        readable.exportGroups = readable.exports.reduce((accum, exp, index) => {

            const expType = readable.getPackageName(exp.idClass as number) || "Class";
            const list = accum[expType] = accum[expType] || [];

            list.push({ index, export: exp });

            return accum;
        }, {} as GenericObjectContainer_T<{ index: number, export: UExport }[]>)

        Object.assign(this, readable, { isReadable: false });

        this.registerNativeClassess();

        return this;
    }

    protected registerNativeClass(Constructor: typeof UObject, inPackage: boolean, className: NativeTypes_T, baseClass?: NativeTypes_T | "None") {
        this.nativeClassess.set(className, Constructor);

        if (inPackage) {
            const ref = this.findObjectRef("Class", className);

            if (ref === 0) { // register native class as a package with the export table
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

            // debugger;
        }
    }

    protected registerNativeClassess() {
        this.registerNativeClass(UObject, this.isCore, "Object");
        this.registerNativeClass(UField, this.isCore, "Field", "Object");
        this.registerNativeClass(UConst, this.isCore, "Const", "Field");
        this.registerNativeClass(UEnum, this.isCore, "Enum", "Field");
        this.registerNativeClass(UStruct, this.isCore, "Struct", "Field");
        this.registerNativeClass(UFunction, this.isCore, "Function", "Struct");
        this.registerNativeClass(UState, this.isCore, "State", "Struct");
        this.registerNativeClass(UClass, this.isCore, "Class", "State");
        this.registerNativeClass(UnProperties.UProperty, this.isCore, "Property", "Field");
        // this.registerNativeClass(UnProperties.UPointerProperty, this.isCore, "PointerProperty", "Property");
        this.registerNativeClass(UnProperties.UByteProperty, this.isCore, "ByteProperty", "Property");
        this.registerNativeClass(UnProperties.UObjectProperty, this.isCore, "ObjectProperty", "Property");
        this.registerNativeClass(UnProperties.UClassProperty, this.isCore, "ClassProperty", "ObjectProperty");
        // this.registerNativeClass(UnProperties.UFixedArrayProperty, this.isCore, "FixedArrayProperty", "Property");
        this.registerNativeClass(UnProperties.UArrayProperty, this.isCore, "ArrayProperty", "Property");
        // this.registerNativeClass(UnProperties.UMapProperty, this.isCore, "MapProperty", "Property");
        this.registerNativeClass(UnProperties.UStructProperty, this.isCore, "StructProperty", "Property");
        this.registerNativeClass(UnProperties.UIntProperty, this.isCore, "IntProperty", "Property");
        this.registerNativeClass(UnProperties.UBoolProperty, this.isCore, "BoolProperty", "Property");
        this.registerNativeClass(UnProperties.UFloatProperty, this.isCore, "FloatProperty", "Property");
        this.registerNativeClass(UnProperties.UNameProperty, this.isCore, "NameProperty", "Property");
        this.registerNativeClass(UnProperties.UStrProperty, this.isCore, "StrProperty", "Property");
        // this.registerNativeClass(UnProperties.UStringProperty, this.isCore, "StringProperty", "Property");
        this.registerNativeClass(UTextBuffer, this.isCore, "TextBuffer", "Object");

        this.registerNativeClass(UFont, this.isEngine, "Font", "Object");
        this.registerNativeClass(UPlatte, this.isEngine, "Palette", "Object");
        this.registerNativeClass(USound, this.isEngine, "Sound", "Object");
        // this.registerNativeClass(this.isEngine, "Music", "Object");

        this.registerNativeClass(UPrimitive, this.isEngine, "Primitive", "Object");
        this.registerNativeClass(UMesh, this.isEngine, "Mesh", "Primitive");
        this.registerNativeClass(ULodMesh, this.isEngine, "LodMesh", "Mesh");
        this.registerNativeClass(USkeletalMesh, this.isEngine, "SkeletalMesh", "LodMesh");
        this.registerNativeClass(UMeshAnimation, this.isEngine, "Animation", "Object");

        this.registerNativeClass(UModel, this.isEngine, "Model", "Primitive");
        // this.registerNativeClass(this.isEngine, "LevelBase", "Object");
        this.registerNativeClass(ULevel, this.isEngine, "Level", "LevelBase");
        this.registerNativeClass(ULevelSummary, this.isEngine, "LevelSummary", "Object");
        this.registerNativeClass(UPolys, this.isEngine, "Polys", "Object");
        this.registerNativeClass(FBSPNode, this.isEngine, "BspNodes", "Object");
        this.registerNativeClass(FBSPSurf, this.isEngine, "BspSurfs", "Object");
        this.registerNativeClass(FVector, this.isEngine, "Vectors", "Object");
        this.registerNativeClass(FVert, this.isEngine, "Verts", "Object");

        // this.registerNativeClass(this.isEngine, "Texture", "Object");
        // this.registerNativeClass(this.isEngine, "Texture", "Bitmap");
        // this.registerNativeClass(this.isEngine, "FractalTexture", "Texture");
        // this.registerNativeClass(this.isEngine, "FireTexture", "FractalTexture");
        // this.registerNativeClass(this.isEngine, "IceTexture", "FractalTexture");
        // this.registerNativeClass(this.isEngine, "WaterTexture", "FractalTexture");
        // this.registerNativeClass(this.isEngine, "WaveTexture", "WaterTexture");
        // this.registerNativeClass(this.isEngine, "WetTexture", "WaterTexture");
        // this.registerNativeClass(this.isEngine, "ScriptedTexture", "Texture");

        // this.registerNativeClass(this.isEngine, "Client", "Object");
        // this.registerNativeClass(this.isEngine, "Viewport", "Player");
        // this.registerNativeClass(this.isEngine, "Canvas", "Object");
        // this.registerNativeClass(this.isEngine, "Console", "Object");
        // this.registerNativeClass(this.isEngine, "Player", "Object");
        // this.registerNativeClass(this.isEngine, "NetConnection", "Player");
        // this.registerNativeClass(this.isEngine, "DemoRecConnection", "NetConnection");
        // this.registerNativeClass(this.isEngine, "PendingLevel", "Object");
        // this.registerNativeClass(this.isEngine, "NetPendingLevel", "PendingLevel");
        // this.registerNativeClass(this.isEngine, "DemoPlayPendingLevel", "PendingLevel");
        // this.registerNativeClass(this.isEngine, "Channel", "Object");
        // this.registerNativeClass(this.isEngine, "ControlChannel", "Channel");
        // this.registerNativeClass(this.isEngine, "ActorChannel", "Channel");
        // this.registerNativeClass(this.isEngine, "FileChannel", "Channel");

        this.registerNativeClass(UAActor, this.isEngine, "Actor", "Object");
        // this.registerNativeClass(this.isEngine, "Light", "Actor");
        // this.registerNativeClass(this.isEngine, "Inventory", "Actor");
        // this.registerNativeClass(this.isEngine, "Weapon", "Inventory");
        // this.registerNativeClass(this.isEngine, "NavigationPoint", "Actor");
        // this.registerNativeClass(this.isEngine, "LiftExit", "NavigationPoint");
        // this.registerNativeClass(this.isEngine, "LiftCenter", "NavigationPoint");
        // this.registerNativeClass(this.isEngine, "WarpZoneMarker", "NavigationPoint");
        // this.registerNativeClass(this.isEngine, "InventorySpot", "NavigationPoint");
        // this.registerNativeClass(this.isEngine, "TriggerMarker", "NavigationPoint");
        // this.registerNativeClass(this.isEngine, "ButtonMarker", "NavigationPoint");
        // this.registerNativeClass(this.isEngine, "PlayerStart", "NavigationPoint");
        // this.registerNativeClass(this.isEngine, "Teleporter", "NavigationPoint");
        // this.registerNativeClass(this.isEngine, "PathNode", "NavigationPoint");
        // this.registerNativeClass(this.isEngine, "Decoration", "Actor");
        // this.registerNativeClass(this.isEngine, "Carcass", "Decoration");
        // this.registerNativeClass(this.isEngine, "Projectile", "Actor");
        // this.registerNativeClass(this.isEngine, "Keypoint", "Actor");
        // this.registerNativeClass(this.isEngine, "locationid", "Keypoint");
        // this.registerNativeClass(this.isEngine, "InterpolationPoint", "Keypoint");
        // this.registerNativeClass(this.isEngine, "Triggers", "Actor");
        // this.registerNativeClass(this.isEngine, "Trigger", "Triggers");
        // this.registerNativeClass(this.isEngine, "HUD", "Actor");
        // this.registerNativeClass(this.isEngine, "Menu", "Actor");
        this.registerNativeClass(UInfo, this.isEngine, "Info", "Actor");
        // this.registerNativeClass(this.isEngine, "Mutator", "Info");
        // this.registerNativeClass(this.isEngine, "GameInfo", "Info");
        // this.registerNativeClass(this.isEngine, "ZoneInfo", "Info");
        // this.registerNativeClass(this.isEngine, "LevelInfo", "ZoneInfo");
        // this.registerNativeClass(this.isEngine, "WarpZoneInfo", "ZoneInfo");
        // this.registerNativeClass(this.isEngine, "SkyZoneInfo", "ZoneInfo");
        // this.registerNativeClass(this.isEngine, "SavedMove", "Info");
        // this.registerNativeClass(this.isEngine, "ReplicationInfo", "Info");
        // this.registerNativeClass(this.isEngine, "PlayerReplicationInfo", "ReplicationInfo");
        // this.registerNativeClass(this.isEngine, "GameReplicationInfo", "ReplicationInfo");
        // this.registerNativeClass(this.isEngine, "InternetInfo", "Info");
        // this.registerNativeClass(this.isEngine, "StatLog", "Info");
        // this.registerNativeClass(this.isEngine, "StatLogFile", "StatLog");
        // this.registerNativeClass(this.isEngine, "Decal", "Actor");
        // this.registerNativeClass(this.isEngine, "SpawnNotify", "Actor");
        this.registerNativeClass(UBrush, this.isEngine, "Brush", "Actor");
        // this.registerNativeClass(this.isEngine, "Mover", "Brush");
        this.registerNativeClass(UPawn, this.isEngine, "Pawn", "Actor");
        this.registerNativeClass(UController, this.isEngine, "Controller", "Actor");
        // this.registerNativeClass(this.isEngine, "Scout", "Pawn");
        // this.registerNativeClass(this.isEngine, "PlayerPawn", "Pawn");
        // this.registerNativeClass(this.isEngine, "Camera", "PlayerPawn");
    }

    protected findObjectRef(className: string, objectName: string, groupName: string = "None"): number {
        const isClass = className == "Class";

        for (const exp of this.exports) {
            if (exp.objectName !== objectName) continue;
            if (groupName !== "None") {
                debugger;
            }

            if (isClass) {
                if (exp.idClass > 0) {
                    const other = this.exports[exp.idClass as number + 1];

                    if (other && className === other.objectName)
                        return exp.index + 1;

                    debugger;
                } else if (exp.idClass < 0) {
                    const clsImport = this.imports[-exp.idClass - 1];

                    if (clsImport && className === clsImport.objectName) {
                        debugger;
                        return exp.index + 1;
                    }
                } else if (exp.idClass === 0) return exp.index + 1;

            } else if (exp.idClass !== 0) {
                debugger;
            }
        }

        // if (!isClass)
        //     debugger;

        // for (const imp of this.imports) {
        //     if (imp.objectName !== objectName) continue;

        //     if (isClass) {
        //         if (imp.className === className) {
        //             // debugger;
        //             return -(imp.index + 1);
        //         }
        //     }

        //     debugger;
        // }

        // debugger;

        return 0;
    }

    newObject(objname: string, objclass: UClass, flags: number, initProperties: boolean) {
        debugger;
        for (let cur = objclass; cur; cur = cur.baseStruct) {

            if (!this.nativeClassess.has(cur.objectName as NativeTypes_T)) continue;

            const buildNative = this.nativeClassess.get(cur.objectName as NativeTypes_T);
            const obj = buildNative<UClass>(objname, objclass, flags);

            if (initProperties) {
                debugger;
                // obj.PropertyData.Init(objclass);
                // obj.SetObject("Class", obj.Class);
                // obj.SetName("Name", obj.objectName);
                // obj.SetInt("ObjectFlags", obj.Flags);
            }
            return obj;

        }

        throw Error("Could not find the native class for " + objname);
    }

    async loadExportObject(index: number) {
        const entry = this.exports[index];
        const objname = entry.objectName;

        if (entry.idClass !== 0) {
            let objclass: UClass = await this.fetchObject(entry.idClass) as UClass;

            if (!objclass) {
                debugger;
                objclass = await this.fetchObject(entry.idClass) as UClass;
                throw Error("Could not find the object class for " + objname);
            }

            debugger;

            const object = this.exports[index].object = this.newObject(objname, objclass, this.exports[index].flags, false);

            debugger;

            object.load(this.asReadable(), entry);

        } else {
            let objbase = await this.fetchObject(entry.idSuper) as UClass;
            let pkg: UPackage = this;

            if (!objbase && objname !== "Object") {
                debugger;
                pkg = await this.loader.getPackage("Core", "Script");

                if (!pkg.buffer) await this.loader.load(pkg);

                objbase = await pkg.fetchObjectByType("Class", "Object") as UClass;
            }

            // if (index === 771)
            //     debugger;

            const objflags = this.exports[index].flags;
            const obj = new (UClass as any)(objname, objbase, objflags) as UClass;

            obj.friendlyName = objname;
            this.exports[index].object = obj;

            obj.load(pkg.asReadable(), entry);

            const Constructor = this.nativeClassess.get(obj.friendlyName as NativeTypes_T);

            if (!Constructor)
                throw new Error(`Missing: ${obj.friendlyName}`);

            // Constructor.extend(obj);

            // debugger;
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

    async fetchObject<T extends UObject = UObject>(objref: number): Promise<T> {
        if (objref > 0) // Export table object
        {
            const index = objref - 1;

            if (index > this.exports.length)
                throw new Error("Invalid object reference");

            if (!this.exports[index].object)
                await this.loadExportObject(index);

            return this.exports[index].object as T;
        }
        else if (objref < 0) // Import table object
        {
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

            const pkg = await this.loader.getPackage(packageName, className as SupportedImports_T);

            if (!pkg.buffer) await this.loader.load(pkg);

            let obj = await pkg.fetchObjectByType(className, objectName, groupName);

            // What a garbage engine!
            if (!obj && packageName == "UnrealI")
                debugger;
            // obj = Packages->GetPackage("UnrealShare")->GetUObject(className, objectName, groupName);
            else if (!obj && packageName == "UnrealShare")
                debugger
            // obj = Packages->GetPackage("UnrealI")->GetUObject(className, objectName, groupName);

            return obj as T;
        }
        else {
            return null;
        }
    }

    fetchObjectByType(className: string, objectName: string, groupName: string = "None") {
        return this.fetchObject(this.findObjectRef(className, objectName, groupName));
    }


    // protected async getImport(index: number): Promise<UObject> {
    //     debugger;
    //     const mainImp = this.imports[index];
    //     let imp = this.imports[-mainImp.idPackage - 1];

    //     let groupName = "None";

    //     if (imp.idPackage !== 0)
    //         groupName = imp.objectName;

    //     while (imp.idPackage as number !== 0)
    //         imp = this.imports[-imp.idPackage as number - 1];

    //     const packageName = imp.objectName;
    //     const objectName = mainImp.objectName;
    //     const className = mainImp.className;

    //     const pkg = await this.loader.getPackage(packageName, className as SupportedImports_T);

    //     if (!pkg.buffer) await this.loader.load(pkg);

    //     const expIndex = pkg.findObjectRef(className, objectName, groupName);


    //     if (expIndex > 0) {
    //         const exp = this.exports[index];

    //         if (exp.object) return exp.object;

    //         return pkg.getExport(exp.index);
    //     } else if (expIndex < 0) {
    //         const obj = this.createObject(objectName as UObjectTypes_T);

    //         return obj;
    //     } if (expIndex === 0) throw new Error("Missing export");



    //     // await this.createObject(pkg, exp, className as UObjectTypes_T);

    //     // return exp.object;


    //     // let imp = this.imports[index], mainImp = imp;
    //     // while (imp.idPackage as number !== 0)
    //     //     imp = this.imports[-imp.idPackage as number - 1];

    //     // if (!this.loader.hasPackage(imp.objectName, mainImp.className as SupportedImports_T))
    //     //     throw new Error(`Unable to locate package: ${imp.objectName}`);
    //     // const pkg = await this.loader.getPackage(imp.objectName, mainImp.className as SupportedImports_T);

    //     // if (!pkg.buffer) await this.loader.load(pkg);

    //     // // if (mainImp.idPackage as number === -1) {
    //     // //     let Constructor: typeof UField = null;

    //     // //     debugger;

    //     // //     switch (mainImp.className) {
    //     // //         case "Class": Constructor = UClass; break;
    //     // //         default: throw new Error(`Unsupported native type: ${mainImp.className}`);
    //     // //     }

    //     // //     return new Constructor();
    //     // // }

    //     // const plausibleImports = pkg.exports.filter(exp => exp.objectName === mainImp.objectName)

    //     // const exp = plausibleImports.find(exp => pkg.getPackageName(exp.idSuper as number) === mainImp.className)

    //     // // const _exp = plausibleImports[0];

    //     // // if (mainImp.idPackage as number === -1) {
    //     // //     const a = pkg.getPackageName(_exp.idClass as number);
    //     // //     const b = mainImp.className;

    //     // //     debugger;
    //     // // }

    //     // // const exp = plausibleImports.find(exp => pkg.getPackageName(exp.idClass as number) === mainImp.className
    //     // //     // pkg.getPackageName(exp.idClass as number) === pkg.getPackageName(mainImp.idPackage as number)
    //     // // );

    //     // if (!exp) throw new Error("Missing export");
    //     // if (exp.object) return exp.object;

    //     // await this.createObject(pkg, exp, mainImp.className as UObjectTypes_T);

    //     // return exp.object;
    // }

    // protected getUObject(index: number) {
    //     debugger;
    // }

    // protected newObject(className: UObjectTypes_T, superClass: UClass, flags: number) {
    //     debugger;
    // }

    // protected async getExport(index: number): Promise<UObject> {
    //     const exp = this.exports[index];

    //     if (exp.object) return exp.object;

    //     const objectName = exp.objectName;

    //     if (exp.idClass !== 0) {
    //         const objectClass = await this.fetchObject<UClass>(exp.idClass as number);

    //         const object = this.newObject(objectName as UObjectTypes_T, objectClass, exp.flags as number);

    //         debugger;
    //     } else {
    //         let baseClass = await this.fetchObject(exp.idSuper as number);

    //         debugger;

    //         if (!baseClass && objectName.toLowerCase() === "object") {
    //             const baseExport = this.findObjectRef("Class", "Object", "None");

    //             // baseClass = await this.createExportObject(this, baseExport, "Class");
    //         }

    //         debugger;
    //     }

    //     debugger;

    //     const className = (this.getPackageName(exp.idClass as number) || exp.objectName) as UObjectTypes_T;

    //     await this.createExportObject(this, exp, className);

    //     return exp.object;
    // }

    // public async fetchObject<T extends UObject = UObject>(index: number): Promise<T> {
    //     const readable = this.asReadable();
    //     const object = index > 0
    //         ? await readable.getExport(index - 1)
    //         : index < 0
    //             ? await readable.getImport(-index - 1)
    //             : null;

    //     return object as T;
    // }

    // protected createObject<T extends UObject = UObject>(className: UObjectTypes_T, ...params: any[]) {
    //     let Constructor: typeof UObject = null;

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

    // public async createExportObject<T extends UObject = UObject>(pkg: UPackage, exp: UExport<T>, className: UObjectTypes_T, ...params: any[]): Promise<T> {
    //     if (exp.object) return exp.object;

    //     const object = exp.object = this.createObject(className, ...params);

    //     object.load(pkg.asReadable(), exp);

    //     return exp.object;
    // }

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

export default UPackage;
export { UPackage, PackageFlags_T };

(global.console as any).assert = function (cond: Function, text: string, dontThrow: boolean) {
    if (cond) return;
    if (dontThrow) {
        debugger;
    } else {
        debugger;
        throw new Error(text || "Assertion failed!");
    }
};