import BaseConfigFile from "./un-base-config";
import UL2NEnvLight from "@client/assets/unreal/un-l2env";


class UConfigTimeEnv extends BaseConfigFile {
    declare ["constructor"]: typeof UConfigTimeEnv

    public load(pkgNative: GA.UNativePackage, pkgEngine: GA.UEnginePackage): UL2NEnvLight {
        const uClass = pkgEngine.fetchObjectByType<C.UClass<UL2NEnvLight>>("Class", "L2NEnvLight").loadSelf();
        const L2NEnvLight = uClass.buildClass(pkgNative);

        const envLight = new L2NEnvLight();
        const fileContents = this.decodeConfig();

        envLight.load(fileContents, pkgNative, pkgEngine);

        return envLight;
    }

}

export default UConfigTimeEnv;
export { UConfigTimeEnv };