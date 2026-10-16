import InstallShieldCabinet from "./install-shield-cabinet";

export type AssetFiles_T = [string, File][];

type AssetEntry_T = { path: string; read(): Promise<Blob | Uint8Array>; };

const SUPPORTED_EXTENSIONS = ["UNR", "UTX", "USX", "UAX", "U", "UKX", "USK", "U", "OGG"];

let assetFiles: AssetFiles_T = null;
let assetIndex: Map<string, AssetEntry_T> = null;

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

    for (const { path } of index.values()) {
        const ext = path.slice(path.lastIndexOf(".") + 1).toUpperCase();

        if (SUPPORTED_EXTENSIONS.includes(ext)) assetList.supported[path.toLowerCase()] = path;
        else assetList.unsupported.push(path);
    }

    return assetList;
}

export function getAssetFiles() { return assetFiles; }

export async function selectAssetFiles(files: AssetFiles_T): Promise<void> {
    assetIndex = await buildIndex(files);
    assetFiles = files;
}

export async function fetchAsset(path: string): Promise<Response> {
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
