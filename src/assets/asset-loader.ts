import AssetBuffer from "./asset-buffer";

/**
 * 00..32 bits signature
 * 24..32 bits encryption key
 */

class AssetLoader {
    async load(path: string): Promise<any> {
        const response = await fetch(path);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = new AssetBuffer(arrayBuffer);

        const decoded = await buffer.decode();

        return null;
    }
}

export default AssetLoader;
export { AssetLoader };