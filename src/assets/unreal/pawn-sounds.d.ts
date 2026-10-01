declare namespace L2JS.Engine {
    interface IPawnSoundSetDecodeInfo {
        sounds: (string | null)[];
        volume: number;
        radius: number;
    }

    interface IPawnSoundsDecodeInfo {
        defense: IPawnSoundSetDecodeInfo;
        damage: IPawnSoundSetDecodeInfo & { random: number };
        item: IPawnSoundSetDecodeInfo | null;
        critical?: { sound: string | null; volume: number; radius: number };
    }
}
