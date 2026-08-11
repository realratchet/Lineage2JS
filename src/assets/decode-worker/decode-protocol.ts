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

type DecodeCharacterMessage_T = {
    type: "decodeCharacter";
    requestId: number;
    settings: GD.LoadSettings_T;
    charIndex: number;
    faceVariant: number;
    hairVariant: number;
    hairColour: number;
    armor: GD.ICharacterArmorSelection;
    includeAnimations: boolean;
};

type DecodeSkeletalMeshMessage_T = {
    type: "decodeSkeletalMesh";
    requestId: number;
    settings: GD.LoadSettings_T;
    packageName: string;
    meshName: string;
    scriptClassPath: string;
    texturePaths: string[];
    npcId: number | null;
    includeAnimations: boolean;
};

type CharGroupsMessage_T = {
    type: "charGroups";
    requestId: number;
};

type ResolveNpcMessage_T = {
    type: "resolveNpc";
    requestId: number;
    selector: string | number;
};

type PrecacheCharactersMessage_T = {
    type: "precacheCharacters";
    requestId: number;
    settings: GD.LoadSettings_T;
};

type CharactersPrecachedMessage_T = {
    type: "charactersPrecached";
    requestId: number;
};

type CharGroupsDecodedMessage_T = {
    type: "charGroupsDecoded";
    requestId: number;
    groups: GD.ICharacterGroup[];
};

type NpcResolvedMessage_T = {
    type: "npcResolved";
    requestId: number;
    npc: GD.INpcDefinition;
};

interface MusicInfoMessage {
    type: "musicInfo";
    requestId: number;
}

type MainToWorkerMessage = InitMessage | DecodeMessage | PrecacheMessage_T | FreeMessage | DecodeEnvMessage | DecodeCharacterMessage_T | DecodeSkeletalMeshMessage_T | CharGroupsMessage_T | ResolveNpcMessage_T | PrecacheCharactersMessage_T | MusicInfoMessage;

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
    buffer: ArrayBuffer;
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

type WorkerToMainMessage = ReadyMessage | InitErrorMessage | DecodedMessage | PrecachedMessage_T | DecodeErrorMessage | EnvDecodedMessage | CharGroupsDecodedMessage_T | NpcResolvedMessage_T | CharactersPrecachedMessage_T | MusicInfoDecodedMessage;

export type { MainToWorkerMessage, WorkerToMainMessage, InitMessage, DecodeMessage, PrecacheMessage_T, PrecacheResult_T, PrecachedMessage_T, FreeMessage, DecodeEnvMessage, DecodeCharacterMessage_T, DecodeSkeletalMeshMessage_T, CharGroupsMessage_T, CharGroupsDecodedMessage_T, ResolveNpcMessage_T, NpcResolvedMessage_T, PrecacheCharactersMessage_T, CharactersPrecachedMessage_T, MusicInfoMessage, ReadyMessage, InitErrorMessage, DecodedMessage, DecodeErrorMessage, EnvDecodedMessage, MusicInfoDecodedMessage };
