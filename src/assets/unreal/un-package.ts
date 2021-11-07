import BufferValue from "../buffer-value";
import UHeader from "./un-header";
import UGeneration from "./un-generation";
import UExport from "./un-export";
import UName from "./un-name";
import UImport from "./un-import";
import UTexture from "./un-texture";
import UObject from "./un-object";
import UPlatte from "./un-palette";
import UStaticMesh from "./static-mesh/un-static-mesh";
import { UShader, UFadeColor, UTexRotator, UTexPanner, UColorModifier } from "./un-material";
import ULevelInfo from "./un-level-info";
import UTerrainSector from "./un-terrain-sector";
import "./un-object-mixin";
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
import { UClass } from "./un-class";
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
import UStaticMeshIsntance from "./static-mesh/un-static-mesh-instance";

type AssetLoader = import("../asset-loader").AssetLoader;

class UPackage {
    public readonly path: string;
    public readonly loader: AssetLoader;

    protected buffer: ArrayBuffer = null;
    protected isEncrypted = false;
    protected cryptKey = new BufferValue(BufferValue.uint8);
    protected offset = 0;
    protected contentOffset = 0;

    public exports: readonly UExport[];
    public imports: readonly UImport[];
    public nameTable: readonly UName[];

    constructor(loader: AssetLoader, path: string) {
        this.path = path;
        this.loader = loader;
    }

    public seek(offset: number, origin: Seek_T = "current") {
        switch (origin) {
            case "current": this.offset = this.offset + offset; break;
            case "set": this.offset = offset + this.contentOffset; break;
            default: throw new Error(`Seek type not supported: ${origin}`);
        }
    }

    public read<T extends ValueTypeNames_T>(target: BufferValue<T> | number) {
        const cryptKey = this.cryptKey.value as number;
        const _target = typeof (target) === "number" ? BufferValue.allocBytes(target) : target as BufferValue<T>;

        this.offset += _target.readValue(this.buffer, this.offset, this.isEncrypted, cryptKey);

        return _target;
    }

    public tell() { return this.offset - this.contentOffset; }

    public dump(lineCount: number, restore: boolean = true, printHeaders: boolean = true) {
        let oldHeader = this.offset;

        if (printHeaders) {
            console.log("--------------------------------------------------------");
            console.log(`------------------- Dumping lines ----------------------`);
            console.log("--------------------------------------------------------");
        }

        let constructedString = "";
        for (let i = 0; i < lineCount; i++) {
            const bytes = Math.min(this.buffer.byteLength - this.offset, 8);
            const groups = new Array(bytes).fill('.').map(() => this.read(2));

            const string1 = groups.map(g => g.hex.slice(2)).join(" ");
            const string2 = groups.map(g => g.string).join("");

            constructedString += string2;
            constructedString = constructedString.slice(-100);

            if (lineCount <= 256) {
                if (true || string1.match(/(^0005)|(^0077)|(^0007)/)) {

                    const extraArgs = [];

                    let finalString = string1;

                    if (finalString.match(/(^0005)|(^0077)|(^0007)/)) {
                        finalString = finalString
                            .replace(/^0005/, "%c0005%c")
                            .replace(/^0077/, "%c0077%c")
                            .replace(/^0007/, "%c0007%c");
                        extraArgs.push("color: red; font-weight:bold", "color: black");
                    }

                    if (finalString.match(/((?<=\ )10)|(10(?=\ ))/)) {
                        finalString = finalString
                            .replace(/((?<=\ )10)|(10(?=\ ))/, "%c10%c");
                        extraArgs.push("color: blue; font-weight:bold", "color: black");
                    }

                    if (finalString.match(/((?<=\ )0F)|(0F(?=\ ))/)) {
                        finalString = finalString
                            .replace(/((?<=\ )0F)|(0F(?=\ ))/, "%c0F%c");
                        extraArgs.push("color: green; font-weight:bold", "color: black");
                    }

                    // if (finalString.match(/(00 00)|((?<=\ )0000(?=\ ))/)) {
                    //     finalString = finalString
                    //         .replace(/00 00/, "%c00 00%c")
                    //         .replace(/(?<=\ )0000(?=\ )/, "%c0000%c");
                    //     extraArgs.push("color: purple; font-weight:bold", "color: black");
                    // }

                    console.log(
                        [
                            finalString,
                            string2
                        ].join(" "),
                        ...extraArgs
                    );
                } else {
                    console.log(
                        string1,
                        string2
                    );
                }
            }
        }

        if (printHeaders)
            console.log("--------------------------------------------------------");

        if (restore) this.offset = oldHeader;
    }

