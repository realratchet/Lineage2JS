import BaseConfigFile from "./un-base-config";
import { parseConfigFile } from "./conf-parser";

export class UConfigIni extends BaseConfigFile {
    public getSections(): Map<string, [string, string][]> { return parseConfigFile(this.decodeConfig()); }
}

export default UConfigIni;
