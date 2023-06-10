import { flagBitsToDict } from "@client/utils/flags";
import BufferValue from "../buffer-value";
import FArray from "./un-array";
import FConstructable from "./un-constructable";
import UEnum from "./un-enum";
import UExport, { ObjectFlags_T } from "./un-export";
import FNumber from "./un-number";
import UObject, { EnumeratedValue } from "./un-object";
import UPackage from "./un-package";
import { UArrayProperty, UByteProperty, UProperty } from "./un-properties";
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

        return this;
    }
}

class UClass extends UState {
    protected flags: EClassFlags_T;
    public classFlags: Readonly<Record<string, boolean>>;
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
    protected static getConstructorName() { return "Class"; }

    protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
        super.doLoad(pkg, exp);

        this.readHead = pkg.tell();

        const verArchive = pkg.header.getArchiveFileVersion();

        const uint32 = new BufferValue(BufferValue.uint32);
        const compat32 = new BufferValue(BufferValue.compat32);

        if (verArchive <= 61) {
            debugger;
        }

        this.flags = pkg.read(uint32).value as number;
        this.classFlags = flagBitsToDict(this.flags, EClassFlags_T as any);
        this.classGuid = pkg.read(BufferValue.allocBytes(16)).value as DataView;

        this.dependencies.load(pkg);
        this.pkgImportIds.load(pkg);

        if (verArchive >= 0x3e) {
            this.classWithinId = pkg.read(compat32).value as number;

            const nameId = pkg.read(compat32).value as number;

            this.classConfigName = pkg.nameTable[nameId].name as string;
        }

        if (verArchive >= 0x63)
            this.pkgImportIds2.load(pkg);

