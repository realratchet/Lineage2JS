import BufferValue from "../buffer-value";
import FArray from "./un-array";
import FConstructable from "./un-constructable";
import UExport from "./un-export";
import FNumber from "./un-number";
import UObject from "./un-object";
import UPackage from "./un-package";
import UState from "./un-state";

class FDependencies extends FConstructable {
    protected classId: number;

    public scriptTextCRC: number;
    public depth: number;
    public class: UClass;

    public load(pkg: UPackage): this {
        const compat32 = new BufferValue(BufferValue.compat32);
        const uint32 = new BufferValue(BufferValue.uint32);
        const int32 = new BufferValue(BufferValue.int32);

        this.classId = pkg.read(compat32).value as number;
        this.depth = pkg.read(uint32).value as number;
        this.scriptTextCRC = pkg.read(int32).value as number;

        this.promisesLoading.push(new Promise<void>(async resolve => {
            if (this.classId !== 0) {
                this.class = await pkg.fetchObject<UClass>(this.classId);

                await this.class.onLoaded();
            }

            resolve();
        }));

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

    // these should be instantiated somehow differently
    protected emitterIds: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.compat32) as any);
    protected destroyAudio: boolean;
    protected isNoDelete: boolean;
    protected drawScale: number;
    protected isDirectional: number;
    protected rightHandBone: string;
    protected leftHandBone: string;
    protected rightArmBone: string;
    protected leftArmBone: string;
    protected spineBone: string;
    protected lowbodyBone: string;
    protected capeBone: string;
    protected headBone: string;
    protected rightFootBone: string;
    protected leftFootBone: string;
    protected isFaceRotation: boolean;
    protected isNPC: boolean;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Emitters": "emitterIds",
            "AutoDestroy": "destroyAudio",
            "bNoDelete": "isNoDelete",
            "DrawScale": "drawScale",
            "bDirectional": "isDirectional",
            "RightHandBone": "rightHandBone",
            "LeftHandBone": "leftHandBone",
            "RightArmBone": "rightArmBone",
            "LeftArmBone": "leftArmBone",
            "SpineBone": "spineBone",
            "LowbodyBone": "lowbodyBone",
            "CapeBone": "capeBone",
            "HeadBone": "headBone",
            "RightFootBone": "rightFootBone",
            "LeftFootBone": "leftFootBone",
            "bEnableFaceRotation": "isFaceRotation",
            "bNpc": "isNPC"
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
                const object = await pkg.fetchObject(id.value);

                await object.onLoaded();

                return object;
            }));

            resolve();
        }));

        if (verArchive >= 0x3e) {
            this.classWithinId = pkg.read(compat32).value as number;

            const nameId = pkg.read(compat32).value as number;

            this.classConfigName = pkg.nameTable[nameId].name.value as string;
        }

        if (verArchive >= 0x63) {
            this.pkgImportIds2.load(pkg);

            this.promisesLoading.push(new Promise<void>(async resolve => {
                this.pkgImports2 = await Promise.all((this.pkgImportIds2 as FNumber[]).map(async id => {
                    const object = await pkg.fetchObject(id.value);

                    await object.onLoaded();

                    return object;
                }));

                resolve();
            }));
        }

        this.readHead = pkg.tell();

        this.readNamedProps(pkg);
        this.readHead = pkg.tell();
    }
}

export default UClass;
export { UClass };