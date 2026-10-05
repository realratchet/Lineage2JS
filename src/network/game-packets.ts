import type PacketReader from "./packet-reader";

export const PROTOCOL_REVISION = 660;
export const NPC_ID_OFFSET = 1000000;

export type SkillEntry_T = { id: number, level: number, isPassive: boolean };
export type AbnormalStatus_T = { id: number, level: number, duration: number };
export type QuestState_T = { id: number, condition: number };
export type HennaSymbol_T = { symbolId: number, itemId: number };
export type HennaStatus_T = { stats: number[], slots: number, symbols: HennaSymbol_T[] };
export type MacroCommand_T = { index: number, type: number, data1: number, data2: number, command: string };
export type Macro_T = { id: number, name: string, description: string, acronym: string, icon: number, commands: MacroCommand_T[] };
export type FriendEntry_T = { objectId: number, name: string, isOnline: boolean };
export type ShowBoardPart_T = { show: boolean, id: string, html: string };
export type PartyMember_T = { objectId: number, name: string, curCp: number, maxCp: number, curHp: number, maxHp: number, curMp: number, maxMp: number, level: number, classId: number };
export type PartyInvite_T = { name: string, itemDistribution: number };
export type PledgeInvite_T = { requestorId: number, pledgeName: string };
export type FriendInvite_T = { name: string };
export type ClanInfo_T = { leaderId: number, clanId: number, name: string, leaderName: string, crestId: number, level: number, hasCastle: number, hasHideout: number, memberLevel: number, dissolving: number, allyId: number, allyName: string, allyCrestId: number, isAtWar: boolean };
export type ClanMember_T = { name: string, level: number, classId: number, objectId: number, isOnline: boolean };
export type AquireSkillEntry_T = { id: number, nextLevel: number, maxLevel: number, spCost: number, requirements: number };
export type AquireSkillRequirement_T = { type: number, itemId: number, count: number, unknown: number };
export type AquireSkillInfo_T = { id: number, level: number, spCost: number, mode: number, requirements: AquireSkillRequirement_T[] };
export type TradeItem_T = { tradeType: number, type1: number, objectId: number, itemId: number, count: number, type2: number, bodyPart: number, enchantLevel: number, customType2: number };
export type ShopItem_T = { type1: number, objectId: number, itemId: number, count: number, type2: number, bodyPart: number, enchantLevel: number, customType2: number, price: number };
export type StorageMaxCount_T = { inventory: number, warehouse: number, freight: number, privateSell: number, privateBuy: number, recipeDwarf: number, recipe: number };

export enum AttackFlags_T {
    GRADE = 0x0f,
    SOULSHOT = 0x10,
    CRITICAL = 0x20,
    SHIELD = 0x40,
    MISS = 0x80
}

export enum GameServerPacket_T {
    KeyPacket = 0x00,
    CharMoveToLocation = 0x01,
    NpcSay = 0x02,
    CharInfo = 0x03,
    UserInfo = 0x04,
    Attack = 0x05,
    Die = 0x06,
    Revive = 0x07,
    SpawnItem = 0x0b,
    DropItem = 0x0c,
    GetItem = 0x0d,
    StatusUpdate = 0x0e,
    NpcHtmlMessage = 0x0f,
    SellList = 0x10,
    BuyList = 0x11,
    DeleteObject = 0x12,
    CharSelectInfo = 0x13,
    AuthLoginFail = 0x14,
    CharSelected = 0x15,
    NpcInfo = 0x16,
    CharTemplates = 0x17,
    CharCreateOk = 0x19,
    CharCreateFail = 0x1a,
    ItemList = 0x1b,
    SunRise = 0x1c,
    SunSet = 0x1d,
    TradeStart = 0x1e,
    TradeOwnAdd = 0x20,
    TradeOtherAdd = 0x21,
    SendTradeDone = 0x22,
    CharDeleteOk = 0x23,
    CharDeleteFail = 0x24,
    ActionFailed = 0x25,
    ServerClose = 0x26,
    InventoryUpdate = 0x27,
    TeleportToLocation = 0x28,
    TargetSelected = 0x29,
    TargetUnselected = 0x2a,
    AutoAttackStart = 0x2b,
    AutoAttackStop = 0x2c,
    SocialAction = 0x2d,
    ChangeMoveType = 0x2e,
    ChangeWaitType = 0x2f,
    ManagePledgePower = 0x30,
    AskJoinPledge = 0x32,
    JoinPledge = 0x33,
    AskJoinParty = 0x39,
    JoinParty = 0x3a,
    WareHouseDepositList = 0x41,
    WareHouseWithdrawalList = 0x42,
    ShortCutRegister = 0x44,
    ShortCutInit = 0x45,
    StopMove = 0x47,
    MagicSkillUse = 0x48,
    MagicSkillCanceld = 0x49,
    CreatureSay = 0x4a,
    EquipUpdate = 0x4b,
    DoorInfo = 0x4c,
    DoorStatusUpdate = 0x4d,
    PartySmallWindowAll = 0x4e,
    PartySmallWindowAdd = 0x4f,
    PartySmallWindowDeleteAll = 0x50,
    PartySmallWindowDelete = 0x51,
    PartySmallWindowUpdate = 0x52,
    PledgeShowMemberListAll = 0x53,
    PledgeShowMemberListUpdate = 0x54,
    PledgeShowMemberListAdd = 0x55,
    PledgeShowMemberListDelete = 0x56,
    SkillList = 0x58,
    VehicleInfo = 0x59,
    VehicleDeparture = 0x5a,
    OnVehicleCheckLocation = 0x5b,
    GetOnVehicle = 0x5c,
    GetOffVehicle = 0x5d,
    SendTradeRequest = 0x5e,
    RestartResponse = 0x5f,
    MoveToPawn = 0x60,
    ValidateLocation = 0x61,
    BeginRotation = 0x62,
    StopRotation = 0x63,
    SystemMessage = 0x64,
    StartPledgeWar = 0x65,
    StopPledgeWar = 0x67,
    SurrenderPledgeWar = 0x69,
    PledgeCrest = 0x6c,
    SetupGauge = 0x6d,
    ShowBoard = 0x6e,
    ChooseInventoryItem = 0x6f,
    MoveToLocationInVehicle = 0x71,
    StopMoveInVehicle = 0x72,
    ValidateLocationInVehicle = 0x73,
    TradeUpdate = 0x74,
    MagicSkillLaunched = 0x76,
    AskJoinFriend = 0x7d,
    LeaveWorld = 0x7e,
    MagicEffectIcons = 0x7f,
    QuestList = 0x80,
    EnchantResult = 0x81,
    PledgeShowMemberListDeleteAll = 0x82,
    PledgeInfo = 0x83,
    Ride = 0x86,
    PledgeShowInfoUpdate = 0x88,
    AquireSkillList = 0x8a,
    AquireSkillInfo = 0x8b,
    ServerObjectInfo = 0x8c,
    AquireSkillDone = 0x8e,
    GMViewCharacterInfo = 0x8f,
    GMViewPledgeInfo = 0x90,
    GMViewSkillInfo = 0x91,
    GMViewQuestList = 0x93,
    GMViewItemList = 0x94,
    GMViewWarehouseWithdrawList = 0x95,
    PartyMatchList = 0x96,
    PartyMatchDetail = 0x97,
    PlaySound = 0x98,
    StaticObject = 0x99,
    PrivateStoreManageListSell = 0x9a,
    PrivateStoreListSell = 0x9b,
    PrivateStoreMsgSell = 0x9c,
    ShowMiniMap = 0x9d,
    TutorialShowHtml = 0xa0,
    TutorialShowQuestionMark = 0xa1,
    TutorialEnableClientEvent = 0xa2,
    TutorialCloseHtml = 0xa3,
    MyTargetSelected = 0xa6,
    PartyMemberPosition = 0xa7,
    AskJoinAlly = 0xa8,
    AllyCrest = 0xae,
    PetStatusShow = 0xb0,
    PetInfo = 0xb1,
    PetItemList = 0xb2,
    PetInventoryUpdate = 0xb3,
    PetStatusUpdate = 0xb5,
    PetDelete = 0xb6,
    PrivateStoreManageListBuy = 0xb7,
    PrivateStoreListBuy = 0xb8,
    PrivateStoreMsgBuy = 0xb9,
    VehicleStarted = 0xba,
    SkillCoolTime = 0xc1,
    PackageToList = 0xc2,
    PackageSendableList = 0xc3,
    Earthquake = 0xc4,
    FlyToLocation = 0xc5,
    SpecialCamera = 0xc7,
    NormalCamera = 0xc8,
    SiegeInfo = 0xc9,
    SiegeAttackerList = 0xca,
    SiegeDefenderList = 0xcb,
    NicknameChanged = 0xcc,
    PledgeStatusChanged = 0xcd,
    RelationChanged = 0xce,
    MultiSellList = 0xd0,
    SetSummonRemainTime = 0xd1,
    Dice = 0xd4,
    Snoop = 0xd5,
    RecipeBookItemList = 0xd6,
    RecipeItemMakeInfo = 0xd7,
    RecipeShopManageList = 0xd8,
    RecipeShopSellList = 0xd9,
    RecipeShopItemInfo = 0xda,
    RecipeShopMsg = 0xdb,
    ShowCalculator = 0xdc,
    MonRaceInfo = 0xdd,
    ShowTownMap = 0xde,
    ObservationMode = 0xdf,
    ObservationReturn = 0xe0,
    ChairSit = 0xe1,
    HennaEquipList = 0xe2,
    HennaItemInfo = 0xe3,
    HennaInfo = 0xe4,
    SendMacroList = 0xe7,
    BuyListSeed = 0xe8,
    SellListProcure = 0xe9,
    GMViewHennaInfo = 0xea,
    RadarControl = 0xeb,
    ConfirmDlg = 0xed,
    PartySpelled = 0xee,
    ShopPreviewList = 0xef,
    ShopPreviewInfo = 0xf0,
    CameraMode = 0xf1,
    ShowXMasSeal = 0xf2,
    EtcStatusUpdate = 0xf3,
    ShortBuffStatusUpdate = 0xf4,
    SSQStatus = 0xf5,
    ClanHallDecoration = 0xf7,
    SignsSky = 0xf8,
    GameGuardQuery = 0xf9,
    FriendList = 0xfa,
    FriendRecvMsg = 0xfd,
    Extended = 0xfe
}

export enum GameServerExPacket_T {
    ExEventMatchMessage = 0x04,
    ExPartyRoomMember = 0x0e,
    ExClosePartyRoom = 0x0f,
    ExManagePartyRoomMember = 0x10,
    ExAutoSoulShot = 0x12,
    ExFishingStart = 0x13,
    ExFishingEnd = 0x14,
    ExFishingStartCombat = 0x15,
    ExFishingHpRegen = 0x16,
    ExEnchantSkillList = 0x17,
    ExEnchantSkillInfo = 0x18,
    ExQuestInfo = 0x19,
    ExShowQuestMark = 0x1a,
    ExSendManorList = 0x1b,
    ExShowSeedInfo = 0x1c,
    ExShowCropInfo = 0x1d,
    ExShowManorDefaultInfo = 0x1e,
    ExShowSeedSetting = 0x1f,
    ExShowCropSetting = 0x20,
    ExShowSellCropList = 0x21,
    ExShowProcureCropDetail = 0x22,
    ExHeroList = 0x23,
    ExOpenMPCC = 0x25,
    ExCloseMPCC = 0x26,
    ExAskJoinMPCC = 0x27,
    ExPledgeCrestLarge = 0x28,
    ExOlympiadUserInfo = 0x29,
    ExOlympiadSpelledInfo = 0x2a,
    ExOlympiadMode = 0x2b,
    ExOlympiadMatchEnd = 0x2c,
    ExMailArrived = 0x2d,
    ExStorageMaxCount = 0x2e,
    ExMultiPartyCommandChannelInfo = 0x30
}
export enum GameClientExPacket_T {
    RequestOustFromPartyRoom = 0x01,
    RequestDismissPartyRoom = 0x02,
    RequestWithdrawPartyRoom = 0x03,
    RequestChangePartyLeader = 0x04,
    RequestAutoSoulShot = 0x05,
    RequestExEnchantSkillInfo = 0x06,
    RequestExEnchantSkill = 0x07,
    RequestManorList = 0x08,
    RequestProcureCropList = 0x09,
    RequestSetSeed = 0x0a,
    RequestSetCrop = 0x0b,
    RequestWriteHeroWords = 0x0c,
    RequestExAskJoinMPCC = 0x0d,
    RequestExAcceptJoinMPCC = 0x0e,
    RequestExOustFromMPCC = 0x0f,
    RequestExPledgeCrestLarge = 0x10,
    RequestExSetPledgeCrestLarge = 0x11,
    RequestOlympiadObserverEnd = 0x12,
    RequestOlympiadMatchList = 0x13
}

