// Message protocol between the main thread (DecodeWorkerClient) and decode.worker.ts.

interface InitMessage {
    type: "init";
}

interface DecodeMessage {
    type: "decode";
    requestId: number;
    sectorName: string;
    settings: GD.LoadSettings_T;
}

type PrecacheMessage_T = {
    type: "precache";
    requestId: number;
    sectorName: string;
    settings: GD.LoadSettings_T;
};

interface FreeMessage {
    type: "free";
    sectorName: string;
}

interface DecodeEnvMessage {
    type: "decodeEnv";
    requestId: number;
}

interface MusicInfoMessage {
    type: "musicInfo";
    requestId: number;
}

type MainToWorkerMessage = InitMessage | DecodeMessage | PrecacheMessage_T | FreeMessage | DecodeEnvMessage | MusicInfoMessage;

interface ReadyMessage {
    type: "ready";
}

interface InitErrorMessage {
    type: "initError";
    message: string;
}

interface DecodedMessage {
    type: "decoded";
    requestId: number;
    library: any; // structured-cloned DecodeLibrary (plain object, prototype restored by the client)
}

type PrecacheResult_T = { cached: boolean, bytes: number };

type PrecachedMessage_T = {
    type: "precached";
    requestId: number;
    result: PrecacheResult_T;
};

interface DecodeErrorMessage {
    type: "decodeError";
    requestId: number;
    message: string;
    stack?: string; // worker-side stack for the main thread console
}

interface EnvDecodedMessage {
    type: "envDecoded";
    requestId: number;
    info: any; // plain env decode info (UConfigEnv.getDecodeInfo)
}

interface MusicInfoDecodedMessage {
    type: "musicInfoDecoded";
    requestId: number;
    music: Record<number, string[]>; // music id -> package paths
}

type WorkerToMainMessage = ReadyMessage | InitErrorMessage | DecodedMessage | PrecachedMessage_T | DecodeErrorMessage | EnvDecodedMessage | MusicInfoDecodedMessage;

export type { MainToWorkerMessage, WorkerToMainMessage, InitMessage, DecodeMessage, PrecacheMessage_T, PrecacheResult_T, PrecachedMessage_T, FreeMessage, DecodeEnvMessage, MusicInfoMessage, ReadyMessage, InitErrorMessage, DecodedMessage, DecodeErrorMessage, EnvDecodedMessage, MusicInfoDecodedMessage };
