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

type MainToWorkerMessage = InitMessage | DecodeMessage;

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

type WorkerToMainMessage = ReadyMessage | InitErrorMessage | DecodedMessage | DecodeErrorMessage;

export type { MainToWorkerMessage, WorkerToMainMessage, InitMessage, DecodeMessage, ReadyMessage, InitErrorMessage, DecodedMessage, DecodeErrorMessage };