export enum GameClientPacket_T {
    ProtocolVersion = 0x00,
    MoveBackwardToLocation = 0x01,
    EnterWorld = 0x03,
    Action = 0x04,
    AuthLogin = 0x08,
    Logout = 0x09,
    AttackRequest = 0x0a,
    CharacterCreate = 0x0b,
    CharacterDelete = 0x0c,
    CharacterSelected = 0x0d,
    NewCharacter = 0x0e,
    RequestItemList = 0x0f,
    RequestUnEquipItem = 0x11,
    RequestDropItem = 0x12,
    UseItem = 0x14,
    TradeRequest = 0x15,
    AddTradeItem = 0x16,
    TradeDone = 0x17,
    RequestSocialAction = 0x1b,
    ChangeMoveType2 = 0x1c,
    ChangeWaitType2 = 0x1d,
    RequestSellItem = 0x1e,
    RequestBuyItem = 0x1f,
    RequestLinkHtml = 0x20,
    RequestBypassToServer = 0x21,
    RequestBBSwrite = 0x22,
    RequestJoinPledge = 0x24,
    RequestAnswerJoinPledge = 0x25,
    RequestWithdrawalPledge = 0x26,
    RequestOustPledgeMember = 0x27,
    RequestJoinParty = 0x29,
    RequestAnswerJoinParty = 0x2a,
    RequestWithDrawalParty = 0x2b,
    RequestOustPartyMember = 0x2c,
    RequestMagicSkillUse = 0x2f,
    Appearing = 0x30,
    SendWareHouseDepositList = 0x31,
    SendWareHouseWithDrawList = 0x32,
    RequestShortCutReg = 0x33,
    RequestShortCutDel = 0x35,
    CannotMoveAnymore = 0x36,
    RequestTargetCanceld = 0x37,
    Say2 = 0x38,
    RequestPledgeMemberList = 0x3c,
    RequestSkillList = 0x3f,
    RequestGetOnVehicle = 0x42,
    RequestGetOffVehicle = 0x43,
    AnswerTradeRequest = 0x44,
    RequestActionUse = 0x45,
    RequestRestart = 0x46,
    ValidatePosition = 0x48,
    StartRotating = 0x4a,
    FinishRotating = 0x4b,
    RequestStartPledgeWar = 0x4d,
    RequestReplyStartPledgeWar = 0x4e,
    RequestStopPledgeWar = 0x4f,
    RequestReplyStopPledgeWar = 0x50,
    RequestSurrenderPledgeWar = 0x51,
    RequestReplySurrenderPledgeWar = 0x52,
    RequestSetPledgeCrest = 0x53,
    RequestGiveNickName = 0x55,
    RequestShowBoard = 0x57,
    RequestEnchantItem = 0x58,
    RequestDestroyItem = 0x59,
    SendBypassBuildCmd = 0x5b,
    RequestMoveToLocationInVehicle = 0x5c,
    CannotMoveAnymoreInVehicle = 0x5d,
    RequestFriendInvite = 0x5e,
    RequestAnswerFriendInvite = 0x5f,
    RequestFriendList = 0x60,
    RequestFriendDel = 0x61,
    CharacterRestore = 0x62,
    RequestQuestList = 0x63,
    RequestQuestAbort = 0x64,
    RequestPledgeInfo = 0x66,
    RequestPledgeCrest = 0x68,
    RequestSurrenderPersonally = 0x69,
    RequestAquireSkillInfo = 0x6b,
    RequestAquireSkill = 0x6c,
    RequestRestartPoint = 0x6d,
    RequestGMCommand = 0x6e,
    RequestPartyMatchConfig = 0x6f,
    RequestPartyMatchList = 0x70,
    RequestPartyMatchDetail = 0x71,
    RequestCrystallizeItem = 0x72,
    RequestPrivateStoreManageSell = 0x73,
    SetPrivateStoreListSell = 0x74,
    RequestPrivateStoreQuitSell = 0x76,
    SetPrivateStoreMsgSell = 0x77,
    RequestPrivateStoreBuy = 0x79,
    RequestTutorialLinkHtml = 0x7b,
    RequestTutorialPassCmdToServer = 0x7c,
    RequestTutorialQuestionMark = 0x7d,
    RequestTutorialClientEvent = 0x7e,
    RequestPetition = 0x7f,
    RequestPetitionCancel = 0x80,
    RequestGmList = 0x81,
    RequestJoinAlly = 0x82,
    RequestAnswerJoinAlly = 0x83,
    AllyLeave = 0x84,
    AllyDismiss = 0x85,
    RequestDismissAlly = 0x86,
    RequestSetAllyCrest = 0x87,
    RequestAllyCrest = 0x88,
    RequestChangePetName = 0x89,
    RequestPetUseItem = 0x8a,
    RequestGiveItemToPet = 0x8b,
    RequestGetItemFromPet = 0x8c,
    RequestAllyInfo = 0x8e,
    RequestPetGetItem = 0x8f,
    RequestPrivateStoreManageBuy = 0x90,
    SetPrivateStoreListBuy = 0x91,
    RequestPrivateStoreQuitBuy = 0x93,
    SetPrivateStoreMsgBuy = 0x94,
    RequestPrivateStoreSell = 0x96,
    RequestSkillCoolTime = 0x9d,
    RequestPackageSendableItemList = 0x9e,
    RequestPackageSend = 0x9f,
    RequestBlock = 0xa0,
    RequestSiegeAttackerList = 0xa2,
    RequestSiegeDefenderList = 0xa3,
    RequestJoinSiege = 0xa4,
    RequestConfirmSiegeWaitingList = 0xa5,
    MultiSellChoose = 0xa7,
    RequestUserCommand = 0xaa,
    SnoopQuit = 0xab,
    RequestRecipeBookOpen = 0xac,
    RequestRecipeBookDestroy = 0xad,
    RequestRecipeItemMakeInfo = 0xae,
    RequestRecipeItemMakeSelf = 0xaf,
    RequestRecipeShopMessageSet = 0xb1,
    RequestRecipeShopListSet = 0xb2,
    RequestRecipeShopManageQuit = 0xb3,
    RequestRecipeShopMakeInfo = 0xb5,
    RequestRecipeShopMakeItem = 0xb6,
    RequestRecipeShopManagePrev = 0xb7,
    ObserverReturn = 0xb8,
    RequestEvaluate = 0xb9,
    RequestHennaList = 0xba,
    RequestHennaItemInfo = 0xbb,
    RequestHennaEquip = 0xbc,
    RequestPledgePower = 0xc0,
    RequestMakeMacro = 0xc1,
    RequestDeleteMacro = 0xc2,
    RequestBuyProcure = 0xc3,
    RequestBuySeed = 0xc4,
    DlgAnswer = 0xc5,
    RequestPreviewItem = 0xc6,
    RequestSSQStatus = 0xc7,
    GameGuardReply = 0xca,
    RequestSendFriendMsg = 0xcc,
    RequestShowMiniMap = 0xcd,
    RequestRecordInfo = 0xcf,
    Extended = 0xd0
}

export enum Paperdoll_T { // Inventory.PAPERDOLL_* in the order every C4 paperdoll block is written.
    PAPERDOLL_UNDER,
    PAPERDOLL_REAR,
    PAPERDOLL_LEAR,
    PAPERDOLL_NECK,
    PAPERDOLL_RFINGER,
    PAPERDOLL_LFINGER,
    PAPERDOLL_HEAD,
    PAPERDOLL_RHAND,
    PAPERDOLL_LHAND,
    PAPERDOLL_GLOVES,
    PAPERDOLL_CHEST,
    PAPERDOLL_LEGS,
    PAPERDOLL_FEET,
    PAPERDOLL_BACK,
    PAPERDOLL_LRHAND,
    PAPERDOLL_HAIR
}

export enum ShortCutType_T { TYPE_ITEM = 1, TYPE_SKILL = 2, TYPE_ACTION = 3, TYPE_MACRO = 4, TYPE_RECIPE = 5 } // L2ShortCut.TYPE_*
export enum GaugeColor_T { BLUE, RED, CYAN, GREEN } // SetupGauge.java.
export enum ItemType2_T { TYPE2_WEAPON, TYPE2_SHIELD_ARMOR, TYPE2_ACCESSORY, TYPE2_QUEST, TYPE2_MONEY, TYPE2_OTHER } // L2Item.java.

export type ShortCut_T = { type: ShortCutType_T, slot: number, id: number, level: number };

export function readShortCut(packet: PacketReader): ShortCut_T { // ShortCutInit/ShortCutRegister: d type, d slot+page*12, d id, [d level for skills], d 1.
    const type = packet.d() as ShortCutType_T, slot = packet.d(), id = packet.d();
    const level = type === ShortCutType_T.TYPE_SKILL ? packet.d() : -1;

    packet.d();

    return { type, slot, id, level };
}

export function readShowBoard(packet: PacketReader): ShowBoardPart_T {
    const show = packet.c();
    if (show !== 0 && show !== 1) throw new Error(`Invalid ShowBoard visibility '${show}'.`);

    for (let i = 0; i < 8; i++) packet.S();

    let id = "";
    for (;;) {
        const code = packet.h();
        if (code === 0) return { show: show !== 0, id, html: "" };
        if (code === 8) break;
        id += String.fromCharCode(code);
    }

    if (id === "1002") {
        packet.b(packet.getRemaining());
        return { show: show !== 0, id, html: "" };
    }

    let html = "";
    for (;;) {
        const code = packet.h();
        if (code === 0) break;
        html += String.fromCharCode(code);
    }

    if (packet.getRemaining() !== 2 || packet.h() !== 0) throw new Error("Invalid ShowBoard trailing data."); // ShowBoard.java sizes its buffer for three terminators but writes two.

    return { show: show !== 0, id, html };
}

export enum Race_T { HUMAN, ELF, DARK_ELF, ORC, DWARF }

export enum Say2_T {
    ALL = 0,
    SHOUT = 1,
    TELL = 2,
    PARTY = 3,
    CLAN = 4,
    GM = 5,
    PETITION_PLAYER = 6,
    PETITION_GM = 7,
    TRADE = 8,
    ALLIANCE = 9,
    ANNOUNCEMENT = 10,
    PARTYROOM_ALL = 14,
    PARTYROOM_COMMANDER = 15,
    CHANNEL_ALL = 16,
    HERO_VOICE = 17,
    CRITICAL_ANNOUNCE = 18
}

export enum StatusUpdate_T {
    LEVEL = 0x01,
    EXP = 0x02,
    STR = 0x03,
    DEX = 0x04,
    CON = 0x05,
    INT = 0x06,
    WIT = 0x07,
    MEN = 0x08,
    CUR_HP = 0x09,
    MAX_HP = 0x0a,
    CUR_MP = 0x0b,
    MAX_MP = 0x0c,
    SP = 0x0d,
    CUR_LOAD = 0x0e,
    MAX_LOAD = 0x0f,
    P_ATK = 0x11,
    ATK_SPD = 0x12,
    P_DEF = 0x13,
    EVASION = 0x14,
    ACCURACY = 0x15,
    CRITICAL = 0x16,
    M_ATK = 0x17,
    CAST_SPD = 0x18,
    M_DEF = 0x19,
    PVP_FLAG = 0x1a,
    KARMA = 0x1b,
    CUR_CP = 0x21,
    MAX_CP = 0x22
}

export enum SystemMessageParam_T { TYPE_TEXT, TYPE_NUMBER, TYPE_NPC_NAME, TYPE_ITEM_NAME, TYPE_SKILL_NAME } // SystemMessage.TYPE_*
export enum WaitType_T { WT_SITTING, WT_STANDING, WT_START_FAKEDEATH, WT_STOP_FAKEDEATH }
export enum PlaySoundType_T { SOUND, MUSIC, VOICE }

