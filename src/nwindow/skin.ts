import type NWnd from "./nwnd";
import SkinTextures from "./skin-textures";
import NCAbnormalStatusWnd from "./nc-abnormal-status-wnd";
import NCActionWnd from "./nc-action-wnd";
import NCChatWnd from "./nc-chat-wnd";
import NCClanWnd from "./nc-clan-wnd";
import NCCommandInfoWnd from "./nc-command-info-wnd";
import NCCommunityWnd from "./nc-community-wnd";
import NCDeliverWnd from "./nc-deliver-wnd";
import NCDetailStatusWnd from "./nc-detail-status-wnd";
import NCDialogBox from "./nc-dialog-box";
import NCFishViewportWnd from "./nc-fish-viewport-wnd";
import NCGMClanWnd from "./nc-gm-clan-wnd";
import NCGMDetailStatusWnd from "./nc-gm-detail-status-wnd";
import NCGMInventoryWnd from "./nc-gm-inventory-wnd";
import NCGMMagicSkillWnd from "./nc-gm-magic-skill-wnd";
import NCGMQuestWnd from "./nc-gm-quest-wnd";
import NCGMStoreWnd from "./nc-gm-store-wnd";
import NCGMWnd from "./nc-gm-wnd";
import NCHennaInfoWnd from "./nc-henna-info-wnd";
import NCHennaListWnd from "./nc-henna-list-wnd";
import NCHeroTowerWnd from "./nc-hero-tower-wnd";
import NCInventoryWnd from "./nc-inventory-wnd";
import NCItemEnchantWnd from "./nc-item-enchant-wnd";
import NCLoadingWnd from "./nc-loading-wnd";
import NCLobbyWnd from "./nc-lobby-wnd";
import NCLoginServerWnd from "./nc-server-select-wnd";
import NCLoginWnd from "./nc-login-wnd";
import NCReplayWnd from "./nc-replay-wnd";
import NCMacroWnd from "./nc-macro-wnd";
import NCMainWnd from "./nc-main-wnd";
import NCManorShopWnd from "./nc-manor-shop-wnd";
import NCMapWnd from "./nc-map-wnd";
import NTownMapWnd from "./n-town-map-wnd";
import NCMatchWnd from "./nc-match-wnd";
import NCMenuWnd from "./nc-menu-wnd";
import NCMessageWnd from "./nc-message-wnd";
import NCNPCHtmlViewer from "./nc-npc-html-viewer";
import NCOlympiadControlWnd from "./nc-olympiad-control-wnd";
import NCOlympiadPlayerWnd from "./nc-olympiad-player-wnd";
import NCOlympiadTargetWnd from "./nc-olympiad-target-wnd";
import NCOptionWnd from "./nc-option-wnd";
import NCPartyRoomMakingWnd from "./nc-party-room-making-wnd";
import NCPartyRoomWnd from "./nc-party-room-wnd";
import NCPawnCreateWnd from "./nc-pawn-create-wnd";
import NCPetStatusWnd from "./nc-pet-status-wnd";
import NCPetWnd from "./nc-pet-wnd";
import NCPlayerStatusWnd from "./nc-player-status-wnd";
import NCPledgePowerWnd from "./nc-pledge-power-wnd";
import NCPrivateBuyWnd from "./nc-private-buy-wnd";
import NCPrivateShopWnd from "./nc-private-shop-wnd";
import NCQuestWnd from "./nc-quest-wnd";
import NCRecipeBookWnd from "./nc-recipe-book-wnd";
import NCRecipeBuyListWnd from "./nc-recipe-buy-list-wnd";
import NCRecipeBuyManufactureWnd from "./nc-recipe-buy-manufacture-wnd";
import NCRecipeManufactureWnd from "./nc-recipe-manufacture-wnd";
import NCRecipeShopWnd from "./nc-recipe-shop-wnd";
import NCRecipeTreeWnd from "./nc-recipe-tree-wnd";
import NCRestartMenuWnd from "./nc-restart-menu-wnd";
import NCSSQMainBoard from "./nc-ssq-main-board";
import NCSelectDeliverWnd from "./nc-select-deliver-wnd";
import NCShopWnd from "./nc-shop-wnd";
import NCShortCutWnd from "./nc-shortcut-wnd";
import NCSkillWnd from "./nc-skill-wnd";
import NCStoreWnd from "./nc-store-wnd";
import NCSummonedWnd from "./nc-summoned-wnd";
import NCSystemMenuWnd from "./nc-system-menu-wnd";
import NCTargetStatusWnd from "./nc-target-status-wnd";
import NCTradeWnd from "./nc-trade-wnd";
import NCTrainWnd from "./nc-train-wnd";
import NCVIPShopWnd from "./nc-vip-shop-wnd";
import NCZoneTitleWnd from "./nc-zone-title-wnd";
import RecordMark from "./record-mark";

