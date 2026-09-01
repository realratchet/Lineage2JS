import type { WarriorAnimations_T, LocalizationProperty_T, UserConfig_T, LoadSettings_T } from "@l2js/engine/contracts/config";
import type { ICharacterArmorSelection, ICharacterGroup, INpcDefinition } from "@l2js/engine/contracts/pawn";

export type InitMessage_T = { type: "init"; };

export type DecodeMessage_T = {
    type: "decode";
    requestId: number;
    sectorName: string;
    settings: LoadSettings_T;
};

export type PrecacheMessage_T = { type: "precache"; requestId: number; sectorName: string; settings: LoadSettings_T; };
export type FreeMessage_T = { type: "free"; sectorName: string; };
export type DecodeEnvMessage_T = { type: "decodeEnv"; requestId: number; };

export type DecodeCharacterMessage_T = {
    type: "decodeCharacter";
    requestId: number;
    settings: LoadSettings_T;
    charIndex: number;
    faceVariant: number;
    hairVariant: number;
    hairColour: number;
    armor: ICharacterArmorSelection;
    includeAnimations: boolean;
};

export type DecodeSkeletalMeshMessage_T = {
    type: "decodeSkeletalMesh";
    requestId: number;
    settings: LoadSettings_T;
    packageName: string;
    meshName: string;
    scriptClassPath: string;
    texturePaths: string[];
    npcId: number | null;
    includeAnimations: boolean;
};

export type DecodeEffectTemplatesMessage_T = {
    type: "decodeEffectTemplates";
    requestId: number;
    settings: LoadSettings_T;
    classPaths: string[];
    soundPaths: string[];
    scriptClassPaths: string[];
};

export type CharGroupsMessage_T = { type: "charGroups"; requestId: number; };
export type ResolveNpcMessage_T = { type: "resolveNpc"; requestId: number; selector: string | number; };
export type ListNpcsMessage_T = { type: "listNpcs"; requestId: number; };
export type PrecacheCharactersMessage_T = { type: "precacheCharacters"; requestId: number; settings: LoadSettings_T; };
export type CharactersPrecachedMessage_T = { type: "charactersPrecached"; requestId: number; };
export type CharGroupsDecodedMessage_T = { type: "charGroupsDecoded"; requestId: number; groups: ICharacterGroup[]; };
export type NpcResolvedMessage_T = { type: "npcResolved"; requestId: number; npc: INpcDefinition; };
export type NpcsListedMessage_T = { type: "npcsListed"; requestId: number; npcs: INpcDefinition[]; };
export type MusicInfoMessage_T = { type: "musicInfo"; requestId: number; }
export type ClientConfigMessage_T = { type: "clientConfig"; requestId: number; }
export type ScriptLocalizationMessage_T = { type: "scriptLocalization"; requestId: number; scriptClassPath: string; }

export type MainToWorkerMessage_T =
    | InitMessage_T
    | DecodeMessage_T
    | PrecacheMessage_T
    | FreeMessage_T
    | DecodeEnvMessage_T
    | DecodeCharacterMessage_T
    | DecodeSkeletalMeshMessage_T
    | DecodeEffectTemplatesMessage_T
    | CharGroupsMessage_T
    | ResolveNpcMessage_T
    | ListNpcsMessage_T
    | PrecacheCharactersMessage_T
    | MusicInfoMessage_T
    | ClientConfigMessage_T
    | ScriptLocalizationMessage_T;

export type ReadyMessage_T = { type: "ready"; }
export type InitErrorMessage_T = { type: "initError"; message: string; }
export type DecodedMessage_T = { type: "decoded"; requestId: number; buffer: ArrayBuffer; }
export type PrecacheResult_T = { cached: boolean, bytes: number };
export type PrecachedMessage_T = { type: "precached"; requestId: number; result: PrecacheResult_T; };

export type DecodeErrorMessage_T = {
    type: "decodeError";
    requestId: number;
    message: string;
    stack?: string; // worker-side stack for the main thread console
};

export type EnvDecodedMessage_T = {
    type: "envDecoded";
    requestId: number;
    info: any; // plain env decode info (UConfigEnv.getDecodeInfo)
};

export type MusicInfoDecodedMessage_T = {
    type: "musicInfoDecoded";
    requestId: number;
    music: Record<number, string[]>; // music id -> package paths
};

export type ClientConfig_T = { userConfig: UserConfig_T; warriorAnimations: Record<string, WarriorAnimations_T>; };
export type ClientConfigDecodedMessage_T = { type: "clientConfigDecoded"; requestId: number; config: ClientConfig_T; };
export type ScriptLocalizationDecodedMessage_T = { type: "scriptLocalizationDecoded"; requestId: number; properties: LocalizationProperty_T[]; };

export type WorkerToMainMessage_T =
    | ReadyMessage_T
    | InitErrorMessage_T
    | DecodedMessage_T
    | PrecachedMessage_T
    | DecodeErrorMessage_T
    | EnvDecodedMessage_T
    | CharGroupsDecodedMessage_T
    | NpcResolvedMessage_T
    | NpcsListedMessage_T
    | CharactersPrecachedMessage_T
    | MusicInfoDecodedMessage_T
    | ClientConfigDecodedMessage_T
    | ScriptLocalizationDecodedMessage_T;
