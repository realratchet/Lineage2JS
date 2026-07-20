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

type MainToWorkerMessage = InitMessage | DecodeMessage | FreeMessage | DecodeEnvMessage | MusicInfoMessage;

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

type WorkerToMainMessage = ReadyMessage | InitErrorMessage | DecodedMessage | DecodeErrorMessage | EnvDecodedMessage | MusicInfoDecodedMessage;

export type { MainToWorkerMessage, WorkerToMainMessage, InitMessage, DecodeMessage, FreeMessage, DecodeEnvMessage, MusicInfoMessage, ReadyMessage, InitErrorMessage, DecodedMessage, DecodeErrorMessage, EnvDecodedMessage, MusicInfoDecodedMessage };