export const HITFLAG_USESS = 0x10;
export const HITFLAG_CRIT = 0x20;
export const HITFLAG_SHLD = 0x40;
export const HITFLAG_MISS = 0x80;

export type Location_T = { x: number, y: number, z: number };

export type InventoryItem_T = { type1: number, objectId: number, itemId: number, count: number, type2: number, customType1: number, isEquipped: boolean, bodyPart: number, enchantLevel: number, customType2: number };

export function readInventoryItem(packet: PacketReader): InventoryItem_T {
    return { type1: packet.h(), objectId: packet.d(), itemId: packet.d(), count: packet.d(), type2: packet.h(), customType1: packet.h(), isEquipped: packet.h() !== 0, bodyPart: packet.d(), enchantLevel: packet.h(), customType2: packet.h() };
}

export type Speeds_T = { runSpd: number, walkSpd: number, swimRunSpd: number, swimWalkSpd: number, moveMultiplier: number, attackSpeedMultiplier: number, collisionRadius: number, collisionHeight: number };

export type Appearance_T = { race: Race_T, sex: number, classId: number, hairStyle: number, hairColor: number, face: number, paperdoll: number[], enchantLevel: number };

export type CharSelectEntry_T = Appearance_T & {
    slot: number;
    name: string;
    charId: number;
    clanId: number;
    curHp: number;
    curMp: number;
    maxHp: number;
    maxMp: number;
    sp: number;
    exp: number;
    level: number;
    karma: number;
    deleteSeconds: number;
    activeClassId: number;
    isLastUsed: boolean;
};

export type CharSelected_T = Location_T & { name: string, charId: number, title: string, sex: number, race: Race_T, classId: number, curHp: number, curMp: number, level: number, gameTime: number };

export type CreatureInfo_T = Location_T & Speeds_T & { objectId: number, heading: number, name: string, title: string, isRunning: boolean, isInCombat: boolean, isAlikeDead: boolean, karma: number, pvpFlag: number, recommendations: number, nameColor: number };

export type UserInfo_T = CreatureInfo_T & Appearance_T & { level: number, exp: number, str: number, dex: number, con: number, int: number, wit: number, men: number, sp: number, curLoad: number, maxLoad: number, pAtk: number, atkSpd: number, pDef: number, evasion: number, accuracy: number, critical: number, mAtk: number, castSpd: number, mDef: number, maxHp: number, curHp: number, maxMp: number, curMp: number, maxCp: number, curCp: number, clanId: number, pkKills: number, pvpKills: number, recommendationsLeft: number, isNoble: boolean, isHero: boolean, isGM: boolean, paperdollObjects: number[], cubics: number[] };

export type CharInfo_T = CreatureInfo_T & Appearance_T & { isSitting: boolean, mountType: number, cubics: number[] };

export type NpcInfo_T = CreatureInfo_T & { npcId: number, isAttackable: boolean, rightHand: number, chest: number, leftHand: number, spawnType: number, isSummon: boolean };
export type ServerObjectInfo_T = NpcInfo_T & { curHp: number, maxHp: number };

export type CharTemplate_T = { race: Race_T, classId: number, STR: number, DEX: number, CON: number, INT: number, WIT: number, MEN: number };

function readPaperdollItems(packet: PacketReader): number[] {
    const items: number[] = [];

    for (let i = 0; i < 16; i++) items.push(packet.d());

    return items;
}

function readCubics(packet: PacketReader): number[] {
    const count = packet.h();

    if (count > 8 || count > packet.getRemaining() / 2) throw new Error(`Invalid cubic count '${count}'.`);

    return Array.from({ length: count }, () => packet.h());
}

function readSpeeds(packet: PacketReader, target: Speeds_T) {
    target.runSpd = packet.d();
    target.walkSpd = packet.d();
    target.swimRunSpd = packet.d();
    target.swimWalkSpd = packet.d();
    packet.skip(16);
    target.moveMultiplier = packet.f();
    target.attackSpeedMultiplier = packet.f();
    target.collisionRadius = packet.f();
    target.collisionHeight = packet.f();
}

export function readCharSelectInfo(packet: PacketReader): CharSelectEntry_T[] {
    const count = packet.d();
    const entries: CharSelectEntry_T[] = [];

    for (let slot = 0; slot < count; slot++) {
        const name = packet.S(), charId = packet.d();

        packet.S();
        packet.d();

        const clanId = packet.d();

        packet.d();

        const sex = packet.d(), race = packet.d() as Race_T, classId = packet.d();

        packet.skip(16);

        const curHp = packet.f(), curMp = packet.f(), sp = packet.d(), exp = packet.d(), level = packet.d(), karma = packet.d();

        packet.skip(9 * 4 + 16 * 4);

        const paperdoll = readPaperdollItems(packet);
        const hairStyle = packet.d(), hairColor = packet.d(), face = packet.d();
        const maxHp = packet.f(), maxMp = packet.f();
        const deleteSeconds = packet.d(), activeClassId = packet.d(), isLastUsed = packet.d() === 1;

        const enchantLevel = packet.c();

        entries.push({ slot, name, charId, clanId, sex, race, classId, curHp, curMp, maxHp, maxMp, sp, exp, level, karma, paperdoll, hairStyle, hairColor, face, deleteSeconds, activeClassId, isLastUsed, enchantLevel });
    }

    return entries;
}

export function readCharSelected(packet: PacketReader): CharSelected_T {
    const name = packet.S(), charId = packet.d(), title = packet.S();

    packet.skip(12);

    const sex = packet.d(), race = packet.d() as Race_T, classId = packet.d();

    packet.d();

    const x = packet.d(), y = packet.d(), z = packet.d();
    const curHp = packet.f(), curMp = packet.f();

    packet.skip(8);

    const level = packet.d();

    packet.skip(4 + 4 + 6 * 4 + 32 * 4);

    const gameTime = packet.d();

    return { name, charId, title, sex, race, classId, x, y, z, curHp, curMp, level, gameTime };
}

export function readUserInfo(packet: PacketReader): UserInfo_T {
    const info = { x: packet.d(), y: packet.d(), z: packet.d(), heading: packet.d() & 0xffff, objectId: packet.d(), name: packet.S(), race: packet.d() as Race_T, sex: packet.d(), classId: packet.d(), level: packet.d(), exp: packet.d() } as UserInfo_T;

    info.str = packet.d();
    info.dex = packet.d();
    info.con = packet.d();
    info.int = packet.d();
    info.wit = packet.d();
    info.men = packet.d();

    info.maxHp = packet.d();
    info.curHp = packet.d();
    info.maxMp = packet.d();
    info.curMp = packet.d();

    info.sp = packet.d();
    info.curLoad = packet.d();
    info.maxLoad = packet.d();
    packet.d();

    info.paperdollObjects = readPaperdollItems(packet);
    info.paperdoll = readPaperdollItems(packet);

    info.pAtk = packet.d();
    info.atkSpd = packet.d();
    info.pDef = packet.d();
    info.evasion = packet.d();
    info.accuracy = packet.d();
    info.critical = packet.d();
    info.mAtk = packet.d();
    info.castSpd = packet.d();
    packet.d();
    info.mDef = packet.d();

    info.pvpFlag = packet.d();
    info.karma = packet.d();

    readSpeeds(packet, info);

    info.hairStyle = packet.d();
    info.hairColor = packet.d();
    info.face = packet.d();
    info.isGM = packet.d() !== 0;
    info.title = packet.S();

    info.clanId = packet.d();
    packet.skip(4 * 4 + 3);
    info.pkKills = packet.d();
    info.pvpKills = packet.d();
    info.cubics = readCubics(packet);
    packet.skip(1 + 4 + 1 + 4 + 7 * 4);

    info.recommendationsLeft = packet.h();
    info.recommendations = packet.h();

    packet.skip(4 + 2);
    info.classId = packet.d();
    packet.d();

    info.maxCp = packet.d();
    info.curCp = packet.d();
    info.isRunning = info.isInCombat = info.isAlikeDead = false;
    info.enchantLevel = packet.c();
    packet.skip(1 + 4);
    info.isNoble = packet.c() !== 0;
    info.isHero = packet.c() !== 0;
    packet.skip(1 + 3 * 4);
    info.nameColor = packet.d() >>> 0;

    return info;
}

export function readCharInfo(packet: PacketReader): CharInfo_T {
    const info = { x: packet.d(), y: packet.d(), z: packet.d(), heading: packet.d() & 0xffff, objectId: packet.d(), name: packet.S(), race: packet.d() as Race_T, sex: packet.d(), classId: packet.d() } as CharInfo_T;

    packet.d();

    const paperdoll = new Array(16).fill(0);

    for (const slot of [Paperdoll_T.PAPERDOLL_HEAD, Paperdoll_T.PAPERDOLL_RHAND, Paperdoll_T.PAPERDOLL_LHAND, Paperdoll_T.PAPERDOLL_GLOVES, Paperdoll_T.PAPERDOLL_CHEST, Paperdoll_T.PAPERDOLL_LEGS, Paperdoll_T.PAPERDOLL_FEET, Paperdoll_T.PAPERDOLL_BACK, Paperdoll_T.PAPERDOLL_LRHAND, Paperdoll_T.PAPERDOLL_HAIR])
        paperdoll[slot] = packet.d();

    info.paperdoll = paperdoll;
    info.pvpFlag = packet.d();
    info.karma = packet.d();

    packet.skip(4 * 4);
    readSpeeds(packet, info);

    info.hairStyle = packet.d();
    info.hairColor = packet.d();
    info.face = packet.d();
    info.title = packet.S();

    packet.skip(5 * 4);

    info.isSitting = packet.c() === 0;
    info.isRunning = packet.c() !== 0;
    info.isInCombat = packet.c() !== 0;
    info.isAlikeDead = packet.c() !== 0;

    packet.c();

    info.mountType = packet.c();

    packet.c();
    info.cubics = readCubics(packet);
    packet.skip(1 + 4 + 1);

    info.recommendations = packet.h();

    packet.skip(4 + 4 + 4);
    info.enchantLevel = packet.c();
    packet.skip(1 + 4 + 1 + 1 + 1 + 3 * 4);

    info.nameColor = packet.d() >>> 0;

    return info;
}

export function readNpcInfo(packet: PacketReader): NpcInfo_T {
    const info = { objectId: packet.d(), npcId: packet.d() - NPC_ID_OFFSET, isAttackable: packet.d() !== 0, x: packet.d(), y: packet.d(), z: packet.d(), heading: packet.d() & 0xffff } as NpcInfo_T;

    packet.skip(3 * 4);
    readSpeeds(packet, info);

    info.rightHand = packet.d();
    info.chest = packet.d();
    info.leftHand = packet.d();

    packet.c();

    info.isRunning = packet.c() !== 0;
    info.isInCombat = packet.c() !== 0;
    info.isAlikeDead = packet.c() !== 0;
    info.spawnType = packet.c();
    info.name = packet.S();
    info.title = packet.S();
    info.isSummon = packet.d() !== 0;
    info.pvpFlag = packet.d();
    info.karma = packet.d();
    info.recommendations = 0;
    info.nameColor = 0xffffffff;

    return info;
}

export function readServerObjectInfo(packet: PacketReader): ServerObjectInfo_T {
    const objectId = packet.d(), npcId = packet.d() - NPC_ID_OFFSET, name = packet.S(), isAttackable = packet.d() !== 0;
    const x = packet.d(), y = packet.d(), z = packet.d(), heading = packet.d() & 0xffff;
    const moveMultiplier = packet.f(), attackSpeedMultiplier = packet.f(), collisionRadius = packet.f(), collisionHeight = packet.f();
    const curHp = packet.d(), maxHp = packet.d();

    packet.d();
    packet.d();

    if (objectId <= 0 || npcId <= 0 || !Number.isFinite(moveMultiplier) || moveMultiplier <= 0 || !Number.isFinite(attackSpeedMultiplier) || attackSpeedMultiplier <= 0 || !Number.isFinite(collisionRadius) || collisionRadius <= 0 || !Number.isFinite(collisionHeight) || collisionHeight <= 0 || curHp < 0 || maxHp < 0 || curHp > maxHp || packet.getRemaining())
        throw new Error("Invalid ServerObjectInfo payload.");

    return { objectId, npcId, isAttackable, x, y, z, heading, name, title: "", isRunning: true, isInCombat: false, isAlikeDead: false, karma: 0, pvpFlag: 0, recommendations: 0, nameColor: 0xffffffff, runSpd: 0, walkSpd: 0, swimRunSpd: 0, swimWalkSpd: 0, moveMultiplier, attackSpeedMultiplier, collisionRadius, collisionHeight, rightHand: 0, chest: 0, leftHand: 0, spawnType: 0, isSummon: false, curHp, maxHp };
}

