// Blob URLs are scoped to the thread owning the library, minted on first read so loading never pays for unplayed sounds.
export function refreshSoundBlobUris(library: any): void {
    const soundCache = library.soundBlobCache as Map<string, { uri: string, data: Uint8Array | Blob, mimeType: string }>;

    if (!soundCache) return;

    for (const entry of soundCache.values()) {
        if (!entry?.data) continue;

        if (entry.uri) URL.revokeObjectURL(entry.uri);

        let uri: string = null;

        Object.defineProperty(entry, "uri", { configurable: true, enumerable: true, get: () => uri ?? (uri = URL.createObjectURL(new Blob([entry.data as BlobPart], { type: entry.mimeType }))), set: (value: string) => { uri = value; } });
        Object.defineProperty(entry, "mintedUri", { configurable: true, get: () => uri });
    }
}

export function getMintedSoundUri(entry: any): string | null { return "mintedUri" in entry ? entry.mintedUri : entry.uri || null; }

export function revokeSoundUri(entry: any): void {
    const uri = getMintedSoundUri(entry);

    if (uri) URL.revokeObjectURL(uri);
}

