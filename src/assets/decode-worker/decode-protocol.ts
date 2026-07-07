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
    type: "decode-env";
    requestId: number;
}

interface MusicInfoMessage {
    type: "music-info";
    requestId: number;
}

type MainToWorkerMessage = InitMessage | DecodeMessage | FreeMessage | DecodeEnvMessage | MusicInfoMessage;

interface ReadyMessage {
    type: "ready";
}

interface InitErrorMessage {
    type: "init-error";
    message: string;
}

interface DecodedMessage {
    type: "decoded";
    requestId: number;
    library: any; // structured-cloned DecodeLibrary (plain object, prototype restored by the client)
}

interface DecodeErrorMessage {
    type: "decode-error";
    requestId: number;
    message: string;
}

interface EnvDecodedMessage {
    type: "env-decoded";
    requestId: number;
    info: any; // plain env decode info (UConfigEnv.getDecodeInfo)
}

interface MusicInfoDecodedMessage {
    type: "music-info-decoded";
    requestId: number;
    music: Record<number, string[]>; // music id -> package paths
}

type WorkerToMainMessage = ReadyMessage | InitErrorMessage | DecodedMessage | DecodeErrorMessage | EnvDecodedMessage | MusicInfoDecodedMessage;

export type { MainToWorkerMessage, WorkerToMainMessage, InitMessage, DecodeMessage, FreeMessage, DecodeEnvMessage, MusicInfoMessage, ReadyMessage, InitErrorMessage, DecodedMessage, DecodeErrorMessage, EnvDecodedMessage, MusicInfoDecodedMessage };
