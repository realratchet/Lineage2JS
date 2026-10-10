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
export type DecodeSkillMessage_T = { type: "decodeSkill"; requestId: number; settings: LoadSettings_T; id: number; level: number; };
export type DecodeItemMessage_T = { type: "decodeItem"; requestId: number; settings: LoadSettings_T; id: number; };
export type MatineeAction_T = { action: string; duration: number; pathStyle: "linear" | "bezier"; startControlPoint: [number, number, number]; endControlPoint: [number, number, number]; constantPathVelocity: boolean; pathVelocity: number; location: [number, number, number]; rotation: [number, number, number]; };
export type MatineeScene_T = { tag: string; actions: MatineeAction_T[]; };
export type UITexture_T = { path: string; width: number; height: number; frames: ArrayBuffer[]; frameTime: number; };
export type ItemInfo_T = { templateClass: "weapon" | "armor" | "etc" | null; addName: string; description: string; popup: number; isRecipe: boolean; isArrowOrLure: boolean; crystallizable: boolean; canShowEnchant: boolean; equipSound: string; equipmentIcons: string[]; weight: number; crystalType: number; consumeType: number; etcType: number; weaponType: number; pAtk: number; mAtk: number; speed: number; soulshots: number; spiritshots: number; mpConsume: number; shieldPDef: number; shieldRate: number; avoidModify: number; armorType: number; bodyPart: number; pDef: number; mDef: number; mpBonus: number; };
export type SkillInfo_T = { name: string; description: string; icon: string; type: number; hpConsume: number; mpConsume: number; range: number; isDebuff: boolean; isEnchanted: boolean; enchantName: string; enchantDescription: string; enchantSkillLevel: number; };
export type QuestInfo_T = { tag: number; id: number; progressId: number; title: string; progressTitle: string; description: string; itemIds: number[]; itemCounts: number[]; minLevel: number; maxLevel: number; classification: number; entityName: string; questX: number; questY: number; questZ: number; unk0: number; unk1: number; unk2: number; unk3: number; entityX: number; entityY: number; entityZ: number; raceRestriction: string; shortDescription: string; };
export type RecipeInfo_T = { id: number; itemId: number; level: number; productId: number; count: number; mpCost: number; successRate: number; materials: [number, number][]; };
export type HennaInfo_T = { dyeItemId: number; name: string; icon: string; addName: string; description: string; };
export type GameStrings_T = { socialSounds: Record<number, { sound: string; volume: number; radius: number; }[]>; systemMessages: Record<number, string>; systemMessageColors: Record<number, number>; systemMessageSounds: Record<number, string>; sysStrings: Record<number, string>; serverNames: Record<number, string>; npcNames: Record<number, string>; npcTitles: Record<number, string>; npcTitleColors: Record<number, number>; obsceneWords: string[]; residences: Record<number, string>; quests: QuestInfo_T[]; recipes: RecipeInfo_T[]; hennas: Record<number, HennaInfo_T>; skillIcons: Record<number, string>; skillCastStyles: Record<string, number>; skillInfos: Record<string, SkillInfo_T>; actions: Record<number, { name: string, icon: string, type: number, category: number, allowedNpcIds: number[], command: string, macroCommand: string, requiresMount: boolean }>; logonSpots: [number, number, number, number][]; classNames: Record<number, string>; skillNames: Record<number, string>; skillCommands: Record<string, number>; commands: Record<number, string>; itemNames: Record<number, string>; itemIcons: Record<number, string>; itemInfos: Record<number, ItemInfo_T>; symbols: Record<string, string>; };
export type PlayerSkillInfo_T = { id: number; level: number; name: string; animationCategory: string; hitTime: number; castRange: number; previewTarget?: "self"; };

export type DecodeCharacterEquipmentMessage_T = { type: "decodeCharacterEquipment"; requestId: number; settings: LoadSettings_T; charIndex: number; hairVariant: number; equipment: L2JS.Engine.ICharacterEquipment; };