export function readPetInfo(packet: PacketReader) {
    packet.d();

    const info = readNpcInfo(packet);

    packet.skip(2 * 4);

    const curHp = packet.d(), maxHp = packet.d(), curMp = packet.d(), maxMp = packet.d();

    packet.skip(18 * 4 + 2 + 1 + 2 + 1 + 2 * 4);

    return { ...info, curHp, maxHp, curMp, maxMp };
}

export function readCharTemplates(packet: PacketReader): CharTemplate_T[] {
    const count = packet.d();
    const templates: CharTemplate_T[] = [];

    for (let i = 0; i < count; i++) {
        const race = packet.d() as Race_T, classId = packet.d();
        const stats: number[] = [];

        for (let j = 0; j < 6; j++) {
            packet.d();
            stats.push(packet.d());
            packet.d();
        }

        if (templates.some(template => template.classId === classId)) continue;

        templates.push({ race, classId, STR: stats[0], DEX: stats[1], CON: stats[2], INT: stats[3], WIT: stats[4], MEN: stats[5] });
    }

    return templates;
}

export enum PartyRoomMemberChange_T { ADD, MODIFY, REMOVE }

export enum EventMatchMessage_T { STRING, STATIC_FINISH, STATIC_START, STATIC_GAME_OVER, STATIC_1, STATIC_2, STATIC_3, STATIC_4, STATIC_5 }

export enum BlockType_T { BLOCK, UNBLOCK, BLOCKLIST, ALLBLOCK, ALLUNBLOCK }

export enum PartySpelledType_T { PLAYER, PET, SUMMON }

export enum MountType_T { NONE, STRIDER, WYVERN }

export enum FlyType_T { THROW_UP, THROW_HORIZONTAL, DUMMY, CHARGE }

export enum WarehouseType_T { Private = 1, Clan = 2, Castle = 3, Freight = 4 }

export type AllyInvite_T = { requestorId: number, requestorName: string, allyName: string };
export type PledgeWar_T = { pledgeName: string, charName: string };
export type Crest_T = { crestId: number, data: Uint8Array };
export type PledgeCrestLarge_T = { clanId: number, crestId: number, data: Uint8Array };

export function readPledgeWar(packet: PacketReader, isCharFirst: boolean): PledgeWar_T { // StartPledgeWar writes S char, S pledge; Stop/SurrenderPledgeWar write S pledge, S char.
    const first = packet.S(), second = packet.S();

    if (!first || !second || packet.getRemaining()) throw new Error(`Invalid pledge war payload ('${first}', '${second}').`);

    return isCharFirst ? { pledgeName: second, charName: first } : { pledgeName: first, charName: second };
}

export function readCrest(packet: PacketReader): Crest_T { // PledgeCrest/AllyCrest: d crestId, d size, b data.
    const crestId = packet.d(), size = packet.d();

    if (crestId <= 0 || size < 0 || size !== packet.getRemaining()) throw new Error(`Invalid crest payload (crest ${crestId}, size ${size}).`);

    return { crestId, data: packet.b(size) };
}

export function readPledgeCrestLarge(packet: PacketReader): PledgeCrestLarge_T { // d size 0 when the server has no data for crestId.
    const clanId = packet.d(), crestId = packet.d(), size = packet.d();

    if (clanId <= 0 || crestId < 0 || size < 0 || size !== packet.getRemaining()) throw new Error(`Invalid ExPledgeCrestLarge payload (clan ${clanId}, crest ${crestId}, size ${size}).`);

    return { clanId, crestId, data: packet.b(size) };
}

export type StorageItem_T = { type1: number, objectId: number, itemId: number, count: number, type2: number, customType1: number, bodyPart: number, enchantLevel: number, customType2: number };
export type WarehouseList_T = { type: WarehouseType_T, adena: number, items: StorageItem_T[] };
export type PackageSendableList_T = { targetId: number, adena: number, items: StorageItem_T[] };
export type PackageTarget_T = { objectId: number, name: string };
export type PrivateStoreSellItem_T = { type2: number, objectId: number, itemId: number, count: number, enchantLevel: number, customType2: number, bodyPart: number, price: number, referencePrice: number };
export type PrivateStoreManageSell_T = { playerId: number, isPackage: boolean, adena: number, items: PrivateStoreSellItem_T[], listed: PrivateStoreSellItem_T[] };
export type PrivateStoreSellList_T = { storePlayerId: number, isPackage: boolean, adena: number, items: PrivateStoreSellItem_T[] };
export type PrivateStoreBuyItem_T = { objectId: number, itemId: number, enchantLevel: number, count: number, referencePrice: number, bodyPart: number, type2: number, price: number, maxCount: number };
export type PrivateStoreManageBuy_T = { playerId: number, adena: number, items: PrivateStoreBuyItem_T[], listed: PrivateStoreBuyItem_T[] };
export type PrivateStoreBuyList_T = { storePlayerId: number, adena: number, items: PrivateStoreBuyItem_T[] };
export type MultiSellProduct_T = { itemId: number, bodyPart: number, type2: number, count: number, enchantLevel: number };
export type MultiSellIngredient_T = { itemId: number, type2: number, count: number, enchantLevel: number };
export type MultiSellEntry_T = { entryId: number, products: MultiSellProduct_T[], ingredients: MultiSellIngredient_T[] };
export type MultiSellList_T = { listId: number, page: number, isFinished: boolean, pageSize: number, entries: MultiSellEntry_T[] };
export type ShopPreviewItem_T = { itemId: number, type2: number, bodyPart: number, price: number };
export type ShopPreviewList_T = { adena: number, listId: number, items: ShopPreviewItem_T[] };
export type ManorItem_T = { type1: number, objectId: number, itemId: number, count: number, type2: number, price: number };
export type BuyListSeed_T = { adena: number, manorId: number, items: ManorItem_T[] };
export type SellListProcure_T = { adena: number, listId: number, items: ManorItem_T[] };
export type ItemCount_T = { objectId: number, count: number };
export type ItemIdCount_T = { itemId: number, count: number };
export type SellItemRequest_T = { objectId: number, itemId: number, count: number };
export type PrivateStoreOffer_T = { objectId: number, count: number, price: number };
export type PrivateStoreBuyOffer_T = { itemId: number, enchantLevel: number, count: number, price: number };
export type PrivateStoreSellOffer_T = { objectId: number, itemId: number, enchantLevel: number, count: number, price: number };

function readStorageItem(packet: PacketReader): StorageItem_T { // WareHouseDepositList/WareHouseWithdrawalList/PackageSendableList: trailing d repeats objectId.
    const type1 = packet.h(), objectId = packet.d(), itemId = packet.d(), count = packet.d(), type2 = packet.h(), customType1 = packet.h(), bodyPart = packet.d(), enchantLevel = packet.h();

    packet.h();

    const customType2 = packet.h(), replyId = packet.d();

    if (objectId <= 0 || itemId <= 0 || count <= 0 || replyId !== objectId) throw new Error(`Invalid storage item '${itemId}'.`);

    return { type1, objectId, itemId, count, type2, customType1, bodyPart, enchantLevel, customType2 };
}

export function readWarehouseList(packet: PacketReader): WarehouseList_T {
    const type = packet.h() as WarehouseType_T, adena = packet.d(), count = packet.h();

    if (WarehouseType_T[type] === undefined) throw new Error(`Invalid warehouse type '${type}'.`);
    if (adena < 0 || count > packet.getRemaining() / 32) throw new Error(`Invalid warehouse item count '${count}'.`);

    const items = Array.from({ length: count }, () => readStorageItem(packet));

    if (packet.getRemaining()) throw new Error("Invalid warehouse list trailing data.");

    return { type, adena, items };
}

export function readPackageSendableList(packet: PacketReader): PackageSendableList_T {
    const targetId = packet.d(), adena = packet.d(), count = packet.d();

    if (targetId <= 0 || adena < 0 || count < 0 || count > packet.getRemaining() / 32) throw new Error(`Invalid PackageSendableList count '${count}'.`);

    const items = Array.from({ length: count }, () => readStorageItem(packet));

    if (packet.getRemaining()) throw new Error("Invalid PackageSendableList trailing data.");

    return { targetId, adena, items };
}

export function readPackageToList(packet: PacketReader): PackageTarget_T[] {
    const count = packet.d();

    if (count < 0 || count > packet.getRemaining() / 6) throw new Error(`Invalid PackageToList count '${count}'.`);

    const targets = Array.from({ length: count }, () => ({ objectId: packet.d(), name: packet.S() }));

    if (packet.getRemaining()) throw new Error("Invalid PackageToList trailing data.");

    return targets;
}

function readPrivateStoreSellItem(packet: PacketReader, hasReferencePrice: boolean): PrivateStoreSellItem_T {
    const type2 = packet.d(), objectId = packet.d(), itemId = packet.d(), count = packet.d();

    packet.h();

    const enchantLevel = packet.h(), customType2 = packet.h(), bodyPart = packet.d(), price = packet.d(), referencePrice = hasReferencePrice ? packet.d() : 0;

    if (objectId <= 0 || itemId <= 0 || count < 0 || price < 0) throw new Error(`Invalid private store item '${itemId}'.`);

    return { type2, objectId, itemId, count, enchantLevel, customType2, bodyPart, price, referencePrice };
}

function readPrivateStoreSellItems(packet: PacketReader, hasReferencePrice: boolean): PrivateStoreSellItem_T[] {
    const count = packet.d();

    if (count < 0 || count > packet.getRemaining() / (hasReferencePrice ? 34 : 30)) throw new Error(`Invalid private store item count '${count}'.`);

    return Array.from({ length: count }, () => readPrivateStoreSellItem(packet, hasReferencePrice));
}

export function readPrivateStoreManageListSell(packet: PacketReader): PrivateStoreManageSell_T {
    const playerId = packet.d(), isPackage = packet.d(), adena = packet.d();

    if (isPackage !== 0 && isPackage !== 1 || adena < 0) throw new Error("Invalid PrivateStoreManageListSell header.");

    const items = readPrivateStoreSellItems(packet, false), listed = readPrivateStoreSellItems(packet, true);

    if (packet.getRemaining()) throw new Error("Invalid PrivateStoreManageListSell trailing data.");

    return { playerId, isPackage: isPackage === 1, adena, items, listed };
}

export function readPrivateStoreListSell(packet: PacketReader): PrivateStoreSellList_T {
    const storePlayerId = packet.d(), isPackage = packet.d(), adena = packet.d();

    if (storePlayerId <= 0 || isPackage !== 0 && isPackage !== 1 || adena < 0) throw new Error("Invalid PrivateStoreListSell header.");

    const items = readPrivateStoreSellItems(packet, true);

    if (packet.getRemaining()) throw new Error("Invalid PrivateStoreListSell trailing data.");

    return { storePlayerId, isPackage: isPackage === 1, adena, items };
}

function readPrivateStoreBuyItem(packet: PacketReader, isStoreList: boolean, hasPrice: boolean): PrivateStoreBuyItem_T {
    const objectId = isStoreList ? packet.d() : 0, itemId = packet.d(), enchantLevel = packet.h(), count = packet.d(), referencePrice = packet.d();

    packet.h();

    const bodyPart = packet.d(), type2 = packet.h(), price = hasPrice ? packet.d() : 0, maxCount = isStoreList ? packet.d() : 0;

    if (hasPrice && !isStoreList) packet.d(); // Fixed store price, repeats referencePrice.
    if (isStoreList && objectId <= 0 || itemId <= 0 || count < 0 || price < 0) throw new Error(`Invalid private store buy item '${itemId}'.`);

    return { objectId, itemId, enchantLevel, count, referencePrice, bodyPart, type2, price, maxCount };
}

