import UPackage from "./un-package";
import FConstructable from "./un-constructable";

const REGISTER: GenericObjectContainer_T<typeof FConstructable> = {

};

const UClassRegistry = new class UClassRegistry {
    constructor() {

    }

    get structs() { return Object.freeze(REGISTER); }

    public register(object: UStruct) {
        const SuperKlass = object.superField ? REGISTER[(object.superField as UStruct).friendlyName] : FConstructable;
        const klassName = object.friendlyName;
        const Klass = REGISTER[klassName] = createStruct(klassName, SuperKlass, object.childPropFields);

        return Klass;
    }
};

export default UClassRegistry;
export { UClassRegistry };

function createStruct(name: string, cls: typeof FConstructable, props: UProperty[]) {
    const Klass = class extends cls {
        constructor() {
            super();

            for (const prop of props) {
                const propName = prop.objectName.slice(4);

                let value: any = undefined;

                Object.defineProperty(this, propName, {
                    get: () => value,
                    set: v => value = v
                });
            }
        }

        public load(pkg: UPackage, tag?: PropertyTag): this {

            for (const prop of props) {
                const propName = prop.objectName.slice(4);

                (this as any)[propName] = prop.loadValue(pkg);
            }

            return this;
        }
    }

    Object.defineProperty(Klass, "name", { value: name });

    return Klass;
}

