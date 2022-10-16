import BufferValue from "../buffer-value";
import FArray from "./un-array";
import FConstructable from "./un-constructable";
import UEmitter from "./un-emitter";
import UExport from "./un-export";
import FNumber from "./un-number";
import UObject from "./un-object";
import UPackage from "./un-package";
import { PropertyTag } from "./un-property";
import UState from "./un-state";

class FDependencies extends FConstructable {
    public scriptTextCRC: number;
    public depth: number;
    public classId: number;
    public class: UClass;

    public load(pkg: UPackage): this {
        const compat32 = new BufferValue(BufferValue.compat32);
        const uint32 = new BufferValue(BufferValue.uint32);

        this.classId = pkg.read(compat32).value as number;
        this.depth = pkg.read(uint32).value as number;
        this.scriptTextCRC = pkg.read(uint32).value as number;

        // this.promisesLoading.push(new Promise<void>(async resolve => {
        //     if (this.classId !== 0)
        //         this.class = await pkg.fetchObject<UClass>(this.classId);


        //     resolve();
        // }));

        return this;
    }
}

class UClass extends UState {
    protected classFlags: number;
    protected classGuid: DataView;
    protected dependencies = new FArray(FDependencies);
    protected pkgImportIds: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.compat32) as any);
    protected pkgImportIds2: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.compat32) as any);
    protected pkgImports: UObject[];
    protected pkgImports2: UObject[];
    protected classWithinId: number;
    protected classConfigName: string;
    protected emitters = new FArray(UEmitter);

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Emitters": "emitters"
        })
    }

    protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
        super.doLoad(pkg, exp);

        this.readHead = pkg.tell();

        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();

        const uint32 = new BufferValue(BufferValue.uint32);
        const compat32 = new BufferValue(BufferValue.compat32);

        if (verArchive <= 61) {
            debugger;
        }

        this.classFlags = pkg.read(uint32).value as number;
        this.classGuid = pkg.read(BufferValue.allocBytes(16)).value as DataView;

        this.dependencies.load(pkg);
        this.pkgImportIds.load(pkg);

        this.promisesLoading.push(new Promise<void>(async resolve => {
            this.pkgImports = await Promise.all((this.pkgImportIds as FNumber[]).map(async id => {
                return await pkg.fetchObject(id.value);
            }));

            resolve();
        }));

        if(verArchive >= 0x3e) {
            this.classWithinId = pkg.read(compat32).value as number;
            
            const nameId = pkg.read(compat32).value as number;
            
            this.classConfigName = pkg.nameTable[nameId].name.value as string;
        }

        if(verArchive >= 0x63) {
            this.pkgImportIds2.load(pkg);

            this.promisesLoading.push(new Promise<void>(async resolve => {
                this.pkgImports2 = await Promise.all((this.pkgImportIds2 as FNumber[]).map(async id => {
                    return await pkg.fetchObject(id.value);
                }));
    
                resolve();
            }));
        }

        // debugger;

        this.readHead = pkg.tell();

        // debugger;
        
        this.readNamedProps(pkg);

        debugger;

        const impCount = pkg.read(compat32).value as number;
        const impList = [];

        for (let i = 0; i < impCount; i++) {
            const impIndex = pkg.read(compat32).value as number;
            const impNameId = pkg.read(compat32).value as number;
            const impName = pkg.nameTable[impNameId];

            impList.push([impIndex, impNameId, impName?.name.value as string]);
        }

        this.readHead = pkg.tell();

        debugger;


    }
}

export default UClass;
export { UClass };