function readPrivateStoreBuyItems(packet: PacketReader, isStoreList: boolean, hasPrice: boolean): PrivateStoreBuyItem_T[] {
    const count = packet.d(), size = isStoreList ? 34 : hasPrice ? 30 : 22;

    if (count < 0 || count > packet.getRemaining() / size) throw new Error(`Invalid private store buy item count '${count}'.`);

    return Array.from({ length: count }, () => readPrivateStoreBuyItem(packet, isStoreList, hasPrice));
}

export function readPrivateStoreManageListBuy(packet: PacketReader): PrivateStoreManageBuy_T {
    const playerId = packet.d(), adena = packet.d();

    if (adena < 0) throw new Error("Invalid PrivateStoreManageListBuy header.");

    const items = readPrivateStoreBuyItems(packet, false, false), listed = readPrivateStoreBuyItems(packet, false, true);

    if (packet.getRemaining()) throw new Error("Invalid PrivateStoreManageListBuy trailing data.");

    return { playerId, adena, items, listed };
}

export function readPrivateStoreListBuy(packet: PacketReader): PrivateStoreBuyList_T {
    const storePlayerId = packet.d(), adena = packet.d();

    if (storePlayerId <= 0 || adena < 0) throw new Error("Invalid PrivateStoreListBuy header.");

    const items = readPrivateStoreBuyItems(packet, true, true);

    if (packet.getRemaining()) throw new Error("Invalid PrivateStoreListBuy trailing data.");

    return { storePlayerId, adena, items };
}

export function readMultiSellList(packet: PacketReader): MultiSellList_T {
    const listId = packet.d(), page = packet.d(), isFinished = packet.d(), pageSize = packet.d(), count = packet.d();

    if (page < 1 || isFinished !== 0 && isFinished !== 1 || count < 0 || count > packet.getRemaining() / 9) throw new Error(`Invalid MultiSellList count '${count}'.`);

    const entries: MultiSellEntry_T[] = [];

    for (let i = 0; i < count; i++) {
        const entryId = packet.d();

        packet.c();

        const productCount = packet.h(), ingredientCount = packet.h();

        if (productCount * 14 + ingredientCount * 10 > packet.getRemaining()) throw new Error(`Invalid MultiSellList entry '${entryId}'.`);

        const products = Array.from({ length: productCount }, () => ({ itemId: packet.h(), bodyPart: packet.d(), type2: packet.h(), count: packet.d(), enchantLevel: packet.h() }));
        const ingredients = Array.from({ length: ingredientCount }, () => ({ itemId: packet.h(), type2: packet.h(), count: packet.d(), enchantLevel: packet.h() }));

        entries.push({ entryId, products, ingredients });
    }

    if (packet.getRemaining()) throw new Error("Invalid MultiSellList trailing data.");

    return { listId, page, isFinished: isFinished === 1, pageSize, entries };
}

export function readShopPreviewList(packet: PacketReader): ShopPreviewList_T {
    packet.skip(4);

    const adena = packet.d(), listId = packet.d(), count = packet.h();

    if (adena < 0 || count > packet.getRemaining() / 12) throw new Error(`Invalid ShopPreviewList count '${count}'.`);

    const items = Array.from({ length: count }, () => ({ itemId: packet.d(), type2: packet.h(), bodyPart: packet.h(), price: packet.d() }));

    if (packet.getRemaining()) throw new Error("Invalid ShopPreviewList trailing data.");

    return { adena, listId, items };
}

const arrShopPreviewSlots = [Paperdoll_T.PAPERDOLL_REAR, Paperdoll_T.PAPERDOLL_LEAR, Paperdoll_T.PAPERDOLL_NECK, Paperdoll_T.PAPERDOLL_RFINGER, Paperdoll_T.PAPERDOLL_LFINGER, Paperdoll_T.PAPERDOLL_HEAD, Paperdoll_T.PAPERDOLL_RHAND, Paperdoll_T.PAPERDOLL_LHAND, Paperdoll_T.PAPERDOLL_GLOVES, Paperdoll_T.PAPERDOLL_CHEST, Paperdoll_T.PAPERDOLL_LEGS, Paperdoll_T.PAPERDOLL_FEET, Paperdoll_T.PAPERDOLL_UNDER, Paperdoll_T.PAPERDOLL_LRHAND, Paperdoll_T.PAPERDOLL_HAIR];

export function readShopPreviewInfo(packet: PacketReader): number[] { // Item ids indexed by Paperdoll_T.
    const count = packet.d();

    if (count !== arrShopPreviewSlots.length) throw new Error(`Invalid ShopPreviewInfo slot count '${count}'.`);

    const items = new Array<number>(Paperdoll_T.PAPERDOLL_HAIR + 1).fill(0);

    for (const slot of arrShopPreviewSlots) items[slot] = packet.d();

    if (packet.getRemaining()) throw new Error("Invalid ShopPreviewInfo trailing data.");

    return items;
}

function readManorItems(packet: PacketReader, name: string): ManorItem_T[] {
    const length = packet.h();

    if (length > packet.getRemaining() / 22) throw new Error(`Invalid ${name} count '${length}'.`);

    return Array.from({ length }, () => {
        const type1 = packet.h(), objectId = packet.d(), itemId = packet.d(), count = packet.d(), type2 = packet.h();

        packet.h();

        const price = packet.d();

        if (objectId < 0 || itemId <= 0 || count < 0 || price < 0) throw new Error(`Invalid ${name} item '${itemId}'.`);

        return { type1, objectId, itemId, count, type2, price };
    });
}

export function readBuyListSeed(packet: PacketReader): BuyListSeed_T {
    const adena = packet.d(), manorId = packet.d(), items = readManorItems(packet, "BuyListSeed");

    if (adena < 0 || packet.getRemaining()) throw new Error("Invalid BuyListSeed payload.");

    return { adena, manorId, items };
}

export function readSellListProcure(packet: PacketReader): SellListProcure_T {
    const adena = packet.d(), listId = packet.d(), items = readManorItems(packet, "SellListProcure");

    if (adena < 0 || packet.getRemaining()) throw new Error("Invalid SellListProcure payload.");

    return { adena, listId, items };
}

export type VehicleLocation_T = Location_T & { objectId: number, heading: number };
export type VehicleDeparture_T = Location_T & { objectId: number, moveSpeed: number, rotationSpeed: number };
export type VehicleRider_T = Location_T & { objectId: number, vehicleId: number };
export type VehicleRiderStop_T = VehicleRider_T & { heading: number };
export type VehicleRiderMove_T = { objectId: number, vehicleId: number, destination: Location_T, origin: Location_T };
export type Ride_T = { objectId: number, isMounted: boolean, mountType: MountType_T, npcId: number };
export type FlyToLocation_T = { objectId: number, destination: Location_T, origin: Location_T, flyType: FlyType_T };
export type SpecialCamera_T = { objectId: number, distance: number, yaw: number, pitch: number, time: number, duration: number, turn: number, rise: number, wideScreen: number, isRelative: boolean };
export type ObservationMode_T = Location_T & { modeBytes: number[] };
export type RadarControl_T = Location_T & { action: number, type: number };
export type TownMap_T = { texture: string, x: number, y: number };
export type MonRaceRunner_T = { objectId: number, npcId: number, origin: Location_T, destination: Location_T, collisionHeight: number, collisionRadius: number, unknown: number, speeds: number[], trailer: number };
export type MonRaceInfo_T = { unknown1: number, unknown2: number, runners: MonRaceRunner_T[] };
export type Dice_T = Location_T & { objectId: number, itemId: number, number: number };
export type SSQCabalScore_T = { stoneScore: number, festivalScore: number, totalScore: number, percent: number };
export type SSQRecord_T = { cycle: number, periodMessageId: number, periodEndMessageId: number, playerCabal: number, playerSeal: number, stoneContribution: number, ancientAdena: number, dusk: SSQCabalScore_T, dawn: SSQCabalScore_T };
export type SSQFestival_T = { id: number, levelScore: number, duskScore: number, duskMembers: string[], dawnScore: number, dawnMembers: string[] };
export type SSQSealStatus_T = { id: number, owner: number, duskPercent: number, dawnPercent: number };
export type SSQSealPrediction_T = { id: number, cabal: number, messageId: number, unknown: number };
export type SSQStatus_T = { page: 1, period: number, record: SSQRecord_T } | { page: 2, period: number, unknown: number, festivals: SSQFestival_T[] } | { page: 3, period: number, retainLimit: number, claimLimit: number, seals: SSQSealStatus_T[] } | { page: 4, period: number, predictedWinner: number, predictions: SSQSealPrediction_T[] };
export type ClanHallDecoration_T = { clanHallId: number, restoreHp: number, restoreMp: number[], restoreExp: number, teleport: number, unknown: number, curtains: number, itemCreate: number, support: number[], frontPlatform: number, itemCreate2: number, trailer: number[] };
export type SiegeInfo_T = { castleId: number, ownerPrivileges: number, ownerId: number, ownerName: string, ownerLeaderName: string, ownerAllyId: number, ownerAllyName: string, serverTime: number, siegeTime: number, choices: number };
export type SiegeClan_T = { clanId: number, name: string, leaderName: string, crestId: number, signedTime: number, type: number, allyId: number, allyName: string, allyLeaderName: string, allyCrestId: number };
export type SiegeClanList_T = { castleId: number, unknown: number[], totalCount: number, clans: SiegeClan_T[] };

export function readPoint(packet: PacketReader): Location_T { return { x: packet.d(), y: packet.d(), z: packet.d() }; }

export function readVehicleLocation(packet: PacketReader): VehicleLocation_T { // VehicleInfo and OnVehicleCheckLocation share d id, d x, d y, d z, d heading.
    return { objectId: packet.d(), x: packet.d(), y: packet.d(), z: packet.d(), heading: packet.d() & 0xffff };
}

export function readVehicleDeparture(packet: PacketReader): VehicleDeparture_T {
    return { objectId: packet.d(), moveSpeed: packet.d(), rotationSpeed: packet.d(), x: packet.d(), y: packet.d(), z: packet.d() };
}

export function readVehicleRider(packet: PacketReader): VehicleRider_T {
    return { objectId: packet.d(), vehicleId: packet.d(), x: packet.d(), y: packet.d(), z: packet.d() };
}

export function readVehicleRiderStop(packet: PacketReader): VehicleRiderStop_T {
    return { objectId: packet.d(), vehicleId: packet.d(), x: packet.d(), y: packet.d(), z: packet.d(), heading: packet.d() & 0xffff };
}

export function readVehicleRiderMove(packet: PacketReader): VehicleRiderMove_T {
    return { objectId: packet.d(), vehicleId: packet.d(), destination: readPoint(packet), origin: readPoint(packet) };
}

export function readRide(packet: PacketReader): Ride_T {
    const objectId = packet.d(), isMounted = packet.d(), mountType = packet.d() as MountType_T, npcId = packet.d() - NPC_ID_OFFSET;

    if ((isMounted !== 0 && isMounted !== 1) || mountType < MountType_T.NONE || mountType > MountType_T.WYVERN) throw new Error(`Invalid Ride payload '${isMounted}/${mountType}'.`);

    return { objectId, isMounted: isMounted === 1, mountType, npcId };
}

export function readFlyToLocation(packet: PacketReader): FlyToLocation_T {
    const objectId = packet.d(), destination = readPoint(packet), origin = readPoint(packet), flyType = packet.d() as FlyType_T;

    if (flyType < FlyType_T.THROW_UP || flyType > FlyType_T.CHARGE) throw new Error(`Invalid FlyToLocation type '${flyType}'.`);

    return { objectId, destination, origin, flyType };
}

export function readSpecialCamera(packet: PacketReader): SpecialCamera_T { // SetSpecialViewTarget 0x800048: a non-zero last field makes yaw/pitch relative to the target's Rotation.
    return { objectId: packet.d(), distance: packet.d(), yaw: packet.d(), pitch: packet.d(), time: packet.d(), duration: packet.d(), turn: packet.d(), rise: packet.d(), wideScreen: packet.d(), isRelative: packet.d() !== 0 };
}

export function readObservationMode(packet: PacketReader): ObservationMode_T {
    return { x: packet.d(), y: packet.d(), z: packet.d(), modeBytes: [packet.c(), packet.c(), packet.c()] };
}

export function readRadarControl(packet: PacketReader): RadarControl_T {
    return { action: packet.d(), type: packet.d(), x: packet.d(), y: packet.d(), z: packet.d() };
}

