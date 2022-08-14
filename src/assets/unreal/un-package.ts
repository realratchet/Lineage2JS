import BufferValue from "../buffer-value";
import UHeader from "./un-header";
import UGeneration from "./un-generation";
import UExport from "./un-export";
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

class UPackage extends UEncodedFile {
    public readonly loader: AssetLoader;

    public exports: readonly UExport[];
    public imports: readonly UImport[];
    public nameTable: readonly UName[];
    public header: UHeader;

    constructor(loader: AssetLoader, path: string) {
        super(path);
        this.loader = loader;
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

        readable.read(header.version);
        readable.read(header.packageFlags);
        readable.read(header.nameCount);
        readable.read(header.nameOffset);
        readable.read(header.exportCount);
        readable.read(header.exportOffset);
        readable.read(header.importCount);
        readable.read(header.importOffset);

        // // Sanity check
        // console.assert(header.getArchiveFileVersion() === 123);
        // console.assert(header.getLicenseeVersion() === 23);

        const dbgNameCount = header.nameCount.value;
        const dbgNameOffset = header.nameOffset.value.toString(16).toUpperCase();
        const dbgExportCount = header.exportCount.value;
        const dbgExportOffset = header.exportOffset.value.toString(16).toUpperCase();
        const dbgImportCount = header.importCount.value;
        const dbgImportOffset = header.importOffset.value.toString(16).toUpperCase();

        console.log(`'${readable.path}' => Names:${dbgNameOffset}[${dbgNameCount}] Exports:${dbgExportOffset}[${dbgExportCount}] Imports:${dbgImportOffset}[${dbgImportCount}]`);

        if (readable.path === "assets/maps/20_21.unr") {
            console.assert(header.getArchiveFileVersion() === 123);
            console.assert(header.packageFlags.value === 0x1);
            console.assert(header.nameCount.value === 12165);
            console.assert(header.nameOffset.value === 0x40);
            console.assert(header.exportCount.value === 11379);
            console.assert(header.exportOffset.value === 0xFB1BF5);
            console.assert(header.importCount.value === 490);
            console.assert(header.importOffset.value === 0xFB0712);
        }

        if (header.getArchiveFileVersion() < 68) {
            readable.read(header.heritageCount);
            readable.read(header.heritageOffset);
        } else {
            readable.read(header.guid);

            const generationCount = readable.read(new BufferValue(BufferValue.int32));

            if (readable.path === "assets/maps/20_21.unr") {
                console.assert(generationCount.value === 1);
            }

            for (let i = 0, gc = generationCount.value as number; i < gc; i++) {
                const gen = new UGeneration();

                readable.read(gen.exportCount);
                readable.read(gen.nameCount);

                header.generations.push(gen);
            }
        }

        const nameTable = readable.loadNames(header);
        const exports = readable.loadExports(header, nameTable);
        const imports = readable.loadImports(header, nameTable);

        readable.exports = Object.freeze(exports);
        readable.imports = Object.freeze(imports);
        readable.nameTable = Object.freeze(nameTable);
        readable.header = header;

        Object.assign(this, readable, { isReadable: false });

        return this;
    }

    protected async getImport(index: number): Promise<UObject> {
        let imp = this.imports[index], mainImp = imp;
        while (imp.idPackage.value as number !== 0)
            imp = this.imports[-imp.idPackage.value as number - 1];

        if (!this.loader.hasPackage(imp.objectName, mainImp.className as SupportedImports_T))
            throw new Error(`Unable to locate package: ${imp.objectName}`);
        const pkg = await this.loader.getPackage(imp.objectName, mainImp.className as SupportedImports_T);

        if (!pkg.buffer) await this.loader.load(pkg);

        const exp = pkg.exports.find(exp =>
            exp.objectName === mainImp.objectName &&
            pkg.getPackageName(exp.idClass.value as number) === mainImp.className
            // pkg.getPackageName(exp.idClass.value as number) === pkg.getPackageName(mainImp.idPackage.value as number)
        );

        if (!exp) throw new Error("Missing export");
        if (exp.object) return exp.object;

        await this.createObject(pkg, exp, mainImp.className as UObjectTypes_T);

        return exp.object;
    }

    protected async getExport(index: number): Promise<UObject> {
        const exp = this.exports[index];

        if (exp.object) return exp.object;

        const className = this.getPackageName(exp.idClass.value as number) as UObjectTypes_T;

        await this.createObject(this, exp, className);

        return exp.object;
    }

    public async fetchObject<T extends UObject = UObject>(index: number): Promise<T> {
        const readable = this.asReadable();
        const object = index < 0
            ? await readable.getImport(-index - 1)
            : index > 0
                ? await readable.getExport(index - 1)
                : null;

        // if (object)
        //     console.log(`Fetch object: ${index} -> ${object.objectName}`);

        return object as T;
    }

