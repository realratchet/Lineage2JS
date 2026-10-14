declare namespace L2JS.Engine {
    interface IPawnSoundSetDecodeInfo {
        sounds: (string | null)[];
        volume: number;
        radius: number;
    }

    interface IPawnSoundsDecodeInfo {
        attack?: IPawnSoundSetDecodeInfo;
        defense: IPawnSoundSetDecodeInfo;
        damage: IPawnSoundSetDecodeInfo & { random: number };
        item: IPawnSoundSetDecodeInfo | null;
        shield?: IPawnSoundSetDecodeInfo | null;
        critical?: { sound: string | null; volume: number; radius: number };
        soulshot?: { sound: string | null; volume: number; radius: number };
    }
}