export function readTownMap(packet: PacketReader): TownMap_T {
    return { texture: packet.S(), x: packet.d(), y: packet.d() };
}

export function readMonRaceInfo(packet: PacketReader): MonRaceInfo_T {
    const unknown1 = packet.d(), unknown2 = packet.d(), count = packet.d();

    if (count < 0 || count > packet.getRemaining() / 76) throw new Error(`Invalid MonRaceInfo count '${count}'.`);

    const runners: MonRaceRunner_T[] = [];

    for (let i = 0; i < count; i++) {
        const objectId = packet.d(), npcId = packet.d() - NPC_ID_OFFSET, origin = readPoint(packet), destination = readPoint(packet);
        const collisionHeight = packet.f(), collisionRadius = packet.f(), unknown = packet.d();
        const speeds = Array.from({ length: 20 }, () => packet.c());

        runners.push({ objectId, npcId, origin, destination, collisionHeight, collisionRadius, unknown, speeds, trailer: packet.d() });
    }

    return { unknown1, unknown2, runners };
}

export function readDice(packet: PacketReader): Dice_T {
    return { objectId: packet.d(), itemId: packet.d(), number: packet.d(), x: packet.d(), y: packet.d(), z: packet.d() };
}

function readSSQCabalScore(packet: PacketReader): SSQCabalScore_T {
    return { stoneScore: packet.d(), festivalScore: packet.d(), totalScore: packet.d(), percent: packet.c() };
}

function readSSQMembers(packet: PacketReader): string[] {
    const count = packet.c();

    if (count > packet.getRemaining() / 2) throw new Error(`Invalid SSQStatus member count '${count}'.`);

    return Array.from({ length: count }, () => packet.S());
}

export function readSSQStatus(packet: PacketReader): SSQStatus_T {
    const page = packet.c(), period = packet.c();

    switch (page) {
        case 1: {
            const cycle = packet.d(), periodMessageId = packet.d(), periodEndMessageId = packet.d();
            const playerCabal = packet.c(), playerSeal = packet.c(), stoneContribution = packet.d(), ancientAdena = packet.d();
            const dusk = readSSQCabalScore(packet), dawn = readSSQCabalScore(packet);

            return { page: 1, period, record: { cycle, periodMessageId, periodEndMessageId, playerCabal, playerSeal, stoneContribution, ancientAdena, dusk, dawn } };
        }
        case 2: {
            const unknown = packet.h(), count = packet.c();

            if (count > packet.getRemaining() / 15) throw new Error(`Invalid SSQStatus festival count '${count}'.`);

            const festivals: SSQFestival_T[] = [];

            for (let i = 0; i < count; i++) {
                const id = packet.c(), levelScore = packet.d(), duskScore = packet.d(), duskMembers = readSSQMembers(packet);
                const dawnScore = packet.d(), dawnMembers = readSSQMembers(packet);

                festivals.push({ id, levelScore, duskScore, duskMembers, dawnScore, dawnMembers });
            }

            return { page: 2, period, unknown, festivals };
        }
        case 3: {
            const retainLimit = packet.c(), claimLimit = packet.c(), count = packet.c();

            if (count > packet.getRemaining() / 4) throw new Error(`Invalid SSQStatus seal count '${count}'.`);

            const seals: SSQSealStatus_T[] = [];

            for (let i = 0; i < count; i++) seals.push({ id: packet.c(), owner: packet.c(), duskPercent: packet.c(), dawnPercent: packet.c() });

            return { page: 3, period, retainLimit, claimLimit, seals };
        }
        case 4: {
            const predictedWinner = packet.c(), count = packet.c();

            if (count > packet.getRemaining() / 6) throw new Error(`Invalid SSQStatus prediction count '${count}'.`);

            const predictions: SSQSealPrediction_T[] = [];

            for (let i = 0; i < count; i++) predictions.push({ id: packet.c(), cabal: packet.c(), messageId: packet.h(), unknown: packet.h() });

            return { page: 4, period, predictedWinner, predictions };
        }
        default: throw new Error(`Unknown SSQStatus page '${page}'.`);
    }
}

export function readClanHallDecoration(packet: PacketReader): ClanHallDecoration_T {
    return { clanHallId: packet.d(), restoreHp: packet.c(), restoreMp: [packet.c(), packet.c()], restoreExp: packet.c(), teleport: packet.c(), unknown: packet.c(), curtains: packet.c(), itemCreate: packet.c(), support: [packet.c(), packet.c()], frontPlatform: packet.c(), itemCreate2: packet.c(), trailer: [packet.d(), packet.d()] };
}

export function readSiegeInfo(packet: PacketReader): SiegeInfo_T {
    const castleId = packet.d(), ownerPrivileges = packet.d(), ownerId = packet.d();
    const hasOwner = packet.getRemaining() > 12; // SiegeInfo.java writes no owner block when the owner clan is missing from ClanTable.
    const ownerName = hasOwner ? packet.S() : null, ownerLeaderName = hasOwner ? packet.S() : null, ownerAllyId = hasOwner ? packet.d() : 0, ownerAllyName = hasOwner ? packet.S() : null;
    const serverTime = packet.d(), siegeTime = packet.d(), choices = packet.d();

    if (packet.getRemaining()) throw new Error("Invalid SiegeInfo trailing data.");

    return { castleId, ownerPrivileges, ownerId, ownerName, ownerLeaderName, ownerAllyId, ownerAllyName, serverTime, siegeTime, choices };
}

export function readSiegeClanList(packet: PacketReader, hasType: boolean): SiegeClanList_T {
    const castleId = packet.d(), unknown = [packet.d(), packet.d(), packet.d()], totalCount = packet.d(), count = packet.d();

    if (count < 0 || count > packet.getRemaining() / (hasType ? 32 : 28)) throw new Error(`Invalid siege clan count '${count}'.`);

    const clans: SiegeClan_T[] = [];

    for (let i = 0; i < count; i++) {
        const clanId = packet.d(), name = packet.S(), leaderName = packet.S(), crestId = packet.d(), signedTime = packet.d(), type = hasType ? packet.d() : -1;
        const allyId = packet.d(), allyName = packet.S(), allyLeaderName = packet.S(), allyCrestId = packet.d();

        clans.push({ clanId, name, leaderName, crestId, signedTime, type, allyId, allyName, allyLeaderName, allyCrestId });
    }

    return { castleId, unknown, totalCount, clans };
}

export type RecipeBookEntry_T = { recipeId: number, index: number };
export type RecipeShopItem_T = { recipeId: number, unknown: number, cost: number };
export type RecipeShopListEntry_T = { recipeId: number, cost: number };
export type RecipeBook_T = { isDwarven: boolean, maxMp: number, recipes: RecipeBookEntry_T[] };
export type RecipeItemMakeInfo_T = { recipeId: number, isDwarven: boolean, curMp: number, maxMp: number, status: number };
export type RecipeShopManageList_T = RecipeBook_T & { curMp: number, items: RecipeShopItem_T[] };
export type RecipeShopSellList_T = { objectId: number, curMp: number, maxMp: number, adena: number, items: RecipeShopItem_T[] };
export type RecipeShopItemInfo_T = { objectId: number, recipeId: number, curMp: number, maxMp: number, status: number };
export type RecipeShopMsg_T = { objectId: number, storeName: string };
export type HennaEquipEntry_T = { symbolId: number, dyeItemId: number, dyeCount: number, price: number, isAvailable: boolean };
export type HennaEquipList_T = { adena: number, slots: number, hennas: HennaEquipEntry_T[] };
export type HennaItemInfo_T = HennaEquipEntry_T & { adena: number, stats: number[], equippedStats: number[] };
export type PartyMatchRoom_T = { roomId: number, title: string, location: number, minLevel: number, maxLevel: number, members: number, maxMembers: number, ownerName: string };
export type PartyMatchDetail_T = { roomId: number, maxMembers: number, minLevel: number, maxLevel: number, lootType: number, location: number, title: string };
export type PartySpelled_T = { type: PartySpelledType_T, objectId: number, effects: AbnormalStatus_T[] };
export type Snoop_T = { conversationId: number, name: string, unknown: number, type: Say2_T, speaker: string, message: string };
export type GMViewPledgeInfo_T = { charName: string, clan: ClanInfo_T, members: ClanMember_T[] };
export type GMViewSkillInfo_T = { charName: string, skills: SkillEntry_T[] };
export type GMViewQuestList_T = { charName: string, quests: QuestState_T[] };
export type GMViewItemList_T = { charName: string, inventoryLimit: number, showWindow: boolean, items: InventoryItem_T[] };
export type GMWarehouseItem_T = { type1: number, objectId: number, itemId: number, count: number, type2: number, customType1: number, isEquipable: boolean, bodyPart: number, enchantLevel: number };
export type GMViewWarehouseWithdrawList_T = { charName: string, adena: number, items: GMWarehouseItem_T[] };

export type GMViewCharacterInfo_T = Location_T & Speeds_T & { heading: number, objectId: number, name: string, race: Race_T, sex: number, classId: number, level: number, exp: number, str: number, dex: number, con: number, int: number, wit: number, men: number, maxHp: number, curHp: number, maxMp: number, curMp: number, sp: number, curLoad: number, maxLoad: number, hasWeapon: boolean, paperdollObjects: number[], paperdoll: number[], pAtk: number, atkSpd: number, pDef: number, evasion: number, accuracy: number, critical: number, mAtk: number, castSpd: number, mDef: number, pvpFlag: number, karma: number, hairStyle: number, hairColor: number, face: number, isGM: boolean, title: string, clanId: number, clanCrestId: number, allyId: number, mountType: number, privateStoreType: number, hasDwarvenCraft: boolean, pkKills: number, pvpKills: number, recommendationsLeft: number, recommendations: number, maxCp: number, curCp: number };

function readCraftType(packet: PacketReader): boolean {
    const type = packet.d();

    if (type !== 0 && type !== 1) throw new Error(`Invalid recipe craft type '${type}'.`);

    return type === 0;
}

function readRecipeBookEntries(packet: PacketReader): RecipeBookEntry_T[] {
    const count = packet.d();

    if (count < 0 || count > packet.getRemaining() / 8) throw new Error(`Invalid recipe book count '${count}'.`);

    return Array.from({ length: count }, () => ({ recipeId: packet.d(), index: packet.d() }));
}

function readRecipeShopItems(packet: PacketReader): RecipeShopItem_T[] {
    const count = packet.d();

    if (count < 0 || count > packet.getRemaining() / 12) throw new Error(`Invalid recipe shop item count '${count}'.`);

    return Array.from({ length: count }, () => ({ recipeId: packet.d(), unknown: packet.d(), cost: packet.d() }));
}

export function readRecipeBookItemList(packet: PacketReader): RecipeBook_T {
    const isDwarven = readCraftType(packet), maxMp = packet.d(), recipes = readRecipeBookEntries(packet);

    if (packet.getRemaining()) throw new Error("Invalid RecipeBookItemList trailing data.");

    return { isDwarven, maxMp, recipes };
}

export function readRecipeItemMakeInfo(packet: PacketReader): RecipeItemMakeInfo_T {
    const recipeId = packet.d(), isDwarven = readCraftType(packet), curMp = packet.d(), maxMp = packet.d(), status = packet.d();

    if (packet.getRemaining()) throw new Error("Invalid RecipeItemMakeInfo trailing data.");

    return { recipeId, isDwarven, curMp, maxMp, status };
}

export function readRecipeShopManageList(packet: PacketReader): RecipeShopManageList_T {
    const isDwarven = readCraftType(packet), curMp = packet.d(), maxMp = packet.d(), recipes = readRecipeBookEntries(packet), items = readRecipeShopItems(packet);

    if (packet.getRemaining()) throw new Error("Invalid RecipeShopManageList trailing data.");

    return { isDwarven, curMp, maxMp, recipes, items };
}

export function readRecipeShopSellList(packet: PacketReader): RecipeShopSellList_T {
    const objectId = packet.d(), curMp = packet.d(), maxMp = packet.d(), adena = packet.d(), items = readRecipeShopItems(packet);

    if (objectId <= 0 || packet.getRemaining()) throw new Error("Invalid RecipeShopSellList payload.");

    return { objectId, curMp, maxMp, adena, items };
}