    public async createObject<T extends UObject = UObject>(pkg: UPackage, exp: UExport<T>, className: UObjectTypes_T, ...params: any[]): Promise<T> {
        if (exp.object) return exp.object;

        let Constructor: typeof UObject = null;

        switch (className) {
            case "Class": Constructor = UClass; break
            case "Struct": Constructor = UStruct; break;
            case "Texture": Constructor = UTexture; break;
            case "Palette": Constructor = UPlatte; break;
            case "StaticMesh": Constructor = UStaticMesh; break;
            case "Shader": Constructor = UShader; break;
            case "LevelInfo": Constructor = ULevelInfo; break;
            case "TerrainSector": Constructor = UTerrainSector; break;
            case "ZoneInfo": Constructor = UZoneInfo; break;
            case "PhysicsVolume": Constructor = UPhysicsVolume; break;
            case "SkyZoneInfo": Constructor = USkyZoneInfo; break;
            case "Model": Constructor = UModel; break;
            case "Polys": Constructor = UPolys; break;
            case "Brush": Constructor = UBrush; break;
            case "Level": Constructor = ULevel; break;
            case "AmbientSoundObject": Constructor = UAmbientSoundObject; break;
            case "Sound": Constructor = USound; break;
            case "Light": Constructor = ULight; break;
            case "TerrainInfo": Constructor = UTerrainInfo; break;
            case "NMovableSunLight": Constructor = UNMovableSunLight; break;
            case "StaticMeshActor": Constructor = UStaticMeshActor; break;
            case "WaterVolume": Constructor = UWaterVolume; break;
            case "Emitter": Constructor = UEmitter; break;
            case "NSun": Constructor = UNSun; break;
            case "NMoon": Constructor = UNMoon; break;
            case "L2FogInfo": Constructor = UFogInfo; break;
            case "PlayerStart": Constructor = UPlayerStart; break;
            case "MusicVolume": Constructor = UMusicVolume; break;
            case "Mover": Constructor = UMover; break;
            case "BlockingVolume": Constructor = UBlockingVolume; break;
            case "Camera": Constructor = UCamera; break;
            case "FadeColor": Constructor = UFadeColor; break;
            case "StaticMeshInstance": Constructor = UStaticMeshInstance; break;
            case "TexRotator": Constructor = UTexRotator; break;
            case "TexPanner": Constructor = UTexPanner; break;
            case "ColorModifier": Constructor = UColorModifier; break;
            case "TexOscillator": Constructor = UTexOscillator; break;
            case "LevelSummary": Constructor = ULevelSummary; break;
            case "DefaultPhysicsVolume": Constructor = UDefaultPhysicsVolume; break;
            case "TextBuffer": Constructor = UTextBuffer; break;
            case "FinalBlend": Constructor = UFinalBlend; break;
            case "TexEnvMap": Constructor = UTexEnvMap; break;
            case "Cubemap": Constructor = UCubemap; break;
            default: throw new Error(`Unknown object type: ${className}`);
        }

        const object = exp.object = (new (Constructor as any)(...params) as T);

        await object.load(pkg.asReadable(), exp);

        return exp.object;
    }

    public getPackageName(index: number) {
        return index < 0
            ? this.imports[-index - 1].objectName as string
            : index > 0
                ? this.exports[index].objectName as string
                : "Class";
    }

    protected loadImports(header: UHeader, nameTable: UName[]) {
        this.seek(header.importOffset.value as number, "set");

        const imports: UImport[] = [];
        const index = new BufferValue(BufferValue.compat32);

        for (let i = 0, ic = header.importCount.value; i < ic; i++) {
            const uimport = new UImport();

            this.read(index);

            uimport.classPackage = nameTable[index.value as number].name.string;

            this.read(index);

            uimport.className = nameTable[index.value as number].name.string;

            this.read(uimport.idPackage);
            this.read(index);

            uimport.objectName = nameTable[index.value as number].name.string;

            imports.push(uimport);
        }

        return imports;
    }

    protected loadNames(header: UHeader) {
        this.seek(header.nameOffset.value as number, "set");

        const nameTable: UName[] = [];

        for (let i = 0, nc = header.nameCount.value as number; i < nc; i++) {
            const uname = new UName();

            this.read(uname.name);
            this.read(uname.flags);

            nameTable.push(uname);

            // console.log(`Name[${i}]: "${(uname.name.string)}"`);
        }

        return nameTable;
    }

    protected loadExports(header: UHeader, nameTable: UName[]) {
        this.seek(header.exportOffset.value as number, "set");

        const exports: UExport[] = [];
        const index = new BufferValue(BufferValue.compat32);

        for (let i = 0, ec = header.exportCount.value as number; i < ec; i++) {
            const uexport = new UExport();

            this.read(uexport.idClass);
            this.read(uexport.idSuper);
            this.read(uexport.idPackage);
            this.read(index);

            uexport.index = i;
            uexport.objectName = nameTable[index.value as number].name.string;

            this.read(uexport.flags);
            this.read(uexport.size);

            if (uexport.size.value as number > 0)
                this.read(uexport.offset);

            exports.push(uexport);
        }

        return exports;
    }
}

export default UPackage;
export { UPackage };

(global.console as any).assert = function (cond: Function, text: string, dontThrow: boolean) {
    if (cond) return;
    if (dontThrow) {
        debugger;
    } else {
        debugger;
        throw new Error(text || "Assertion failed!");
    }
};