        this.readHead = pkg.tell();
        this.readNamedProps(pkg);
    }

    protected defaultsLoading = new Array<Function>();

    protected loadDefaults() {

        const dependencyTree = this.collectDependencies();

        for (const base of dependencyTree.reverse()) {
            while (base.defaultsLoading.length > 0) {
                const fn = base.defaultsLoading.shift();

                fn();
            }
        }

        return this;
    }

    protected readNamedProps(pkg: UPackage) {
        pkg.seek(this.readHead, "set");

        if (this.readHead < this.readTail) {
            do {
                const tag = PropertyTag.from(pkg, this.readHead);

                if (!tag.isValid()) break;

                const offset = pkg.tell();

                this.defaultsLoading.push(() => {
                    pkg.seek(offset, "set");
                    this.loadProperty(pkg, tag);
                });

                pkg.seek(tag.dataSize);
                this.readHead = pkg.tell();

            } while (this.readHead < this.readTail);

        }

        this.readHead = pkg.tell();
    }

    public buildClass<T extends UObject = UObject>(pkg: UNativePackage): new () => T {
        if (this.kls)
            return this.kls as any as new () => T;

        this.loadSelf().loadDefaults();

        const dependencyTree = this.collectDependencies<UClass>();

        if (!this.isReady)
            debugger;

        const clsNamedProperties: Record<string, any> = {};
        const clsEnumProperties: Record<string, { defaultValue: number, names: string[] }> = {};
        const inheretenceChain = new Array<string>();

        let lastNative: UClass = null;

        for (const base of dependencyTree.reverse()) {

            inheretenceChain.push(base.loadDefaults().friendlyName);

            if (!base.exp || base.exp.anyFlags(ObjectFlags_T.Native))
                lastNative = base;

            if (base.constructor !== UClass)
                debugger;

            const { childPropFields, defaultProperties } = base;

            for (const field of childPropFields) {
                if (!(field instanceof UProperty)) continue;

                const propertyName = field.propertyName;

                // if (field.propertyName.includes("Clamp"))
                //     debugger;

                // if (field.propertyName === "Style" && (this as any)[propertyName] === 8)
                //     debugger;

                if (field instanceof UArrayProperty) {
                    if (field.arrayDimensions !== 1)
                        debugger;

                    if (defaultProperties.has(propertyName))
                        debugger;

                    clsNamedProperties[propertyName] = (field.dtype as FArray).clone((this as any)[propertyName]);
                    continue;
                }

                if (field instanceof UByteProperty && (field as any).value) {
                    if (!((field as any).value instanceof UEnum))
                        debugger;

                    if (field.arrayDimensions !== 1)
                        debugger;

                    clsEnumProperties[propertyName] = {
                        defaultValue: (this as any)[propertyName],
                        names: (field as any).value.names
                    };

                    // let value: number = undefined;

                    // clsEnumProperties[propertyName] = {
                    //     get value(): number { return value; },
                    //     set value(v: number) { value = v; },
                    //     valueOf() { return value; },
                    //     toString() {
                    //         return isFinite(value) && value < (field as any).value.names.length ? (field as any).value.names[value] : `<invalid '${value}'>`;
                    //     }
                    // };

                    continue;
                }

                clsNamedProperties[propertyName] = field.arrayDimensions > 1
                    ? propertyName in this
                        ? (this as any)[propertyName]
                        : new Array(field.arrayDimensions)
                    : (this as any)[propertyName];


            }

            for (const propertyName of Object.keys(defaultProperties))
                clsNamedProperties[propertyName] = (this as any)[propertyName];
        }

        const friendlyName = this.friendlyName;
        const hostClass = this;
        const Constructor = lastNative
            ? pkg.getConstructor(lastNative.friendlyName as NativeTypes_T) as any as typeof UObject
            : UObject;

        const cls = {
            [this.friendlyName]: class extends Constructor {
                public static readonly isDynamicClass = true;
                public static readonly friendlyName = friendlyName;
                public static readonly hostClass = hostClass;
                public static readonly nativeClass = lastNative;
                public static readonly inheretenceChain = Object.freeze(inheretenceChain);

                protected newProps: Record<string, string> = {};

                public static getConstructorName() { return friendlyName; }

                constructor() {
                    super();

                    const oldProps = this.getPropertyMap();
                    const newProps = this.newProps;
                    const missingProps = [];

                    if (friendlyName === "Emitter")
                        debugger;

                    for (const [name, value] of Object.entries(clsNamedProperties)) {
                        const varname = name in oldProps ? oldProps[name] : name;

                        if (!(name in oldProps)) {
                            newProps[varname] = varname;
                            missingProps.push(varname);
                        }

                        // if (value === 8 && name === "Style")
                        //     debugger;

                        if (value !== undefined || !(varname in this))
                            (this as any)[varname] = value;
                    }

                    for (const [name, { defaultValue, names }] of Object.entries(clsEnumProperties)) {
                        const varname = name in oldProps ? oldProps[name] : name;

                        if (typeof defaultValue === "object")
                            debugger;

                        if (!(name in oldProps)) {
                            newProps[varname] = varname;
                            missingProps.push(varname);
                        }

                        // if (defaultValue === 8 && name === "Style")
                        //     debugger;

                        const oldValue = varname in this && (this as any)[varname] !== undefined ? (this as any)[varname] as number : defaultValue;
                        const value = new EnumeratedValue(oldValue, names);

                        if (varname in this)
                            delete (this as any)[varname];

                        (this as any)[varname] = value;

                        // Object.defineProperty(this, varname, {
                        //     value,
                        //     writable: false
                        // });
                    }

                    // debugger;

                    if (missingProps.length > 0)
                        console.warn(`Native type '${Constructor.name}' is missing property '${missingProps.join(", ")}'`);
                }

                protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
                    // if (this.objectName.includes("StaticMeshActor140") || this.objectName.includes("StaticMeshActor141"))
                    //     debugger;


                    super.doLoad(pkg, exp);

                    // if (this.objectName.includes("StaticMeshActor140") || this.objectName.includes("StaticMeshActor141"))
                    //     debugger;

                }

                protected getPropertyMap(): Record<string, string> {
                    return {
                        ...super.getPropertyMap(),
                        ...this.newProps
                    };
                }

                public toString() { return `[D]${friendlyName}=(name=${this.objectName})` }
            }
        }[this.friendlyName];


        this.kls = cls;

        return this.kls as any as new () => T;
    }
}

enum EClassFlags_T {
    // Base flags.
    CLASS_Abstract = 0x00001,  // Class is abstract and can't be instantiated directly.
    CLASS_Compiled = 0x00002,  // Script has been compiled successfully.
    CLASS_Config = 0x00004,  // Load object configuration at construction time.
    CLASS_Transient = 0x00008,    // This object type can't be saved; null it out at save time.
    CLASS_Parsed = 0x00010,    // Successfully parsed.
    CLASS_Localized = 0x00020,  // Class contains localized text.
    CLASS_SafeReplace = 0x00040,  // Objects of this class can be safely replaced with default or NULL.
    CLASS_RuntimeStatic = 0x00080,    // Objects of this class are static during gameplay.
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