export function readRecipeShopItemInfo(packet: PacketReader): RecipeShopItemInfo_T {
    const objectId = packet.d(), recipeId = packet.d(), curMp = packet.d(), maxMp = packet.d(), status = packet.d();

    if (objectId <= 0 || packet.getRemaining()) throw new Error("Invalid RecipeShopItemInfo payload.");

    return { objectId, recipeId, curMp, maxMp, status };
}

export function readRecipeShopMsg(packet: PacketReader): RecipeShopMsg_T {
    const objectId = packet.d(), storeName = packet.S();

    if (objectId <= 0 || packet.getRemaining()) throw new Error("Invalid RecipeShopMsg payload.");

    return { objectId, storeName };
}

export function readHennaEquipList(packet: PacketReader): HennaEquipList_T {
    const adena = packet.d(), slots = packet.d(), count = packet.d();

    if (count < 0 || count !== packet.getRemaining() / 20) throw new Error(`Invalid HennaEquipList count '${count}'.`);

    const hennas: HennaEquipEntry_T[] = [];

    for (let i = 0; i < count; i++) {
        const symbolId = packet.d(), dyeItemId = packet.d(), dyeCount = packet.d(), price = packet.d(), isAvailable = packet.d();

        if (isAvailable !== 0 && isAvailable !== 1) throw new Error(`Invalid HennaEquipList availability '${isAvailable}'.`);

        hennas.push({ symbolId, dyeItemId, dyeCount, price, isAvailable: isAvailable === 1 });
    }

    return { adena, slots, hennas };
}

export function readHennaItemInfo(packet: PacketReader): HennaItemInfo_T {
    const symbolId = packet.d(), dyeItemId = packet.d(), dyeCount = packet.d(), price = packet.d(), isAvailable = packet.d(), adena = packet.d();
    const stats: number[] = [], equippedStats: number[] = [];

    for (let i = 0; i < 6; i++) { // INT, STR, CON, MEN, DEX, WIT
        stats.push(packet.d());
        equippedStats.push(packet.c());
    }

    if (isAvailable !== 0 && isAvailable !== 1 || packet.getRemaining()) throw new Error("Invalid HennaItemInfo payload.");

    return { symbolId, dyeItemId, dyeCount, price, isAvailable: isAvailable === 1, adena, stats, equippedStats };
}

export function readPartyMatchList(packet: PacketReader): PartyMatchRoom_T[] {
    const hasRooms = packet.d(), count = packet.d();

    if (count < 0 || count > packet.getRemaining() / 28 || hasRooms !== (count > 0 ? 1 : 0)) throw new Error(`Invalid PartyMatchList count '${count}'.`);

    const rooms: PartyMatchRoom_T[] = [];

    for (let i = 0; i < count; i++) rooms.push({ roomId: packet.d(), title: packet.S(), location: packet.d(), minLevel: packet.d(), maxLevel: packet.d(), members: packet.d(), maxMembers: packet.d(), ownerName: packet.S() });

    if (packet.getRemaining()) throw new Error("Invalid PartyMatchList trailing data.");

    return rooms;
}

export function readPartyMatchDetail(packet: PacketReader): PartyMatchDetail_T {
    const detail = { roomId: packet.d(), maxMembers: packet.d(), minLevel: packet.d(), maxLevel: packet.d(), lootType: packet.d(), location: packet.d(), title: packet.S() };

    if (packet.getRemaining()) throw new Error("Invalid PartyMatchDetail trailing data.");

    return detail;
}

export function readPartySpelled(packet: PacketReader): PartySpelled_T {
    const type = packet.d() as PartySpelledType_T, objectId = packet.d(), count = packet.d();

    if (type < PartySpelledType_T.PLAYER || type > PartySpelledType_T.SUMMON || count < 0 || count !== packet.getRemaining() / 10) throw new Error(`Invalid PartySpelled payload (type ${type}, count ${count}).`);

    return { type, objectId, effects: Array.from({ length: count }, () => ({ id: packet.d(), level: packet.h(), duration: packet.d() })) };
}

export function readSnoop(packet: PacketReader): Snoop_T {
    const snoop = { conversationId: packet.d(), name: packet.S(), unknown: packet.d(), type: packet.d() as Say2_T, speaker: packet.S(), message: packet.S() };

    if (packet.getRemaining()) throw new Error("Invalid Snoop trailing data.");

    return snoop;
}

export function readGMViewCharacterInfo(packet: PacketReader): GMViewCharacterInfo_T {
    const info = { x: packet.d(), y: packet.d(), z: packet.d(), heading: packet.d() & 0xffff, objectId: packet.d(), name: packet.S(), race: packet.d() as Race_T, sex: packet.d(), classId: packet.d(), level: packet.d(), exp: packet.d() } as GMViewCharacterInfo_T;

    info.str = packet.d();
    info.dex = packet.d();
    info.con = packet.d();
    info.int = packet.d();
    info.wit = packet.d();
    info.men = packet.d();
    info.maxHp = packet.d();
    info.curHp = packet.d();
    info.maxMp = packet.d();
    info.curMp = packet.d();
    info.sp = packet.d();
    info.curLoad = packet.d();
    info.maxLoad = packet.d();

    const weaponState = packet.d();

    if (weaponState !== 20 && weaponState !== 40) throw new Error(`Invalid GMViewCharacterInfo weapon state '${weaponState}'.`);

    info.hasWeapon = weaponState === 40;
    info.paperdollObjects = readPaperdollItems(packet); // Slot PAPERDOLL_LRHAND carries PAPERDOLL_RHAND again (GMViewCharacterInfo.java).
    info.paperdoll = readPaperdollItems(packet);
    info.pAtk = packet.d();
    info.atkSpd = packet.d();
    info.pDef = packet.d();
    info.evasion = packet.d();
    info.accuracy = packet.d();
    info.critical = packet.d();
    info.mAtk = packet.d();
    info.castSpd = packet.d();
    packet.d();
    info.mDef = packet.d();
    info.pvpFlag = packet.d();
    info.karma = packet.d();
    readSpeeds(packet, info);
    info.hairStyle = packet.d();
    info.hairColor = packet.d();
    info.face = packet.d();
    info.isGM = packet.d() !== 0;
    info.title = packet.S();
    info.clanId = packet.d();
    info.clanCrestId = packet.d();
    info.allyId = packet.d();
    info.mountType = packet.c();
    info.privateStoreType = packet.c();
    info.hasDwarvenCraft = packet.c() !== 0;
    info.pkKills = packet.d();
    info.pvpKills = packet.d();
    info.recommendationsLeft = packet.h();
    info.recommendations = packet.h();
    info.classId = packet.d();
    info.maxCp = packet.d();
    info.curCp = packet.d();

    if (packet.getRemaining()) throw new Error("Invalid GMViewCharacterInfo trailing data.");

    return info;
}

export function readGMViewPledgeInfo(packet: PacketReader): GMViewPledgeInfo_T {
    const charName = packet.S(), clanId = packet.d(), name = packet.S(), leaderName = packet.S(), crestId = packet.d(), level = packet.d(), hasCastle = packet.d(), hasHideout = packet.d();

    packet.d();

    const memberLevel = packet.d(), dissolving = packet.d();

    packet.d();

    const allyId = packet.d(), allyName = packet.S(), allyCrestId = packet.d(), isAtWar = packet.d() !== 0, count = packet.d();

    if (count < 0 || count > packet.getRemaining() / 22) throw new Error(`Invalid GMViewPledgeInfo count '${count}'.`);

    const members: ClanMember_T[] = [];

    for (let i = 0; i < count; i++) {
        const member = { name: packet.S(), level: packet.d(), classId: packet.d(), objectId: 0, isOnline: false };

        packet.d();
        packet.d();
        member.objectId = packet.d();
        member.isOnline = member.objectId !== 0;
        members.push(member);
    }

    if (packet.getRemaining()) throw new Error("Invalid GMViewPledgeInfo trailing data.");

    return { charName, clan: { leaderId: 0, clanId, name, leaderName, crestId, level, hasCastle, hasHideout, memberLevel, dissolving, allyId, allyName, allyCrestId, isAtWar }, members };
}

export function readGMViewSkillInfo(packet: PacketReader): GMViewSkillInfo_T {
    const charName = packet.S(), count = packet.d();

    if (count < 0 || packet.getRemaining() > count * 12 || packet.getRemaining() % 12) throw new Error(`Invalid GMViewSkillInfo count '${count}'.`); // count includes the skipped 9001-9006 stat skills.

    const skills: SkillEntry_T[] = [];

    while (packet.getRemaining()) {
        const isPassive = packet.d() !== 0, level = packet.d(), id = packet.d();

        skills.push({ id, level, isPassive });
    }

    return { charName, skills };
}

export function readGMViewQuestList(packet: PacketReader): GMViewQuestList_T {
    const charName = packet.S(), count = packet.h();

    if (count !== packet.getRemaining() / 8) throw new Error(`Invalid GMViewQuestList count '${count}'.`);

    return { charName, quests: Array.from({ length: count }, () => ({ id: packet.d(), condition: packet.d() })) };
}

export function readGMViewItemList(packet: PacketReader): GMViewItemList_T {
    const charName = packet.S(), inventoryLimit = packet.d(), showWindow = packet.h() !== 0, count = packet.h();

    if (packet.getRemaining() > count * 28 || packet.getRemaining() % 28) throw new Error(`Invalid GMViewItemList count '${count}'.`); // count includes skipped null items.

    const items: InventoryItem_T[] = [];

    while (packet.getRemaining()) items.push(readInventoryItem(packet));

    return { charName, inventoryLimit, showWindow, items };
}

export function readGMViewWarehouseWithdrawList(packet: PacketReader): GMViewWarehouseWithdrawList_T {
    const charName = packet.S(), adena = packet.d(), count = packet.h();

    if (count > packet.getRemaining() / 22) throw new Error(`Invalid GMViewWarehouseWithdrawList count '${count}'.`);

    const items: GMWarehouseItem_T[] = [];

    for (let i = 0; i < count; i++) {
        const type1 = packet.h(), objectId = packet.d(), itemId = packet.d(), itemCount = packet.d(), type2 = packet.h(), customType1 = packet.h();
        const isEquipable = type2 <= ItemType2_T.TYPE2_ACCESSORY; // L2EtcItem is always QUEST/MONEY/OTHER.
        let bodyPart = 0, enchantLevel = 0;

        if (isEquipable) {
            bodyPart = packet.d();
            enchantLevel = packet.h();
            packet.h();
            packet.h();
        }

        if (packet.d() !== objectId) throw new Error(`Invalid GMViewWarehouseWithdrawList item '${itemId}'.`);

        items.push({ type1, objectId, itemId, count: itemCount, type2, customType1, isEquipable, bodyPart, enchantLevel });
    }

    if (packet.getRemaining()) throw new Error("Invalid GMViewWarehouseWithdrawList trailing data.");

    return { charName, adena, items };
}

export function readGMViewHennaInfo(packet: PacketReader): HennaStatus_T {
    const stats: number[] = [];

    for (let i = 0; i < 6; i++) stats.push(packet.c());

    const slots = packet.d(), count = packet.d();

    if (slots < 0 || count < 0 || count !== packet.getRemaining() / 8) throw new Error(`Invalid GMViewHennaInfo count '${count}'.`);

    return { stats, slots, symbols: Array.from({ length: count }, () => ({ symbolId: packet.d(), itemId: packet.d() })) };
}

