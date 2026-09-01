import type { ANativePackage, EnginePackage_T, UClass } from "@l2js/core";
import BaseConfigFile from "./un-base-config";
import { UL2NEnvLight } from "../un-l2env";


export class UConfigTimeEnv extends BaseConfigFile {
    declare ["constructor"]: typeof UConfigTimeEnv

    declare protected envLight: UL2NEnvLight;

    public load(pkgNative: ANativePackage, pkgEngine: EnginePackage_T): this {
        const uClass = pkgEngine.fetchObjectByType<UClass<UL2NEnvLight>>("Class", "L2NEnvLight").loadSelf();
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
