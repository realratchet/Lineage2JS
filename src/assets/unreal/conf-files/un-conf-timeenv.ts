import BaseConfigFile from "./un-base-config";
import UL2NEnvManager, { UL2NEnvLight, EEnvCycle } from "@client/assets/unreal/un-l2env";


class UConfigTimeEnv extends BaseConfigFile {
    declare ["constructor"]: typeof UConfigTimeEnv

    declare protected envLight: UL2NEnvLight;

    public load(pkgNative: C.ANativePackage, pkgEngine: C.AEnginePackage): this {
        const uClass = pkgEngine.fetchObjectByType<C.UClass<UL2NEnvLight>>("Class", "L2NEnvLight").loadSelf();
        const L2NEnvLight = uClass.buildClass(pkgNative);

        const envLight = new L2NEnvLight();
        const fileContents = this.decodeConfig();

        envLight.load(fileContents, pkgNative, pkgEngine);

        this.envLight = envLight;

        return this;
    }

    public getDecodeInfo() { return this.envLight.getDecodeInfo(); }

}

export default UConfigTimeEnv;
export { UConfigTimeEnv };