export type EnchantSkill_T = { id: number, nextLevel: number, sp: number, exp: number };
export type EnchantSkillInfo_T = { id: number, level: number, spCost: number, expCost: number, rate: number, requirements: AquireSkillRequirement_T[] };
export type HeroEntry_T = { name: string, classId: number, clanName: string, clanCrestId: number, allyName: string, allyCrestId: number, count: number };
export type CommandChannelParty_T = { leaderName: string, memberCount: number };
export type CommandChannelInfo_T = { leaderName: string, memberCount: number, parties: CommandChannelParty_T[] };
export type OlympiadUserInfo_T = { side: number, objectId: number, name: string, classId: number, curHp: number, maxHp: number, curCp: number, maxCp: number };
export type OlympiadSpelledInfo_T = { objectId: number, effects: AbnormalStatus_T[] };
export type PartyRoomMember_T = { objectId: number, name: string, classId: number, level: number, location: number, role: number };
export type PartyRoomMembers_T = { mode: number, members: PartyRoomMember_T[] };
export type FishingState_T = { fishType: number, x: number, y: number, z: number, isFighting: boolean, time: number, fishHp: number, maxFishHp: number, mode: number, lureType: number, isGoodUse: boolean, animation: number, penalty: number };
export type ManorEntry_T = { id: number, name: string };
export type ManorRewards_T = { reward1Type: number, reward1ItemId: number, reward2Type: number, reward2ItemId: number };
export type ManorSeed_T = ManorRewards_T & { seedId: number, remaining: number, startAmount: number, price: number, level: number };
export type ManorCrop_T = ManorRewards_T & { cropId: number, remaining: number, startAmount: number, price: number, rewardType: number, level: number };
export type ManorDefaultCrop_T = ManorRewards_T & { cropId: number, level: number, seedPrice: number, cropPrice: number };
export type ManorSeedSetting_T = ManorRewards_T & { seedId: number, level: number, nextSaleLimit: number, castleProducePrice: number, minPrice: number, maxPrice: number, todaySales: number, todayPrice: number, nextSales: number, nextPrice: number };
export type ManorCropSetting_T = ManorRewards_T & { cropId: number, level: number, nextPurchaseLimit: number, unknown: number, minPrice: number, maxPrice: number, todayBuy: number, todayPrice: number, todayRewardType: number, nextBuy: number, nextPrice: number, nextRewardType: number };
export type ManorSellCrop_T = ManorRewards_T & { objectId: number, cropId: number, level: number, procureManorId: number, remaining: number, price: number, rewardType: number, ownedCount: number };
export type ManorProcureCrop_T = { manorId: number, remaining: number, price: number, rewardType: number };
export type ManorSeedInfo_T = { manorId: number, seeds: ManorSeed_T[] };
export type ManorCropInfo_T = { manorId: number, crops: ManorCrop_T[] };
export type ManorSeedSettings_T = { manorId: number, seeds: ManorSeedSetting_T[] };
export type ManorCropSettings_T = { manorId: number, crops: ManorCropSetting_T[] };
export type ManorSellCropList_T = { manorId: number, crops: ManorSellCrop_T[] };
export type ManorProcureCropDetail_T = { cropId: number, manors: ManorProcureCrop_T[] };
export type ProcureCropRequest_T = { objectId: number, itemId: number, manorId: number, count: number };
export type SeedSettingRequest_T = { seedId: number, sales: number, price: number };
export type CropSettingRequest_T = { cropId: number, sales: number, price: number, rewardType: number };

function readListCount(packet: PacketReader, size: number, name: string): number {
    const count = packet.d();

    if (count < 0 || count > Math.trunc(packet.getRemaining() / size)) throw new Error(`Invalid ${name} count ${count}.`);

    return count;
}

function readManorRewards(packet: PacketReader, target: ManorRewards_T) {
    target.reward1Type = packet.c();
    target.reward1ItemId = packet.d();
    target.reward2Type = packet.c();
    target.reward2ItemId = packet.d();
}

export function readEnchantSkillList(packet: PacketReader): EnchantSkill_T[] {
    const count = readListCount(packet, 16, "ExEnchantSkillList");
    const skills = Array.from({ length: count }, () => ({ id: packet.d(), nextLevel: packet.d(), sp: packet.d(), exp: packet.d() }));

    if (packet.getRemaining()) throw new Error("Invalid ExEnchantSkillList trailing data.");

    return skills;
}

export function readEnchantSkillInfo(packet: PacketReader): EnchantSkillInfo_T {
    const id = packet.d(), level = packet.d(), spCost = packet.d(), expCost = packet.d(), rate = packet.d();
    const count = readListCount(packet, 16, "ExEnchantSkillInfo");
    const requirements = Array.from({ length: count }, () => ({ type: packet.d(), itemId: packet.d(), count: packet.d(), unknown: packet.d() }));

    if (id <= 0 || level <= 0 || packet.getRemaining()) throw new Error(`Invalid ExEnchantSkillInfo for skill ${id}.`);

    return { id, level, spCost, expCost, rate, requirements };
}

export function readHeroList(packet: PacketReader): HeroEntry_T[] {
    const count = readListCount(packet, 22, "ExHeroList");
    const heroes = Array.from({ length: count }, () => ({ name: packet.S(), classId: packet.d(), clanName: packet.S(), clanCrestId: packet.d(), allyName: packet.S(), allyCrestId: packet.d(), count: packet.d() }));

    if (packet.getRemaining()) throw new Error("Invalid ExHeroList trailing data.");

    return heroes;
}

export function readCommandChannelInfo(packet: PacketReader): CommandChannelInfo_T {
    const leaderName = packet.S(), memberCount = packet.d();
    const count = readListCount(packet, 6, "ExMultiPartyCommandChannelInfo");
    const parties = Array.from({ length: count }, () => ({ leaderName: packet.S(), memberCount: packet.d() }));

    if (!leaderName || memberCount < 0 || packet.getRemaining()) throw new Error("Invalid ExMultiPartyCommandChannelInfo payload.");

    return { leaderName, memberCount, parties };
}

export function readOlympiadUserInfo(packet: PacketReader): OlympiadUserInfo_T {
    const info = { side: packet.c(), objectId: packet.d(), name: packet.S(), classId: packet.d(), curHp: packet.d(), maxHp: packet.d(), curCp: packet.d(), maxCp: packet.d() };

    if (info.objectId <= 0 || packet.getRemaining()) throw new Error("Invalid ExOlympiadUserInfo payload.");

    return info;
}

export function readOlympiadSpelledInfo(packet: PacketReader): OlympiadSpelledInfo_T {
    const objectId = packet.d();
    const count = readListCount(packet, 10, "ExOlympiadSpelledInfo");
    const effects = Array.from({ length: count }, () => ({ id: packet.d(), level: packet.h(), duration: packet.d() }));

    if (objectId <= 0 || packet.getRemaining()) throw new Error("Invalid ExOlympiadSpelledInfo payload.");

    return { objectId, effects };
}

export function readPartyRoomMember(packet: PacketReader): PartyRoomMember_T {
    const member = { objectId: packet.d(), name: packet.S(), classId: packet.d(), level: packet.d(), location: packet.d(), role: packet.d() };

    if (member.objectId <= 0 || !member.name || member.role < 0 || member.role > 2) throw new Error(`Invalid party room member '${member.name}'.`);

    return member;
}

export function readPartyRoomMembers(packet: PacketReader): PartyRoomMembers_T {
    const mode = packet.d();
    const count = readListCount(packet, 22, "ExPartyRoomMember");
    const members = Array.from({ length: count }, () => readPartyRoomMember(packet));

    if (packet.getRemaining()) throw new Error("Invalid ExPartyRoomMember trailing data.");

    return { mode, members };
}

export function readManorList(packet: PacketReader): ManorEntry_T[] {
    const count = readListCount(packet, 6, "ExSendManorList");
    const manors = Array.from({ length: count }, () => ({ id: packet.d(), name: packet.S() }));

    if (packet.getRemaining()) throw new Error("Invalid ExSendManorList trailing data.");

    return manors;
}

export function readShowSeedInfo(packet: PacketReader): ManorSeedInfo_T {
    packet.c();

    const manorId = packet.d();

    packet.d();

    const count = readListCount(packet, 30, "ExShowSeedInfo");
    const seeds: ManorSeed_T[] = [];

    for (let i = 0; i < count; i++) {
        const seed = { seedId: packet.d(), remaining: packet.d(), startAmount: packet.d(), price: packet.d(), level: packet.d() } as ManorSeed_T;

        readManorRewards(packet, seed);
        seeds.push(seed);
    }

    if (packet.getRemaining()) throw new Error("Invalid ExShowSeedInfo trailing data.");

    return { manorId, seeds };
}

export function readShowCropInfo(packet: PacketReader): ManorCropInfo_T {
    packet.c();

    const manorId = packet.d();

    packet.d();

    const count = readListCount(packet, 31, "ExShowCropInfo");
    const crops: ManorCrop_T[] = [];

    for (let i = 0; i < count; i++) {
        const crop = { cropId: packet.d(), remaining: packet.d(), startAmount: packet.d(), price: packet.d(), rewardType: packet.c(), level: packet.d() } as ManorCrop_T;

        readManorRewards(packet, crop);
        crops.push(crop);
    }

    if (packet.getRemaining()) throw new Error("Invalid ExShowCropInfo trailing data.");

    return { manorId, crops };
}

export function readShowManorDefaultInfo(packet: PacketReader): ManorDefaultCrop_T[] {
    packet.c();

    const count = readListCount(packet, 26, "ExShowManorDefaultInfo");
    const crops: ManorDefaultCrop_T[] = [];

    for (let i = 0; i < count; i++) {
        const crop = { cropId: packet.d(), level: packet.d(), seedPrice: packet.d(), cropPrice: packet.d() } as ManorDefaultCrop_T;

        readManorRewards(packet, crop);
        crops.push(crop);
    }

    if (packet.getRemaining()) throw new Error("Invalid ExShowManorDefaultInfo trailing data.");

    return crops;
}

export function readShowSeedSetting(packet: PacketReader): ManorSeedSettings_T {
    const manorId = packet.d();
    const count = readListCount(packet, 50, "ExShowSeedSetting");
    const seeds: ManorSeedSetting_T[] = [];

    for (let i = 0; i < count; i++) {
        const seed = { seedId: packet.d(), level: packet.d() } as ManorSeedSetting_T;

        readManorRewards(packet, seed);

        seed.nextSaleLimit = packet.d();
        seed.castleProducePrice = packet.d();
        seed.minPrice = packet.d();
        seed.maxPrice = packet.d();
        seed.todaySales = packet.d();
        seed.todayPrice = packet.d();
        seed.nextSales = packet.d();
        seed.nextPrice = packet.d();

        seeds.push(seed);
    }

    if (packet.getRemaining()) throw new Error("Invalid ExShowSeedSetting trailing data.");

    return { manorId, seeds };
}

export function readShowCropSetting(packet: PacketReader): ManorCropSettings_T {
    const manorId = packet.d();
    const count = readListCount(packet, 52, "ExShowCropSetting");
    const crops: ManorCropSetting_T[] = [];

    for (let i = 0; i < count; i++) {
        const crop = { cropId: packet.d(), level: packet.d() } as ManorCropSetting_T;

        readManorRewards(packet, crop);

        crop.nextPurchaseLimit = packet.d();
        crop.unknown = packet.d();
        crop.minPrice = packet.d();
        crop.maxPrice = packet.d();
        crop.todayBuy = packet.d();
        crop.todayPrice = packet.d();
        crop.todayRewardType = packet.c();
        crop.nextBuy = packet.d();
        crop.nextPrice = packet.d();
        crop.nextRewardType = packet.c();

        crops.push(crop);
    }

    if (packet.getRemaining()) throw new Error("Invalid ExShowCropSetting trailing data.");

    return { manorId, crops };
}

export function readShowSellCropList(packet: PacketReader): ManorSellCropList_T {
    const manorId = packet.d();
    const count = readListCount(packet, 39, "ExShowSellCropList");
    const crops: ManorSellCrop_T[] = [];

    for (let i = 0; i < count; i++) {
        const crop = { objectId: packet.d(), cropId: packet.d(), level: packet.d() } as ManorSellCrop_T;

        readManorRewards(packet, crop);

        crop.procureManorId = packet.d();
        crop.remaining = packet.d();
        crop.price = packet.d();
        crop.rewardType = packet.c();
        crop.ownedCount = packet.d();

        if (crop.objectId <= 0 || crop.cropId <= 0 || crop.ownedCount <= 0) throw new Error(`Invalid ExShowSellCropList crop ${crop.cropId}.`);

        crops.push(crop);
    }

    if (packet.getRemaining()) throw new Error("Invalid ExShowSellCropList trailing data.");

    return { manorId, crops };
}

export function readShowProcureCropDetail(packet: PacketReader): ManorProcureCropDetail_T {
    const cropId = packet.d();
    const count = readListCount(packet, 13, "ExShowProcureCropDetail");
    const manors = Array.from({ length: count }, () => ({ manorId: packet.d(), remaining: packet.d(), price: packet.d(), rewardType: packet.c() }));

    if (packet.getRemaining()) throw new Error("Invalid ExShowProcureCropDetail trailing data.");

    return { cropId, manors };
}