    public async decode(): Promise<this> {
        if (this.buffer) return this;

        const response = await fetch(this.path);

        if (!response.ok) throw new Error(response.statusText);

        this.buffer = await response.arrayBuffer();

        const signature = this.read(new BufferValue(BufferValue.uint32));
        const HEADER_SIZE = 28;

        if (signature.value == 0x0069004C) {
            this.seek(HEADER_SIZE, "set");
            this.read(this.cryptKey);

            this.cryptKey.value = 0xC1 ^ (this.cryptKey.value as number);

            this.isEncrypted = true;
            this.contentOffset = HEADER_SIZE;
            this.seek(0, "set");
            this.read(signature);
        }

        if (signature.value !== 0x9E2A83C1)
            throw new Error(`Invalid signature: '0x${signature.toString(16).toUpperCase()}' expected '0x9E2A83C1'`);

        const header = new UHeader();

        this.read(header.version);
        this.read(header.packageFlags);
        this.read(header.nameCount);
        this.read(header.nameOffset);
        this.read(header.exportCount);
        this.read(header.exportOffset);
        this.read(header.importCount);
        this.read(header.importOffset);

        const dbgNameCount = header.nameCount.value;
        const dbgNameOffset = header.nameOffset.value.toString(16).toUpperCase();
        const dbgExportCount = header.exportCount.value;
        const dbgExportOffset = header.exportOffset.value.toString(16).toUpperCase();
        const dbgImportCount = header.importCount.value;
        const dbgImportOffset = header.importOffset.value.toString(16).toUpperCase();

        console.log(`'${this.path}' => Names:${dbgNameOffset}[${dbgNameCount}] Exports:${dbgExportOffset}[${dbgExportCount}] Imports:${dbgImportOffset}[${dbgImportCount}]`);

        if (this.path === "assets/maps/20_21.unr") {
            console.assert(header.getVersionLWORD() === 123);
            console.assert(header.packageFlags.value === 0x1);
            console.assert(header.nameCount.value === 12165);
            console.assert(header.nameOffset.value === 0x40);
            console.assert(header.exportCount.value === 11379);
            console.assert(header.exportOffset.value === 0xFB1BF5);
            console.assert(header.importCount.value === 490);
            console.assert(header.importOffset.value === 0xFB0712);
        }

        if (header.getVersionLWORD() < 68) {
            this.read(header.heritageCount);
            this.read(header.heritageOffset);
        } else {
            this.read(header.guid);

            const generationCount = this.read(new BufferValue(BufferValue.int32));

            if (this.path === "assets/maps/20_21.unr") {
                console.assert(generationCount.value === 1);
            }

            for (let i = 0, gc = generationCount.value as number; i < gc; i++) {
                const gen = new UGeneration();

                this.read(gen.exportCount);
                this.read(gen.nameCount);

                header.generations.push(gen);
            }
        }

        const nameTable = this.loadNames(header);
        const exports = this.loadExports(header, nameTable);
        const imports = this.loadImports(header, nameTable);

        this.exports = Object.freeze(exports);
        this.imports = Object.freeze(imports);
        this.nameTable = Object.freeze(nameTable);

        return this;
    }

    protected async getImport(index: number) {
        let imp = this.imports[index], mainImp = imp;
        while (imp.idPackage.value as number !== 0)
            imp = this.imports[-imp.idPackage.value as number - 1];

        if (!this.loader.hasPackage(imp.objectName))
            throw new Error(`Unable to locate package: ${imp.objectName}`);

        const pkg = this.loader.getPackage(imp.objectName);

        if (!pkg.buffer) await this.loader.load(pkg);

        const exp = pkg.exports.find(exp =>
            exp.objectName === mainImp.objectName &&
            pkg.getPackageName(exp.idClass.value as number) === mainImp.className
            // pkg.getPackageName(exp.idClass.value as number) === pkg.getPackageName(mainImp.idPackage.value as number)
        );

        if (!exp) throw new Error("Missing export");
        if (exp.object) return exp.object;

        exp.object = await this.createObject(pkg, exp, mainImp.className as UObjectTypes_T);

        return exp.object;
    }

    protected async getExport(index: number) {
        const exp = this.exports[index];

        if (exp.object) return exp.object;

        const className = this.getPackageName(exp.idClass.value as number) as UObjectTypes_T;
        const object = await this.createObject(this, exp, className);

        return exp.object;
    }

    public async fetchObject(index: number) {
        if (index < 0) return this.getImport(-index - 1);
        else if (index > 0) return this.getExport(index - 1);
        return null;
    }

    public async createObject<T extends UObject = UObject>(pkg: UPackage, exp: UExport<T>, className: UObjectTypes_T, ...params: any[]): Promise<T> {
        if (exp.object) return exp.object;

        let Constructor: typeof UObject = null;

        switch (className) {
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
            case "Class": Constructor = UClass; break
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
            case "StaticMeshInstance": Constructor = UStaticMeshIsntance; break;
            case "TexRotator": Constructor = UTexRotator; break;
            case "TexPanner": Constructor = UTexPanner; break;
            case "ColorModifier": Constructor = UColorModifier; break;
            default: throw new Error(`Unknown object type: ${className}`);
        }

        exp.object = await (new (Constructor as any)(...params) as T).load(pkg, exp);

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
        throw new Error(text || "Assertion failed!");
    }
};