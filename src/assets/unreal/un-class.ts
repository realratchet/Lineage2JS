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
            if (this.classId !== 0)
                this.class = await pkg.fetchObject<UClass>(this.classId);

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

    public baseStruct: UClass;
    public second: UObject

    public readonly isClass = true;

    // // these should be instantiated somehow differently
    // protected emitterIds: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.compat32) as any);
    // protected destroyAudio: boolean;
    // protected isNoDelete: boolean;
    // protected drawScale: number;
    // protected isDirectional: number;
    // protected rightHandBone: string;
    // protected leftHandBone: string;
    // protected rightArmBone: string;
    // protected leftArmBone: string;
    // protected spineBone: string;
    // protected lowbodyBone: string;
    // protected capeBone: string;
    // protected headBone: string;
    // protected rightFootBone: string;
    // protected leftFootBone: string;
    // protected isFaceRotation: boolean;
    // protected isNPC: boolean;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            // "Emitters": "emitterIds",
            // "AutoDestroy": "destroyAudio",
            // "bNoDelete": "isNoDelete",
            // "DrawScale": "drawScale",
            // "bDirectional": "isDirectional",
            // "RightHandBone": "rightHandBone",
            // "LeftHandBone": "leftHandBone",
            // "RightArmBone": "rightArmBone",
            // "LeftArmBone": "leftArmBone",
            // "SpineBone": "spineBone",
            // "LowbodyBone": "lowbodyBone",
            // "CapeBone": "capeBone",
            // "HeadBone": "headBone",
            // "RightFootBone": "rightFootBone",
            // "LeftFootBone": "leftFootBone",
            // "bEnableFaceRotation": "isFaceRotation",
            // "bNpc": "isNPC"
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
            this.pkgImports = await Promise.all(
                (this.pkgImportIds as FNumber[])
                    .map(id => pkg.fetchObject(id.value))
            );

            resolve();
        }));

        if (verArchive >= 0x3e) {
            this.classWithinId = pkg.read(compat32).value as number;

            const nameId = pkg.read(compat32).value as number;

            this.classConfigName = pkg.nameTable[nameId].name as string;
        }

        if (verArchive >= 0x63) {
            this.pkgImportIds2.load(pkg);

            this.promisesLoading.push(new Promise<void>(async resolve => {
                this.pkgImports2 = await Promise.all(
                    (this.pkgImportIds2 as FNumber[])
                        .map(id => pkg.fetchObject(id.value))
                );
                resolve();
            }));
        }

        this.readHead = pkg.tell();

        this.readNamedProps(pkg);
        this.readHead = pkg.tell();
    }
}

enum EClassFlags_T {
    // Base flags.
    CLASS_Abstract = 0x00001,  // Class is abstract and can't be instantiated directly.
    CLASS_Compiled = 0x00002,  // Script has been compiled successfully.
    CLASS_Config = 0x00004,  // Load object configuration at construction time.
    CLASS_Transient = 0x00008,	// This object type can't be saved; null it out at save time.
    CLASS_Parsed = 0x00010,	// Successfully parsed.
    CLASS_Localized = 0x00020,  // Class contains localized text.
    CLASS_SafeReplace = 0x00040,  // Objects of this class can be safely replaced with default or NULL.
    CLASS_RuntimeStatic = 0x00080,	// Objects of this class are static during gameplay.
    CLASS_NoExport = 0x00100,  // Don't export to C++ header.
    CLASS_NoUserCreate = 0x00200,  // Don't allow users to create in the editor.
    CLASS_PerObjectConfig = 0x00400,  // Handle object configuration on a per-object basis, rather than per-class.
    CLASS_NativeReplication = 0x00800,  // Replication handled in C++.

    // Flags to inherit from base class.
    CLASS_Inherit = CLASS_Transient | CLASS_Config | CLASS_Localized | CLASS_SafeReplace | CLASS_RuntimeStatic | CLASS_PerObjectConfig,
    CLASS_RecompilerClear = CLASS_Inherit | CLASS_Abstract | CLASS_NoExport | CLASS_NativeReplication,
};

export default UClass;
export { UClass, EClassFlags_T };