export type AbnormalStatusWndView_T = NWnd & Pick<NCAbnormalStatusWnd, "getEffects" | "setEffects" | "setSecondaryEffects" | "setShortEffect" | "setVisible" | "tick">;
export type ActionWndView_T = Pick<NCActionWnd, "clearSelection" | "element" | "onUse" | "setActions" | "setClass" | "setMountable">;
export type ChatWndView_T = NWnd & Pick<NCChatWnd, "addCreatureSay" | "addSystemMessage" | "dispatchCommand" | "focusInput" | "isInputFocused" | "onBuildCommand" | "onCommand" | "onSend" | "placeOnScreen" | "sendText" | "setOldChatting" | "setSystemMessageFilters" | "setSystemMsgWnd" | "setVisible">;
export type ClanWndView_T = Pick<NCClanWnd, "addMember" | "clearMembers" | "deleteMember" | "element" | "onAction" | "setClan" | "setStatus" | "setStrings" | "setVisible" | "updateMember">;
export type CommandInfoWndView_T = Pick<NCCommandInfoWnd, "addChat" | "closeChannel" | "element" | "isVisible" | "onLeave" | "onOust" | "onSay" | "onUpdate" | "open" | "placeOnScreen" | "setInfo" | "setVisible" | "tick">;
export type CommunityWndView_T = Pick<NCCommunityWnd, "element" | "hide" | "isVisible" | "onAction" | "onRequest" | "openClan" | "placeOnScreen" | "setBoard" | "setVisible" | "toggle" | "viewer">;
export type DeliverWndView_T = Pick<NCDeliverWnd, "element" | "getGrid" | "getItems" | "getPressedItem" | "getTargetId" | "isPreviewMode" | "isSellMode" | "isStoreMode" | "isVisible" | "onConfirm" | "onFocusDialog" | "onHide" | "onHideTooltip" | "onMove" | "onSelect" | "onTooltip" | "placeOnScreen" | "setVisible" | "showPackage" | "transfer">;
export type DetailStatusWndView_T = Pick<NCDetailStatusWnd, "element" | "setClan" | "setHenna" | "setStatus">;
export type DialogBoxView_T = Pick<NCDialogBox, "element" | "focus" | "hide" | "isInGame" | "isOpen" | "isYesNo" | "owner" | "placeOnScreen" | "show" | "showQuantity" | "showText" | "textEditor">;
export type FishViewportWndView_T = Pick<NCFishViewportWnd, "element" | "end" | "getViewportCanvas" | "init" | "isVisible" | "placeOnScreen" | "setVisible" | "start" | "tick" | "update">;
export type GMClanWndView_T = Pick<NCGMClanWnd, "element" | "isVisible" | "onAction" | "onRequest" | "placeOnScreen" | "setInfo" | "setStatus" | "setStrings" | "setVisible" | "toggle">;
export type GMDetailStatusWndView_T = Pick<NCGMDetailStatusWnd, "element" | "isVisible" | "onRequest" | "placeOnScreen" | "setCharacterInfo" | "setClan" | "setVisible" | "toggle">;
export type GMInventoryWndView_T = Pick<NCGMInventoryWnd, "element" | "isVisible" | "onRequest" | "placeOnScreen" | "setInventoryInfo" | "setVisible" | "toggle">;
export type GMMagicSkillWndView_T = Pick<NCGMMagicSkillWnd, "element" | "isVisible" | "onRequest" | "placeOnScreen" | "setSkillInfo" | "setVisible" | "skillWnd" | "toggle">;
export type GMQuestWndView_T = Pick<NCGMQuestWnd, "element" | "isVisible" | "onRequest" | "onShowQuestList" | "placeOnScreen" | "setQuestList" | "setVisible" | "toggle">;
export type GMStoreWndView_T = Pick<NCGMStoreWnd, "element" | "getGrid" | "getItems" | "getLogicalSide" | "getPressedItem" | "isPreviewMode" | "isSellMode" | "isStoreMode" | "isVisible" | "onConfirm" | "onDrop" | "onFocusDialog" | "onHide" | "onHideTooltip" | "onMove" | "onQuantity" | "onRequest" | "onSelect" | "onTooltip" | "onTransfer" | "paintItems" | "placeOnScreen" | "setDestination" | "setVisible" | "setWarehouseInfo" | "toggle" | "transfer" | "transferQuantity">;
export type GMWndView_T = Pick<NCGMWnd, "element" | "isVisible" | "onCommand" | "onConfirm" | "onInfo" | "onMessage" | "onServerTransfer" | "onView" | "placeOnScreen" | "setPlayerName" | "setVisible" | "toggle">;
export type HennaInfoWndView_T = Pick<NCHennaInfoWnd, "element" | "isVisible" | "onBack" | "onConfirm" | "placeOnScreen" | "setVisible" | "show">;
export type HennaListWndView_T = Pick<NCHennaListWnd, "clear" | "element" | "isVisible" | "onOpen" | "placeOnScreen" | "setVisible" | "show">;
export type HeroTowerWndView_T = Pick<NCHeroTowerWnd, "element" | "isVisible" | "onDiary" | "onWriteWords" | "placeOnScreen" | "setCrestGetter" | "setVisible" | "show">;
export type InventoryWndView_T = Pick<NCInventoryWnd, "clearChoice" | "element" | "getEnchantItems" | "getItemLines" | "getItemOwner" | "getItemTitle" | "hideTooltip" | "isItemDropTarget" | "isVisible" | "onChoose" | "onCrystallize" | "onDestroy" | "onDropItem" | "onEquip" | "onHideBag" | "onUnequip" | "onUse" | "placeOnScreen" | "saveOrder" | "setDwarvenCraft" | "setItems" | "setLimit" | "setOrderOwner" | "setVisible" | "setWeight" | "showTooltip" | "updateOrder">;
export type ItemEnchantWndView_T = Pick<NCItemEnchantWnd, "element" | "isVisible" | "onConfirm" | "onHideTooltip" | "onTooltip" | "placeOnScreen" | "setVisible" | "show">;
export type LoadingWndView_T = Pick<NCLoadingWnd, "element" | "placeOnScreen" | "setBlack" | "setVisible">;
export type LobbyWndView_T = Pick<NCLobbyWnd, "element" | "gameStart" | "onCreate" | "onDelete" | "onRelogin" | "onRestore" | "onSelect" | "onStart" | "onSystemMessage" | "pick" | "placeOnScreen" | "setCharacters" | "setPawnLabels" | "setSelected" | "setVisible">;
export type LoginServerWndView_T = Pick<NCLoginServerWnd, "element" | "onCancel" | "onSelect" | "placeOnScreen" | "serverInfo" | "setServers" | "setVisible">;
export type ReplayWndView_T = Pick<NCReplayWnd, "element" | "focus" | "onPlay" | "onDelete" | "onCancel" | "onImport" | "placeOnScreen" | "setFiles" | "setVisible">;
export type LoginWndView_T = Pick<NCLoginWnd, "auth" | "element" | "loginFunction" | "onLogin" | "placeOnScreen" | "setBusy" | "setVisible">;
export type MacroWndView_T = Pick<NCMacroWnd, "dropAction" | "dropCommand" | "element" | "hide" | "highlightCommand" | "isVisible" | "onDelete" | "onDrop" | "onError" | "onHelp" | "onSave" | "onUse" | "placeOnScreen" | "setMacros" | "setVisible">;
export type MainWndView_T = Pick<NCMainWnd, "element" | "getSelectedTab" | "isVisible" | "placeOnScreen" | "selectTab" | "setVisible"> & { readonly detailStatusWnd: DetailStatusWndView_T, readonly skillWnd: SkillWndView_T, readonly actionWnd: ActionWndView_T, readonly questWnd: QuestWndView_T, readonly clanWnd: ClanWndView_T };
export type ManorShopWndView_T = Pick<NCManorShopWnd, "element" | "getGrid" | "getItems" | "getPressedItem" | "isPreviewMode" | "isSellMode" | "isStoreMode" | "isVisible" | "onConfirm" | "onFocusDialog" | "onHide" | "onHideTooltip" | "onMove" | "onQuantity" | "onSelect" | "onSubmit" | "onTooltip" | "placeOnScreen" | "setVisible" | "showManor" | "transfer">;
export type TownMapWndView_T = Pick<NTownMapWnd, "element" | "isVisible" | "placeOnScreen" | "setVisible" | "show">;
export type MapWndView_T = Pick<NCMapWnd, "element" | "isVisible" | "openPosition" | "placeOnScreen" | "setFacing" | "setPartyMembers" | "setPosition" | "setQuestLocation" | "setTargetLocations" | "setTime" | "setVisible">;
export type MatchWndView_T = Pick<NCMatchWnd, "element" | "isVisible" | "onConfig" | "onCreate" | "onJoin" | "placeOnScreen" | "resetFilters" | "setVisible" | "show" | "tick">;
export type MenuWndView_T = Pick<NCMenuWnd, "element" | "onSelect" | "placeOnScreen" | "setVisible">;
export type MessageWndView_T = Pick<NCMessageWnd, "element" | "hide" | "placeOnScreen" | "show">;
export type NPCHtmlViewerView_T = Pick<NCNPCHtmlViewer, "element" | "hide" | "isVisible" | "onBypass" | "onFile" | "onLink" | "placeOnScreen" | "setVisible" | "show" | "showPacket" | "tick">;
export type OlympiadControlWndView_T = Pick<NCOlympiadControlWnd, "element" | "isVisible" | "onOtherGame" | "onStopObserving" | "placeOnScreen" | "setVisible">;
export type OlympiadPlayerWndView_T = NWnd & Pick<NCOlympiadPlayerWnd, "appendMessage" | "getObjectId" | "onExpand" | "placeOnScreen" | "reset" | "setInfo" | "setVisible">;
export type OlympiadTargetWndView_T = NWnd & Pick<NCOlympiadTargetWnd, "getSide" | "initialize" | "placeOnScreen" | "reset" | "setInfo" | "setVisible">;
export type OptionWndView_T = Pick<NCOptionWnd, "canChangePartyLoot" | "element" | "getAudioOptions" | "getGamma" | "getOptions" | "getPawnRange" | "getUIScale" | "getUIScales" | "isVisible" | "onApply" | "onApplyAudio" | "onApplyGamma" | "onApplyPawnRange" | "onApplyUIScale" | "onInitialize" | "placeOnScreen" | "setVisible" | "toggle" | "updatePartyLootControl">;
export type PartyRoomMakingWndView_T = Pick<NCPartyRoomMakingWnd, "element" | "getLootType" | "isVisible" | "onSubmit" | "placeOnScreen" | "setVisible" | "showCreate" | "showEdit">;
export type PartyRoomWndView_T = Pick<NCPartyRoomWnd, "appendChat" | "clearChat" | "element" | "isVisible" | "minimized" | "onChat" | "onInvite" | "onKick" | "onSettings" | "onTerminate" | "placeOnScreen" | "setMembers" | "setVisible" | "show" | "table" | "tick">;
export type PawnCreateWndView_T = Pick<NCPawnCreateWnd, "element" | "getTemplate" | "onBack" | "onChange" | "onCreate" | "onRotate" | "onZoom" | "placeOnScreen" | "setTemplates" | "setVisible">;
export type PetStatusWndView_T = NWnd & Pick<NCPetStatusWnd, "onTargetAction" | "resetGauge" | "setEffects" | "setInfo" | "setRemainTime" | "setVisible" | "showStatus" | "tick">;
export type PetWndView_T = Pick<NCPetWnd, "element" | "getItemOwner" | "isVisible" | "onAction" | "onDropItem" | "onGetItem" | "onHideBag" | "onRename" | "onUseItem" | "setActions" | "setInfo" | "setItems" | "setRenameAvailable" | "setVisible">;
export type PlayerStatusWndView_T = NWnd & Pick<NCPlayerStatusWnd, "onClick" | "setStatus" | "setVisible">;
export type PledgePowerWndView_T = Pick<NCPledgePowerWnd, "element" | "onSave" | "placeOnScreen" | "setPower" | "setVisible" | "showFor">;
export type PrivateBuyWndView_T = Pick<NCPrivateBuyWnd, "canMove" | "element" | "getGrid" | "getItems" | "getMaxCount" | "getOwnedCount" | "getOwnerId" | "getPressedItem" | "getTooltipCount" | "isOwnMode" | "isPreviewMode" | "isSellMode" | "isStoreMode" | "isVisible" | "needsPriceConfirmation" | "onClose" | "onConfirm" | "onFocusDialog" | "onHide" | "onHideTooltip" | "onMessage" | "onMove" | "onQuit" | "onSelect" | "onTooltip" | "placeOnScreen" | "setLimit" | "setVisible" | "showBuyStore" | "showManageBuyStore" | "transfer">;
export type PrivateShopWndView_T = Pick<NCPrivateShopWnd, "element" | "getGrid" | "getItems" | "getOriginalCount" | "getOwnerId" | "getPackageChecked" | "getPressedItem" | "isOwnMode" | "isPackageMode" | "isPreviewMode" | "isSellMode" | "isStoreMode" | "isVisible" | "needsPriceConfirmation" | "onClose" | "onConfirm" | "onFocusDialog" | "onHide" | "onHideTooltip" | "onMessage" | "onMove" | "onQuit" | "onSelect" | "onTooltip" | "placeOnScreen" | "setLimit" | "setVisible" | "showManageStore" | "showStore" | "transfer">;
export type QuestWndView_T = Pick<NCQuestWnd, "clearLocation" | "element" | "onAbort" | "onHide" | "onLocationChange" | "onShow" | "setInventory" | "setStates" | "setStrings" | "setVisible">;
export type RecipeBookWndView_T = Pick<NCRecipeBookWnd, "element" | "getGrid" | "isVisible" | "onDelete" | "onDrop" | "onHide" | "onHideTooltip" | "onOpen" | "onTooltip" | "placeOnScreen" | "setLimits" | "setVisible" | "show">;
export type RecipeBuyListWndView_T = Pick<NCRecipeBuyListWnd, "element" | "isVisible" | "onOpen" | "placeOnScreen" | "setVisible" | "show">;
export type RecipeBuyManufactureWndView_T = Pick<NCRecipeBuyManufactureWnd, "element" | "getGrid" | "isVisible" | "onFocusDialog" | "onHide" | "onHideTooltip" | "onSelect" | "onShopBack" | "onShopCreate" | "onTooltip" | "onTree" | "placeOnScreen" | "setInventory" | "setVisible" | "showShop">;
export type RecipeManufactureWndView_T = Pick<NCRecipeManufactureWnd, "element" | "getGrid" | "isVisible" | "onBack" | "onCreate" | "onFocusDialog" | "onHide" | "onHideTooltip" | "onSelect" | "onTooltip" | "onTree" | "placeOnScreen" | "setInventory" | "setVisible" | "show">;
export type RecipeShopWndView_T = Pick<NCRecipeShopWnd, "element" | "getGrid" | "isVisible" | "onCancel" | "onHideTooltip" | "onMessage" | "onPrice" | "onQuit" | "onStart" | "onTooltip" | "placeOnScreen" | "setVisible" | "show" | "transfer">;
export type RecipeTreeWndView_T = Pick<NCRecipeTreeWnd, "element" | "isVisible" | "placeOnScreen" | "setVisible" | "show">;
export type RestartMenuWndView_T = NWnd & Pick<NCRestartMenuWnd, "onRestart" | "placeOnScreen" | "setOptions" | "setVisible">;
export type SSQMainBoardView_T = Pick<NCSSQMainBoard, "element" | "isVisible" | "onRequest" | "placeOnScreen" | "setVisible" | "show">;
export type SelectDeliverWndView_T = Pick<NCSelectDeliverWnd, "element" | "isVisible" | "onConfirm" | "placeOnScreen" | "setVisible" | "show">;
export type ShopWndView_T = Pick<NCShopWnd, "element" | "getGrid" | "getItems" | "getPressedItem" | "isPreviewMode" | "isSellMode" | "isStoreMode" | "isVisible" | "onConfirm" | "onFocusDialog" | "onHide" | "onHideTooltip" | "onMove" | "onSelect" | "onTooltip" | "placeOnScreen" | "setVisible" | "show" | "transfer">;
export type ShortCutWndView_T = NWnd & Pick<NCShortCutWnd, "clearSlots" | "getPage" | "getScreenX" | "getScreenY" | "getSlotAt" | "hasCoolTime" | "onAutoSoulShot" | "onDelete" | "onDrag" | "onDragMove" | "onDrop" | "onMove" | "onUse" | "placeOnScreen" | "setSlot" | "setVisible">;
export type SkillWndView_T = Pick<NCSkillWnd, "clearSelection" | "element" | "getMacroCommand" | "isVisible" | "onShow" | "onUse" | "renderCoolTimes" | "setSkills" | "setVisible">;
export type StoreWndView_T = Pick<NCStoreWnd, "element" | "getGrid" | "getItems" | "getLogicalSide" | "getPressedItem" | "isPreviewMode" | "isSellMode" | "isStoreMode" | "isVisible" | "onConfirm" | "onDrop" | "onFocusDialog" | "onHide" | "onHideTooltip" | "onMove" | "onSelect" | "onTooltip" | "onTransfer" | "paintItems" | "placeOnScreen" | "setDestination" | "setLimit" | "setVisible" | "showWarehouse" | "transfer" | "updateFee">;
export type SummonedWndView_T = Pick<NCSummonedWnd, "element" | "isVisible" | "onAction" | "setActions" | "setInfo" | "setVisible">;
export type SystemMenuWndView_T = Pick<NCSystemMenuWnd, "element" | "isVisible" | "onSelect" | "placeOnScreen" | "setVisible">;
export type TargetStatusWndView_T = NWnd & Pick<NCTargetStatusWnd, "onClose" | "placeOnScreen" | "setTarget">;
export type TradeWndView_T = Pick<NCTradeWnd, "clearSelection" | "element" | "getPressedItem" | "isVisible" | "onConfirm" | "onFocusDialog" | "onHideTooltip" | "onOffer" | "onSelect" | "onTooltip" | "placeOnScreen" | "recalculateRows" | "reset" | "setItems" | "setNames" | "setVisible">;
export type TrainWndView_T = Pick<NCTrainWnd, "element" | "isVisible" | "onAquire" | "onAquireInfo" | "onEnchant" | "onInfo" | "placeOnScreen" | "setStatus" | "setVisible" | "showAquireInfo" | "showAquireList" | "showEnchantInfo" | "showEnchantList">;
export type VIPShopWndView_T = Pick<NCVIPShopWnd, "clear" | "element" | "isVisible" | "onConfirm" | "onHide" | "onSelect" | "placeOnScreen" | "setVisible" | "show">;
export type ZoneTitleWndView_T = Pick<NCZoneTitleWnd, "clear" | "element" | "placeOnScreen" | "reset" | "tick" | "updateZone">;
export type RecordMarkView_T = Pick<RecordMark, "element" | "placeOnScreen" | "setVisible" | "update">;

