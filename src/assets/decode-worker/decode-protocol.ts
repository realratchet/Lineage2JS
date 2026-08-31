import type { WarriorAnimations_T } from "@l2js/engine/conf-files/un-conf-warrior";
import type { LocalizationProperty_T } from "@l2js/engine/conf-files/un-conf-localization";
import type { UserConfig_T } from "@l2js/engine/conf-files/un-conf-system";

type InitMessage_T = {
    type: "init";
}

type DecodeMessage_T = {
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

type FreeMessage_T = {
    type: "free";
    sectorName: string;
}

type DecodeEnvMessage_T = {
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

type DecodeEffectTemplatesMessage_T = {
    type: "decodeEffectTemplates";
    requestId: number;
    settings: GD.LoadSettings_T;
    classPaths: string[];
    soundPaths: string[];
    scriptClassPaths: string[];
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

type ListNpcsMessage_T = {
    type: "listNpcs";
    requestId: number;
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

type NpcsListedMessage_T = {
    type: "npcsListed";
    requestId: number;
    npcs: GD.INpcDefinition[];
};

type MusicInfoMessage_T = {
    type: "musicInfo";
    requestId: number;
}

type ClientConfigMessage_T = {
    type: "clientConfig";
    requestId: number;
}

type ScriptLocalizationMessage_T = {
    type: "scriptLocalization";
    requestId: number;
    scriptClassPath: string;
}

type MainToWorkerMessage_T = InitMessage_T | DecodeMessage_T | PrecacheMessage_T | FreeMessage_T | DecodeEnvMessage_T | DecodeCharacterMessage_T | DecodeSkeletalMeshMessage_T | DecodeEffectTemplatesMessage_T | CharGroupsMessage_T | ResolveNpcMessage_T | ListNpcsMessage_T | PrecacheCharactersMessage_T | MusicInfoMessage_T | ClientConfigMessage_T | ScriptLocalizationMessage_T;

type ReadyMessage_T = {
    type: "ready";
}

type InitErrorMessage_T = {
    type: "initError";
    message: string;
}

type DecodedMessage_T = {
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

type DecodeErrorMessage_T = {
    type: "decodeError";
    requestId: number;
    message: string;
    stack?: string; // worker-side stack for the main thread console
}

type EnvDecodedMessage_T = {
    type: "envDecoded";
    requestId: number;
    info: any; // plain env decode info (UConfigEnv.getDecodeInfo)
}

type MusicInfoDecodedMessage_T = {
    type: "musicInfoDecoded";
    requestId: number;
    music: Record<number, string[]>; // music id -> package paths
}

type ClientConfig_T = {
    userConfig: UserConfig_T;
    warriorAnimations: Record<string, WarriorAnimations_T>;
}

type ClientConfigDecodedMessage_T = {
    type: "clientConfigDecoded";
    requestId: number;
    config: ClientConfig_T;
}

type ScriptLocalizationDecodedMessage_T = {
    type: "scriptLocalizationDecoded";
    requestId: number;
    properties: LocalizationProperty_T[];
}

type WorkerToMainMessage_T = ReadyMessage_T | InitErrorMessage_T | DecodedMessage_T | PrecachedMessage_T | DecodeErrorMessage_T | EnvDecodedMessage_T | CharGroupsDecodedMessage_T | NpcResolvedMessage_T | NpcsListedMessage_T | CharactersPrecachedMessage_T | MusicInfoDecodedMessage_T | ClientConfigDecodedMessage_T | ScriptLocalizationDecodedMessage_T;

export type { MainToWorkerMessage_T, WorkerToMainMessage_T, InitMessage_T, DecodeMessage_T, PrecacheMessage_T, PrecacheResult_T, PrecachedMessage_T, FreeMessage_T, DecodeEnvMessage_T, DecodeCharacterMessage_T, DecodeSkeletalMeshMessage_T, DecodeEffectTemplatesMessage_T, CharGroupsMessage_T, CharGroupsDecodedMessage_T, ResolveNpcMessage_T, ListNpcsMessage_T, NpcResolvedMessage_T, NpcsListedMessage_T, PrecacheCharactersMessage_T, CharactersPrecachedMessage_T, MusicInfoMessage_T, ClientConfigMessage_T, ScriptLocalizationMessage_T, ReadyMessage_T, InitErrorMessage_T, DecodedMessage_T, DecodeErrorMessage_T, EnvDecodedMessage_T, MusicInfoDecodedMessage_T, ClientConfig_T, ClientConfigDecodedMessage_T, ScriptLocalizationDecodedMessage_T };
