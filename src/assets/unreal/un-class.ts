import BufferValue from "../buffer-value";
import FArray from "./un-array";
import FConstructable from "./un-constructable";
import UExport from "./un-export";
import FNumber from "./un-number";
import UObject from "./un-object";
import UPackage from "./un-package";
import { UArrayProperty, UProperty } from "./un-properties";
import { PropertyTag } from "./un-property-tag";
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

    public baseStruct: UClass;
    public second: UObject

    public readonly isClass = true;

    // constructor(...args: any[]) {
    //     // debugger;

    //     super(...args);
    // }

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

        // this.promisesLoading.push(new Promise<void>(async resolve => {
        //     this.pkgImports = await Promise.all(
        //         (this.pkgImportIds as FNumber[])
        //             .map(id => pkg.fetchObject(id.value))
        //     );

        //     resolve();
        // }));

        if (verArchive >= 0x3e) {
            this.classWithinId = pkg.read(compat32).value as number;

            const nameId = pkg.read(compat32).value as number;

            this.classConfigName = pkg.nameTable[nameId].name as string;
        }

        if (verArchive >= 0x63) {
            this.pkgImportIds2.load(pkg);

            // this.promisesLoading.push(new Promise<void>(async resolve => {
            //     this.pkgImports2 = await Promise.all(
            //         (this.pkgImportIds2 as FNumber[])
            //             .map(id => pkg.fetchObject(id.value))
            //     );
            //     resolve();
            // }));
        }

        this.readHead = pkg.tell();

        // if (this.friendlyName === "Material")
        //     debugger;

        this.readNamedProps(pkg);
        // if (this.friendlyName === "Material")
        //     debugger;

        // if (this.friendlyName === "Emitter")
        //     debugger;
    }


    protected tagsReadNamedProps: any[];

    protected readNamedProps(pkg: UPackage) {
        pkg.seek(this.readHead, "set");

        const tags = [];

        if (this.readHead < this.readTail) {
            do {
                const tag = PropertyTag.from(pkg, this.readHead);

                if (!tag.isValid()) break;

                const offset = pkg.tell();

                tags.push(((pkg: UPackage, offset: number, tag: PropertyTag) => {
                    pkg.seek(offset, "set");
                    this.loadProperty(pkg, tag);
                }).bind(this, pkg, offset, tag));

                pkg.seek(offset + tag.dataSize, "set");
                this.readHead = pkg.tell();

            } while (this.readHead < this.readTail);
        }

        this.tagsReadNamedProps = tags;
        this.readHead = pkg.tell();
    }

    // protected _decodePromiseCls: Promise<void>;

    // public async onDecodeReady(): Promise<void> {
    //     let resolve: (value: void | PromiseLike<void>) => void, reject: (reason?: any) => void;

    //     const hasPromise = !!this._decodePromiseCls;

    //     if (!hasPromise) {
    //         this._decodePromiseCls = new Promise((_resolve, _reject) => {
    //             resolve = _resolve;
    //             reject = _reject;
    //         });
    //     } else {
    //         return;
    //     }

    //     await super.onDecodeReady();

    //     if (this.tagsReadNamedProps.length > 0) {
    //         await new Promise<void>(async resolve => {
    //             let i = 0;
    //             for (const [pkg, offset, tag, fn] of this.tagsReadNamedProps) {
    //                 console.log(`(${this.friendlyName})`, ++i, "of", this.tagsReadNamedProps.length, tag.name, this.exportIndex);
    //                 await fn(pkg, offset, tag);
    //                 console.log(`\t\t<----(${this.friendlyName})`);
    //             }

    //             resolve();
    //         });
    //     }

    //     if (!hasPromise) resolve();
    // }

    public buildClass(): typeof UObject[] {
        if (this.kls) return this.kls;

        this.kls = [];

        const dependencyTree = new Array<UClass>();
        let lastBase: UClass = this;


        do {
            dependencyTree.push(lastBase);
            lastBase.loadSuper();

            lastBase = lastBase.superField as UClass;
        } while (lastBase);

        // debugger;

        const clsNamedProperties: Record<string, any> = {};

        for (const base of dependencyTree.reverse()) {
            // debugger
            while (base.tagsReadNamedProps.length > 0)
                base.tagsReadNamedProps.shift()();

            if (base.constructor !== UClass)
                debugger;

            const { childPropFields, namedProperties, friendlyName } = base;

            for (const field of childPropFields) {
                if (!(field instanceof UProperty)) continue;

                const propertyName = field.propertyName;

                if (field instanceof UArrayProperty) {
                    if (propertyName in namedProperties)
                        debugger;

                    clsNamedProperties[propertyName] = field.createObject();
                }

                // debugger;


                const value = propertyName in namedProperties ? namedProperties[propertyName] : [];

                if (value.length > 1)
                    debugger;

                clsNamedProperties[propertyName] = value[0];

                // debugger;
            }

            // debugger;
        }

        const cls = {
            [this.friendlyName]: class extends UObject {
                constructor() {
                    super();

                    for (const [name, value] of Object.entries(clsNamedProperties)) {
                        (this as any)[name] = value;
                    }
                }

                protected getPropertyMap(): Record<string, string> {
                    return {
                        ...super.getPropertyMap(),
                        ...Object.keys(clsNamedProperties).reduce((acc, k) => {
                            acc[k] = k; return acc;
                        }, {} as Record<string, string>)
                    }
                }
            }
        }[this.friendlyName];


        debugger;
        this.kls = [cls as any];

        return this.kls;
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