export class Skin {
    public constructor(public readonly textures: SkinTextures = new SkinTextures()) { }

    public createAbnormalStatusWnd(...args: ConstructorParameters<typeof NCAbnormalStatusWnd>): AbnormalStatusWndView_T { return new NCAbnormalStatusWnd(...args); }
    public createActionWnd(...args: ConstructorParameters<typeof NCActionWnd>): ActionWndView_T { return new NCActionWnd(...args); }
    public createChatWnd(...args: ConstructorParameters<typeof NCChatWnd>): ChatWndView_T { return new NCChatWnd(...args); }
    public createClanWnd(...args: ConstructorParameters<typeof NCClanWnd>): ClanWndView_T { return new NCClanWnd(...args); }
    public createCommandInfoWnd(...args: ConstructorParameters<typeof NCCommandInfoWnd>): CommandInfoWndView_T { return new NCCommandInfoWnd(...args); }
    public createCommunityWnd(...args: ConstructorParameters<typeof NCCommunityWnd>): CommunityWndView_T { return new NCCommunityWnd(...args); }
    public createDeliverWnd(...args: ConstructorParameters<typeof NCDeliverWnd>): DeliverWndView_T { return new NCDeliverWnd(...args); }
    public createDetailStatusWnd(...args: ConstructorParameters<typeof NCDetailStatusWnd>): DetailStatusWndView_T { return new NCDetailStatusWnd(...args); }
    public createDialogBox(...args: ConstructorParameters<typeof NCDialogBox>): DialogBoxView_T { return new NCDialogBox(...args); }
    public createFishViewportWnd(...args: ConstructorParameters<typeof NCFishViewportWnd>): FishViewportWndView_T { return new NCFishViewportWnd(...args); }
    public createGMClanWnd(...args: ConstructorParameters<typeof NCGMClanWnd>): GMClanWndView_T { return new NCGMClanWnd(...args); }
    public createGMDetailStatusWnd(...args: ConstructorParameters<typeof NCGMDetailStatusWnd>): GMDetailStatusWndView_T { return new NCGMDetailStatusWnd(...args); }
    public createGMInventoryWnd(...args: ConstructorParameters<typeof NCGMInventoryWnd>): GMInventoryWndView_T { return new NCGMInventoryWnd(...args); }
    public createGMMagicSkillWnd(...args: ConstructorParameters<typeof NCGMMagicSkillWnd>): GMMagicSkillWndView_T { return new NCGMMagicSkillWnd(...args); }
    public createGMQuestWnd(...args: ConstructorParameters<typeof NCGMQuestWnd>): GMQuestWndView_T { return new NCGMQuestWnd(...args); }
    public createGMStoreWnd(...args: ConstructorParameters<typeof NCGMStoreWnd>): GMStoreWndView_T { return new NCGMStoreWnd(...args); }
    public createGMWnd(...args: ConstructorParameters<typeof NCGMWnd>): GMWndView_T { return new NCGMWnd(...args); }
    public createHennaInfoWnd(...args: ConstructorParameters<typeof NCHennaInfoWnd>): HennaInfoWndView_T { return new NCHennaInfoWnd(...args); }
    public createHennaListWnd(...args: ConstructorParameters<typeof NCHennaListWnd>): HennaListWndView_T { return new NCHennaListWnd(...args); }
    public createHeroTowerWnd(...args: ConstructorParameters<typeof NCHeroTowerWnd>): HeroTowerWndView_T { return new NCHeroTowerWnd(...args); }
    public createInventoryWnd(...args: ConstructorParameters<typeof NCInventoryWnd>): InventoryWndView_T { return new NCInventoryWnd(...args); }
    public createItemEnchantWnd(...args: ConstructorParameters<typeof NCItemEnchantWnd>): ItemEnchantWndView_T { return new NCItemEnchantWnd(...args); }
    public createLoadingWnd(...args: ConstructorParameters<typeof NCLoadingWnd>): LoadingWndView_T { return new NCLoadingWnd(...args); }
    public createLobbyWnd(...args: ConstructorParameters<typeof NCLobbyWnd>): LobbyWndView_T { return new NCLobbyWnd(...args); }
    public createLoginServerWnd(...args: ConstructorParameters<typeof NCLoginServerWnd>): LoginServerWndView_T { return new NCLoginServerWnd(...args); }
    public createReplayWnd(...args: ConstructorParameters<typeof NCReplayWnd>): ReplayWndView_T { return new NCReplayWnd(...args); }
    public createLoginWnd(...args: ConstructorParameters<typeof NCLoginWnd>): LoginWndView_T { return new NCLoginWnd(...args); }
    public createMacroWnd(...args: ConstructorParameters<typeof NCMacroWnd>): MacroWndView_T { return new NCMacroWnd(...args); }
    public createMainWnd(...args: ConstructorParameters<typeof NCMainWnd>): MainWndView_T { return new NCMainWnd(...args); }
    public createManorShopWnd(...args: ConstructorParameters<typeof NCManorShopWnd>): ManorShopWndView_T { return new NCManorShopWnd(...args); }
    public createTownMapWnd(...args: ConstructorParameters<typeof NTownMapWnd>): TownMapWndView_T { return new NTownMapWnd(...args); }
    public createMapWnd(...args: ConstructorParameters<typeof NCMapWnd>): MapWndView_T { return new NCMapWnd(...args); }
    public createMatchWnd(...args: ConstructorParameters<typeof NCMatchWnd>): MatchWndView_T { return new NCMatchWnd(...args); }
    public createMenuWnd(...args: ConstructorParameters<typeof NCMenuWnd>): MenuWndView_T { return new NCMenuWnd(...args); }
    public createMessageWnd(...args: ConstructorParameters<typeof NCMessageWnd>): MessageWndView_T { return new NCMessageWnd(...args); }
    public createNPCHtmlViewer(...args: ConstructorParameters<typeof NCNPCHtmlViewer>): NPCHtmlViewerView_T { return new NCNPCHtmlViewer(...args); }
    public createOlympiadControlWnd(...args: ConstructorParameters<typeof NCOlympiadControlWnd>): OlympiadControlWndView_T { return new NCOlympiadControlWnd(...args); }
    public createOlympiadPlayerWnd(...args: ConstructorParameters<typeof NCOlympiadPlayerWnd>): OlympiadPlayerWndView_T { return new NCOlympiadPlayerWnd(...args); }
    public createOlympiadTargetWnd(...args: ConstructorParameters<typeof NCOlympiadTargetWnd>): OlympiadTargetWndView_T { return new NCOlympiadTargetWnd(...args); }
    public createOptionWnd(...args: ConstructorParameters<typeof NCOptionWnd>): OptionWndView_T { return new NCOptionWnd(...args); }
    public createPartyRoomMakingWnd(...args: ConstructorParameters<typeof NCPartyRoomMakingWnd>): PartyRoomMakingWndView_T { return new NCPartyRoomMakingWnd(...args); }
    public createPartyRoomWnd(...args: ConstructorParameters<typeof NCPartyRoomWnd>): PartyRoomWndView_T { return new NCPartyRoomWnd(...args); }
    public createPawnCreateWnd(...args: ConstructorParameters<typeof NCPawnCreateWnd>): PawnCreateWndView_T { return new NCPawnCreateWnd(...args); }
    public createPetStatusWnd(...args: ConstructorParameters<typeof NCPetStatusWnd>): PetStatusWndView_T { return new NCPetStatusWnd(...args); }
    public createPetWnd(...args: ConstructorParameters<typeof NCPetWnd>): PetWndView_T { return new NCPetWnd(...args); }
    public createPlayerStatusWnd(...args: ConstructorParameters<typeof NCPlayerStatusWnd>): PlayerStatusWndView_T { return new NCPlayerStatusWnd(...args); }
    public createPledgePowerWnd(...args: ConstructorParameters<typeof NCPledgePowerWnd>): PledgePowerWndView_T { return new NCPledgePowerWnd(...args); }
    public createPrivateBuyWnd(...args: ConstructorParameters<typeof NCPrivateBuyWnd>): PrivateBuyWndView_T { return new NCPrivateBuyWnd(...args); }
    public createPrivateShopWnd(...args: ConstructorParameters<typeof NCPrivateShopWnd>): PrivateShopWndView_T { return new NCPrivateShopWnd(...args); }
    public createQuestWnd(...args: ConstructorParameters<typeof NCQuestWnd>): QuestWndView_T { return new NCQuestWnd(...args); }
    public createRecipeBookWnd(...args: ConstructorParameters<typeof NCRecipeBookWnd>): RecipeBookWndView_T { return new NCRecipeBookWnd(...args); }
    public createRecipeBuyListWnd(...args: ConstructorParameters<typeof NCRecipeBuyListWnd>): RecipeBuyListWndView_T { return new NCRecipeBuyListWnd(...args); }
    public createRecipeBuyManufactureWnd(...args: ConstructorParameters<typeof NCRecipeBuyManufactureWnd>): RecipeBuyManufactureWndView_T { return new NCRecipeBuyManufactureWnd(...args); }
    public createRecipeManufactureWnd(...args: ConstructorParameters<typeof NCRecipeManufactureWnd>): RecipeManufactureWndView_T { return new NCRecipeManufactureWnd(...args); }
    public createRecipeShopWnd(...args: ConstructorParameters<typeof NCRecipeShopWnd>): RecipeShopWndView_T { return new NCRecipeShopWnd(...args); }
    public createRecipeTreeWnd(...args: ConstructorParameters<typeof NCRecipeTreeWnd>): RecipeTreeWndView_T { return new NCRecipeTreeWnd(...args); }
    public createRestartMenuWnd(...args: ConstructorParameters<typeof NCRestartMenuWnd>): RestartMenuWndView_T { return new NCRestartMenuWnd(...args); }
    public createSSQMainBoard(...args: ConstructorParameters<typeof NCSSQMainBoard>): SSQMainBoardView_T { return new NCSSQMainBoard(...args); }
    public createSelectDeliverWnd(...args: ConstructorParameters<typeof NCSelectDeliverWnd>): SelectDeliverWndView_T { return new NCSelectDeliverWnd(...args); }
    public createShopWnd(...args: ConstructorParameters<typeof NCShopWnd>): ShopWndView_T { return new NCShopWnd(...args); }
    public createShortCutWnd(...args: ConstructorParameters<typeof NCShortCutWnd>): ShortCutWndView_T { return new NCShortCutWnd(...args); }
    public createSkillWnd(...args: ConstructorParameters<typeof NCSkillWnd>): SkillWndView_T { return new NCSkillWnd(...args); }
    public createStoreWnd(...args: ConstructorParameters<typeof NCStoreWnd>): StoreWndView_T { return new NCStoreWnd(...args); }
    public createSummonedWnd(...args: ConstructorParameters<typeof NCSummonedWnd>): SummonedWndView_T { return new NCSummonedWnd(...args); }
    public createSystemMenuWnd(...args: ConstructorParameters<typeof NCSystemMenuWnd>): SystemMenuWndView_T { return new NCSystemMenuWnd(...args); }
    public createTargetStatusWnd(...args: ConstructorParameters<typeof NCTargetStatusWnd>): TargetStatusWndView_T { return new NCTargetStatusWnd(...args); }
    public createTradeWnd(...args: ConstructorParameters<typeof NCTradeWnd>): TradeWndView_T { return new NCTradeWnd(...args); }
    public createTrainWnd(...args: ConstructorParameters<typeof NCTrainWnd>): TrainWndView_T { return new NCTrainWnd(...args); }
    public createVIPShopWnd(...args: ConstructorParameters<typeof NCVIPShopWnd>): VIPShopWndView_T { return new NCVIPShopWnd(...args); }
    public createZoneTitleWnd(...args: ConstructorParameters<typeof NCZoneTitleWnd>): ZoneTitleWndView_T { return new NCZoneTitleWnd(...args); }
    public createRecordMark(...args: ConstructorParameters<typeof RecordMark>): RecordMarkView_T { return new RecordMark(...args); }
}

export default Skin;
