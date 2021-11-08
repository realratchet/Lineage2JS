import UObject from "./un-object";

class UClass extends UObject {
    public async load() {
        return this;
    }
}

export default UClass;
export { UClass };