export type DecodeCharacterMessage_T = {
    type: "decodeCharacter";
    requestId: number;
    settings: LoadSettings_T;
    charIndex: number;
    faceVariant: number;
    hairVariant: number;
    hairColour: number;
    armor: ICharacterArmorSelection;
    equipment: L2JS.Engine.ICharacterEquipment | null;
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
    equipment: L2JS.Engine.INpcEquipment | null;
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
export type ListPlayerSkillsMessage_T = { type: "listPlayerSkills"; requestId: number; };
export type GameStringsMessage_T = { type: "gameStrings"; requestId: number; };
export type MatineeScenesMessage_T = { type: "matineeScenes"; requestId: number; levelName: string; };
export type DecodeUITexturesMessage_T = { type: "decodeUITextures"; requestId: number; settings: LoadSettings_T; paths: string[]; };
export type PrecacheCharactersMessage_T = { type: "precacheCharacters"; requestId: number; settings: LoadSettings_T; };
export type CharactersPrecachedMessage_T = { type: "charactersPrecached"; requestId: number; };
export type PrecacheNpcBundleMessage_T = { type: "precacheNpcBundle"; requestId: number; settings: LoadSettings_T; packageName: string; };
export type NpcBundlePrecachedMessage_T = { type: "npcBundlePrecached"; requestId: number; };
export type CharGroupsDecodedMessage_T = { type: "charGroupsDecoded"; requestId: number; groups: ICharacterGroup[]; };
export type NpcResolvedMessage_T = { type: "npcResolved"; requestId: number; npc: INpcDefinition; };
export type NpcsListedMessage_T = { type: "npcsListed"; requestId: number; npcs: INpcDefinition[]; };
export type PlayerSkillsListedMessage_T = { type: "playerSkillsListed"; requestId: number; skills: PlayerSkillInfo_T[]; };
export type GameStringsDecodedMessage_T = { type: "gameStringsDecoded"; requestId: number; strings: GameStrings_T; };
export type MatineeScenesDecodedMessage_T = { type: "matineeScenesDecoded"; requestId: number; scenes: MatineeScene_T[]; };
export type UITexturesDecodedMessage_T = { type: "uiTexturesDecoded"; requestId: number; textures: UITexture_T[]; };
export type MusicInfoMessage_T = { type: "musicInfo"; requestId: number; }
export type ClientConfigMessage_T = { type: "clientConfig"; requestId: number; }
export type ScriptLocalizationMessage_T = { type: "scriptLocalization"; requestId: number; scriptClassPath: string; }
export type L2TextMessage_T = { type: "l2Text"; requestId: number; name: string; }
export type MemoryStatsMessage_T = { type: "memoryStats"; requestId: number; }
export type WorkerMemoryStats_T = { buffers: number; packages: number; };

export type MainToWorkerMessage_T =
    | InitMessage_T
    | DecodeMessage_T
    | PrecacheMessage_T
    | FreeMessage_T
    | DecodeEnvMessage_T
    | DecodeSkillMessage_T
    | DecodeItemMessage_T
    | DecodeCharacterMessage_T
    | DecodeCharacterEquipmentMessage_T
    | DecodeSkeletalMeshMessage_T
    | DecodeEffectTemplatesMessage_T
    | CharGroupsMessage_T
    | ResolveNpcMessage_T
    | ListNpcsMessage_T
    | ListPlayerSkillsMessage_T
    | GameStringsMessage_T
    | MatineeScenesMessage_T
    | DecodeUITexturesMessage_T
    | PrecacheCharactersMessage_T
    | PrecacheNpcBundleMessage_T
    | MusicInfoMessage_T
    | ClientConfigMessage_T
    | ScriptLocalizationMessage_T
    | L2TextMessage_T
    | MemoryStatsMessage_T;

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
export type L2TextDecodedMessage_T = { type: "l2TextDecoded"; requestId: number; text: string; };
export type MemoryStatsDecodedMessage_T = { type: "memoryStatsDecoded"; requestId: number; stats: WorkerMemoryStats_T; };

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
    | PlayerSkillsListedMessage_T
    | GameStringsDecodedMessage_T
    | MatineeScenesDecodedMessage_T
    | UITexturesDecodedMessage_T
    | CharactersPrecachedMessage_T
    | NpcBundlePrecachedMessage_T
    | MusicInfoDecodedMessage_T
    | ClientConfigDecodedMessage_T
    | ScriptLocalizationDecodedMessage_T
    | L2TextDecodedMessage_T
    | MemoryStatsDecodedMessage_T;
