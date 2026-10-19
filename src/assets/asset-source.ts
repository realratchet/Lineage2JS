import { cyrb53 } from "./unreal/utils/hash-cyrb";
import InstallShieldCabinet from "./install-shield-cabinet";

export type AssetFiles_T = [string, File][];
export type ServedAssets_T = { files: Record<string, string>; version: string; };

type AssetEntry_T = { path: string; read(): Promise<Blob | Uint8Array>; };

const SUPPORTED_EXTENSIONS = ["UNR", "UTX", "USX", "UAX", "U", "UKX", "USK", "U", "OGG"];

let assetFiles: AssetFiles_T = null;
let assetSourceId = "http";
let assetIndex: Map<string, AssetEntry_T> = null;
let servedAssets: ServedAssets_T = { files: Object.create(null), version: "" };

async function openCabinet(files: AssetFiles_T, header: [string, File]) {
    const dir = header[0].slice(0, header[0].length - "data1.hdr".length).toLowerCase();
    const volumes = new Map<number, Blob>();

    for (const [path, file] of files) {
        const match = path.toLowerCase().match(/^(.*)data(\d+)\.cab$/);

        if (match && match[1] === dir) volumes.set(Number(match[2]), file);
    }

    const cabinet = await InstallShieldCabinet.open(header[1], volumes);

    return cabinet.files.map(file => ({ path: file.path, read: () => cabinet.extract(file) }));
}

function indexInstall(files: AssetFiles_T) {
    const marker = files.find(([path]) => /(^|\/)system\/core\.u$/i.test(path));

    if (!marker) throw new Error(`Selected folder has neither a System/Core.u nor an InstallShield data1.hdr.`);

    const root = marker[0].length - "system/core.u".length;

    return files
        .filter(([path]) => path.slice(0, root) === marker[0].slice(0, root))
        .map(([path, file]) => ({ path: path.slice(root), read: async () => file }));
}

async function buildIndex(files: AssetFiles_T) {
    const header = files.find(([path]) => /(^|\/)data1\.hdr$/i.test(path));
    const entries = header ? await openCabinet(files, header) : indexInstall(files);

    return new Map(entries.map(entry => [entry.path.toLowerCase(), entry]));
}

function createAssetList(index: Map<string, AssetEntry_T>) {
    const assetList = { supported: {} as Record<string, string>, unsupported: new Array<string>() };

    const paths = new Map(Array.from(index.values(), entry => [entry.path.toLowerCase(), entry.path]));

    for (const [key, path] of Object.entries(servedAssets.files)) paths.set(key, path);

    for (const path of paths.values()) {
        const ext = path.slice(path.lastIndexOf(".") + 1).toUpperCase();

        if (SUPPORTED_EXTENSIONS.includes(ext)) assetList.supported[path.toLowerCase()] = path;
        else assetList.unsupported.push(path);
    }

    return assetList;
}

export function getAssetFiles() { return assetFiles; }
export function getAssetSourceId() { return servedAssets.version ? `${assetSourceId}-${servedAssets.version}` : assetSourceId; }
export function getServedAssets() { return servedAssets; }
export function setServedAssets(assets: ServedAssets_T) {
    if (!assets || typeof assets.version !== "string" || !assets.files || typeof assets.files !== "object" || Array.isArray(assets.files))
        throw new Error(`Invalid served asset manifest.`);

    for (const [key, path] of Object.entries(assets.files))
        if (typeof path !== "string" || key !== path.toLowerCase() || path.startsWith("/") || path.includes("\\") || path.split("/").some(part => !part || part === "." || part === ".."))
            throw new Error(`Invalid served asset path '${path}'.`);

    servedAssets = { files: Object.assign(Object.create(null), assets.files), version: assets.version };
}
export function isServedAsset(path: string) { return !!servedAssets.files[path.replace(/^\/?assets\//, "").toLowerCase()]; }

export async function selectAssetFiles(files: AssetFiles_T): Promise<void> {
    assetIndex = await buildIndex(files);
    assetFiles = files;
    const sources = files.map(([path, file]) => ({ path, size: file.size, modified: file.lastModified })).sort((a, b) => a.path.localeCompare(b.path));

    assetSourceId = `files-${cyrb53(JSON.stringify(sources)).toString(16)}`;
}

export async function fetchAsset(path: string): Promise<Response> {
    const servedPath = servedAssets.files[path.replace(/^\/?assets\//, "").toLowerCase()];

    if (servedPath) {
        let response: Response;

        try { response = await fetch(`assets/${servedPath.split("/").map(encodeURIComponent).join("/")}`); }
        catch (e) {
            if (!(e instanceof TypeError)) throw e;
            if (!assetFiles) throw e;
        }

        if (response && (response.ok || (response.status !== 404 && response.status !== 410))) return response;
    }

    if (!assetFiles) return fetch(path);

    if (path === "asset-list.json") return new Response(JSON.stringify(createAssetList(assetIndex)));

    const entry = assetIndex.get(path.replace(/^\/?assets\//, "").toLowerCase());

    if (!entry) return new Response(null, { status: 404, statusText: "Not Found" });

    const startTime = performance.now();
    const data = await entry.read();
    const size = data instanceof Blob ? data.size : data.byteLength;

    console.log(`[asset-source] ${entry.path} (${(size / 1024).toFixed(1)} kB, ${(performance.now() - startTime).toFixed(0)} ms)`);

    return new Response(data);
}

export default fetchAsset;
