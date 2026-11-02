import type NetworkManager from "./network-manager";
import { CHARACTER_FULL_ARMOR_SLOT, CHARACTER_ALLDRESS_SLOT } from "@l2js/engine/datafile/schema/armorgrp.schema";
import * as GamePackets from "./game-packets";
import PacketReader from "./packet-reader";

export class NetworkItems {
    public readonly shortcuts = new Map<number, GamePackets.ShortCut_T>();
    public readonly autoSoulShots = new Set<number>();
    public readonly inventory = new Map<number, GamePackets.InventoryItem_T>();
    public inventoryOrderNamespace = 0;
    public storageMaxCount: GamePackets.StorageMaxCount_T = null;
    public readonly skills = new Map<number, GamePackets.SkillEntry_T>();
    public readonly questStates = new Map<number, GamePackets.QuestState_T>();
    public hennaStatus: GamePackets.HennaStatus_T = null;
    public isMacroListComplete = true;
    public macroListReceived = 0;
    public readonly macros = new Map<number, GamePackets.Macro_T>();
    public aquireSkillFishing = false;
    public aquireSkills: GamePackets.AquireSkillEntry_T[] = [];
    public aquireSkillInfo: GamePackets.AquireSkillInfo_T = null;
    public tradePartnerId = 0;
    public tradeRequestId = 0;
    public readonly tradeOwnItems: GamePackets.TradeItem_T[] = [];
    public readonly tradeOtherItems: GamePackets.TradeItem_T[] = [];
    public readonly tradeAvailableItems: GamePackets.TradeItem_T[] = [];
    public tradeDone = 0;
    public shopSellMoney = 0;
    public shopSellNpcId = 0;
    public readonly shopSellItems: GamePackets.ShopItem_T[] = [];
    public shopBuyMoney = 0;
    public shopBuyListId = 0;
    public readonly shopBuyItems: GamePackets.ShopItem_T[] = [];
    public etcStatus: { charges: number, weightPenalty: number, messageRefusal: number, dangerArea: number, expertisePenalty: number } = null;
    public readonly petInventory = new Map<number, GamePackets.InventoryItem_T>();
    public readonly abnormalStatuses: GamePackets.AbnormalStatus_T[] = [];
    public shortBuff: GamePackets.AbnormalStatus_T = null;
    public skillListLoad: Promise<void> = null;
    public resolveSkillList: () => void = null;
    public warehouseDeposit: GamePackets.WarehouseList_T = null;
    public warehouseWithdraw: GamePackets.WarehouseList_T = null;
    public privateStoreManageSell: GamePackets.PrivateStoreManageSell_T = null;
    public privateStoreSell: GamePackets.PrivateStoreSellList_T = null;
    public privateStoreManageBuy: GamePackets.PrivateStoreManageBuy_T = null;
    public privateStoreBuy: GamePackets.PrivateStoreBuyList_T = null;
    public readonly privateStoreSellMsgs = new Map<number, string>();
    public readonly privateStoreBuyMsgs = new Map<number, string>();
    public readonly packageTargets = new Map<number, string>();
    public packageSendable: GamePackets.PackageSendableList_T = null;
    public multiSell: GamePackets.MultiSellList_T = null;
    public shopPreview: GamePackets.ShopPreviewList_T = null;
    public shopPreviewItems: number[] = null;
    public seedShop: GamePackets.BuyListSeed_T = null;
    public cropProcure: GamePackets.SellListProcure_T = null;
    public recipeBook: GamePackets.RecipeBook_T = null;
    public recipeItemMakeInfo: GamePackets.RecipeItemMakeInfo_T = null;
    public recipeShopManageList: GamePackets.RecipeShopManageList_T = null;
    public recipeShopSellList: GamePackets.RecipeShopSellList_T = null;
    public recipeShopItemInfo: GamePackets.RecipeShopItemInfo_T = null;
    public readonly recipeShopMessages = new Map<number, string>();
    public hennaEquipList: GamePackets.HennaEquipList_T = null;
    public hennaItemInfo: GamePackets.HennaItemInfo_T = null;
    public enchantSkills: GamePackets.EnchantSkill_T[] = [];
    public enchantSkillInfo: GamePackets.EnchantSkillInfo_T = null;
    public manors: GamePackets.ManorEntry_T[] = [];
    public manorSeedInfo: GamePackets.ManorSeedInfo_T = null;
    public manorCropInfo: GamePackets.ManorCropInfo_T = null;
    public manorDefaultInfo: GamePackets.ManorDefaultInfo_T = null;
    public manorSeedSettings: GamePackets.ManorSeedSettings_T = null;
    public manorCropSettings: GamePackets.ManorCropSettings_T = null;
    public manorSellCrops: GamePackets.ManorSellCropList_T = null;
    public manorProcureCropDetail: GamePackets.ManorProcureCropDetail_T = null;

    public constructor(protected readonly network: NetworkManager) {}

    public onItemList(packet: PacketReader) {
        const showWindow = packet.h() !== 0;

        this.inventory.clear();

        for (let i = 0, count = packet.h(); i < count; i++) {
            const item = GamePackets.readInventoryItem(packet);

            this.inventory.set(item.objectId, item);
        }

        this.updateInventory(showWindow, true);
    }

    public onInventoryUpdate(packet: PacketReader) {
        for (let i = 0, count = packet.h(); i < count; i++) {
            const change = packet.h();
            const item = GamePackets.readInventoryItem(packet);

            this.network.ui.updateInventoryOrder(change, item);

            switch (change) {
                case GamePackets.InventoryChange_T.ADD:
                case GamePackets.InventoryChange_T.MODIFY: this.inventory.set(item.objectId, item); break;
                case GamePackets.InventoryChange_T.REMOVE: this.inventory.delete(item.objectId); break;
                default: throw new Error(`Unknown inventory change '${change}'.`);
            }
        }

        this.updateInventory();
    }

    protected readShopItem(packet: PacketReader, hasPrice: boolean, allowZeroObject: boolean, allowZeroCount: boolean): GamePackets.ShopItem_T {
        const type1 = packet.h(), objectId = packet.d(), itemId = packet.d(), count = packet.d(), type2 = packet.h();

        packet.h();

        const bodyPart = packet.d(), enchantLevel = packet.h();

        packet.h();

        const customType2 = packet.h(), price = hasPrice ? packet.d() : 0;

        if (objectId < (allowZeroObject ? 0 : 1) || itemId <= 0 || count < (allowZeroCount ? 0 : 1) || price < 0)
            throw new Error(`Invalid shop item '${itemId}'.`);

        return { type1, objectId, itemId, count, type2, bodyPart, enchantLevel, customType2, price };
    }

    public onSellList(packet: PacketReader) {
        const money = packet.d(), npcId = packet.d(), count = packet.h();

        if (money < 0 || npcId < 0 || count > Math.trunc(packet.getRemaining() / 32)) throw new Error(`Invalid SellList count '${count}'.`);

        const items: GamePackets.ShopItem_T[] = [];
        for (let i = 0; i < count; i++) items.push(this.readShopItem(packet, true, false, false));
        if (packet.getRemaining()) throw new Error("Invalid SellList trailing data.");

        this.shopSellMoney = money;
        this.shopSellNpcId = npcId;
        this.shopSellItems.length = 0;
        this.shopSellItems.push(...items);
        this.network.ui.showShop(true, money, items);
    }

    public onBuyList(packet: PacketReader) {
        const money = packet.d(), listId = packet.d(), count = packet.h();

        if (money < 0 || listId < 0 || count > Math.trunc(packet.getRemaining() / 32)) throw new Error(`Invalid BuyList count '${count}'.`);

        const items: GamePackets.ShopItem_T[] = [];
        for (let i = 0; i < count; i++) items.push(this.readShopItem(packet, true, true, true));
        if (packet.getRemaining()) throw new Error("Invalid BuyList trailing data.");

        this.shopBuyMoney = money;
        this.shopBuyListId = listId;
        this.shopBuyItems.length = 0;
        this.shopBuyItems.push(...items);
        this.network.ui.showShop(false, money, items);
    }

    protected readTradeItem(packet: PacketReader, hasTradeType: boolean): GamePackets.TradeItem_T {
        const tradeType = hasTradeType ? packet.h() : 0;
        const type1 = packet.h(), objectId = packet.d(), itemId = packet.d(), count = packet.d(), type2 = packet.h();

        packet.h();

        const bodyPart = packet.d(), enchantLevel = packet.h();

        packet.h();

        const customType2 = packet.h();

        if (objectId <= 0 || itemId <= 0 || count < 0 || count === 0 && !hasTradeType || hasTradeType && tradeType !== GamePackets.TradeChange_T.ADD && tradeType !== GamePackets.TradeChange_T.REMOVE && tradeType !== GamePackets.TradeChange_T.MODIFY)
            throw new Error(`Invalid trade item '${itemId}'.`);

        return { tradeType, type1, objectId, itemId, count, initialCount: count, type2, bodyPart, enchantLevel, customType2 };
    }

    protected readTradeItems(packet: PacketReader, count: number, hasTradeType: boolean): GamePackets.TradeItem_T[] {
        const size = hasTradeType ? 30 : 28;

        if (count < 0 || count > Math.trunc(packet.getRemaining() / size)) throw new Error(`Invalid trade item count '${count}'.`);

        const items: GamePackets.TradeItem_T[] = [];
        for (let i = 0; i < count; i++) items.push(this.readTradeItem(packet, hasTradeType));

        return items;
    }

    protected addTradeItems(target: GamePackets.TradeItem_T[], items: GamePackets.TradeItem_T[], mode: number) {
        const infos = this.network.ui.getStrings().itemInfos;

        for (const item of items) {
            if (target.length >= 160) continue;

            const previous = target.find(entry => entry.objectId === item.objectId);
            const consumeType = previous ? infos[previous.itemId].consumeType : 0;

            if (previous && consumeType >= 1 && consumeType <= 3) previous.count += item.count;
            else target.push(item);
            this.network.ui.recalculateTradeRows(mode, target.length);
        }
    }

    public onTradeStart(packet: PacketReader) {
        const partnerId = packet.d(), count = packet.h(), items = this.readTradeItems(packet, count, false);

        if (partnerId <= 0 || packet.getRemaining()) throw new Error("Invalid TradeStart payload.");

        this.tradePartnerId = partnerId;
        this.tradeRequestId = 0;
        this.tradeOwnItems.length = 0;
        this.tradeOtherItems.length = 0;
        this.tradeAvailableItems.length = 0;
        this.tradeDone = 0;

        const own = this.network.actors.objects.get(this.network.actors.userId), other = this.network.actors.objects.get(partnerId);

        this.network.ui.startTrade(own ? own.name : null, other ? other.name : null);

        if (!own || !other) this.network.session.game.tradeDone(false);
        this.addTradeItems(this.tradeAvailableItems, items, 0);
        this.network.ui.setTradeItems(0, this.tradeAvailableItems, null);
    }

    public onTradeOwnAdd(packet: PacketReader) {
        const items = this.readTradeItems(packet, packet.h(), false);

        if (packet.getRemaining()) throw new Error("Invalid TradeOwnAdd trailing data.");

        this.addTradeItems(this.tradeOwnItems, items, 1);
        this.network.ui.setTradeItems(1, this.tradeOwnItems, null);
    }

    public onTradeOtherAdd(packet: PacketReader) {
        const items = this.readTradeItems(packet, packet.h(), false);

        if (packet.getRemaining()) throw new Error("Invalid TradeOtherAdd trailing data.");

        this.addTradeItems(this.tradeOtherItems, items, 2);
        this.network.ui.setTradeItems(2, this.tradeOtherItems, null);
    }

    public onTradeUpdate(packet: PacketReader) {
        const items = this.readTradeItems(packet, packet.h(), true);

        if (packet.getRemaining()) throw new Error("Invalid TradeUpdate trailing data.");

        for (const item of items) {
            if (item.tradeType === GamePackets.TradeChange_T.ADD) {
                this.addTradeItems(this.tradeAvailableItems, [item], 0);
                continue;
            }

            const index = this.tradeAvailableItems.findIndex(entry => entry.objectId === item.objectId);

            if (index < 0) continue;

            if (item.tradeType === GamePackets.TradeChange_T.MODIFY) this.tradeAvailableItems[index] = item;
            else this.tradeAvailableItems.splice(index, 1);
        }

        this.network.ui.setTradeItems(0, this.tradeAvailableItems, null);
    }

    public onSendTradeRequest(packet: PacketReader) {
        const senderId = packet.d();

        if (senderId <= 0 || packet.getRemaining()) throw new Error("Invalid SendTradeRequest payload.");

        const sender = this.network.actors.objects.get(senderId);

        if (!sender) {
            this.network.session.game.answerTradeRequest(false);
            return;
        }

        this.network.ui.showTradeInvite(sender.name, isAccepted => this.answerTradeRequest(isAccepted));
        this.tradeRequestId = senderId;
    }

    public onSendTradeDone(packet: PacketReader) {
        const result = packet.d();

        if (packet.getRemaining()) throw new Error("Invalid SendTradeDone payload.");

        this.tradeDone = result;
        this.tradePartnerId = 0;
        this.tradeRequestId = 0;
        this.tradeAvailableItems.length = 0;
        this.tradeOwnItems.length = 0;
        this.tradeOtherItems.length = 0;
        this.network.ui.finishTrade();
    }

    public onWareHouseDone(packet: PacketReader) {
        const result = packet.d();

        if (packet.getRemaining()) throw new Error("Invalid WareHouseDone payload.");
        if (result !== 0) return;

        const strings = this.network.ui.getStrings();

        this.network.ui.addSystemMessage(strings.systemMessages[307], strings.systemMessageColors[307]);
        this.network.community.playSystemMessageSound(307);
    }

    public onShopPreviewInfo(packet: PacketReader) {
        this.shopPreviewItems = GamePackets.readShopPreviewInfo(packet);
        const object = this.network.actors.objects.get(this.network.actors.userId), appearance = this.network.actors.appearances.get(this.network.actors.userId);

        if (!object || !object.actor || !appearance) return;

        const paperdoll = appearance.paperdoll;
        const slots = [GamePackets.Paperdoll_T.PAPERDOLL_HEAD, GamePackets.Paperdoll_T.PAPERDOLL_RHAND, GamePackets.Paperdoll_T.PAPERDOLL_LHAND, GamePackets.Paperdoll_T.PAPERDOLL_GLOVES, GamePackets.Paperdoll_T.PAPERDOLL_FEET, GamePackets.Paperdoll_T.PAPERDOLL_LEGS, GamePackets.Paperdoll_T.PAPERDOLL_CHEST, GamePackets.Paperdoll_T.PAPERDOLL_UNDER, GamePackets.Paperdoll_T.PAPERDOLL_LRHAND, GamePackets.Paperdoll_T.PAPERDOLL_HAIR];

        for (const slot of slots) {
            const itemId = this.shopPreviewItems[slot];

            if (!itemId) continue;

            switch (slot) {
                case GamePackets.Paperdoll_T.PAPERDOLL_RHAND:
                case GamePackets.Paperdoll_T.PAPERDOLL_LHAND:
                    if (paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_LRHAND]) {
                        paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_LRHAND] = 0;
                        paperdoll[slot === GamePackets.Paperdoll_T.PAPERDOLL_RHAND ? GamePackets.Paperdoll_T.PAPERDOLL_LHAND : GamePackets.Paperdoll_T.PAPERDOLL_RHAND] = 0;
                    }
                    break;
                case GamePackets.Paperdoll_T.PAPERDOLL_GLOVES:
                case GamePackets.Paperdoll_T.PAPERDOLL_FEET:
                case GamePackets.Paperdoll_T.PAPERDOLL_LEGS: {
                    const chest = paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_CHEST];
                    const bodyPart = chest > 0 ? this.network.ui.getStrings().itemInfos[chest].bodyPart : 0;

                    if (bodyPart === CHARACTER_ALLDRESS_SLOT) {
                        paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_GLOVES] = paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_FEET] = 0;
                        if (slot !== GamePackets.Paperdoll_T.PAPERDOLL_LEGS) paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_CHEST] = 0;
                    } else if (slot === GamePackets.Paperdoll_T.PAPERDOLL_LEGS && bodyPart === CHARACTER_FULL_ARMOR_SLOT) paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_CHEST] = 0;
                    break;
                }
                case GamePackets.Paperdoll_T.PAPERDOLL_LRHAND:
                    paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_RHAND] = paperdoll[GamePackets.Paperdoll_T.PAPERDOLL_LHAND] = 0;
                    break;
            }
            if (slot === GamePackets.Paperdoll_T.PAPERDOLL_RHAND || slot === GamePackets.Paperdoll_T.PAPERDOLL_LRHAND) appearance.enchantLevel = 0;
            paperdoll[slot] = itemId;
        }
        object.appearanceKey = this.network.actors.getAppearanceKey(appearance);
        this.network.actors.userAppearanceLoad = this.network.actors.loadAppearance(appearance, this.network.movement.riders.get(this.network.actors.userId) || object.actor);
    }

    public onEquipUpdate(packet: PacketReader) {
        const change = packet.d(), itemObjectId = packet.d(), bodyPart = packet.d();

        if (bodyPart <= 0 || bodyPart > 0xffff) throw new Error(`Invalid equipment body part '${bodyPart}'.`);

        const appearance = this.network.actors.appearances.get(this.network.actors.userId);

        if (!appearance) return;

        const item = this.inventory.get(itemObjectId);

        if (change !== 0 && !item) return;

        const slots: GamePackets.Paperdoll_T[] = [];
        for (let slot = 0; slot < 16; slot++)
            if (bodyPart & (1 << slot)) slots.push(slot as GamePackets.Paperdoll_T);

        const isHand = slots.includes(GamePackets.Paperdoll_T.PAPERDOLL_RHAND) || slots.includes(GamePackets.Paperdoll_T.PAPERDOLL_LRHAND);

        if (isHand) {
            slots.length = 0;
            slots.push(GamePackets.Paperdoll_T.PAPERDOLL_RHAND, GamePackets.Paperdoll_T.PAPERDOLL_LRHAND);
        }

        if (change === 0) {
            if (!item) for (const slot of slots) appearance.paperdoll[slot] = 0;
            else if (isHand) {
                for (const slot of slots)
                    if (appearance.paperdoll[slot] === item.itemId) appearance.paperdoll[slot] = 0;
            } else {
                const slot = slots.find(slot => appearance.paperdoll[slot] === item.itemId) ?? slots[0];
                appearance.paperdoll[slot] = 0;
            }
        } else {
            if (isHand) for (const slot of slots) appearance.paperdoll[slot] = item.itemId;
            else {
                const slot = slots.find(slot => !appearance.paperdoll[slot]) ?? slots[0];
                appearance.paperdoll[slot] = item.itemId;
            }
        }

        if (item) {
            item.isEquipped = change !== 0;
        }
        if (isHand)
            appearance.enchantLevel = change === 0 ? 0 : item.enchantLevel;

        this.updateInventory();

        const object = this.network.actors.objects.get(this.network.actors.userId), key = this.network.actors.getAppearanceKey(appearance);

        if (!object || key === object.appearanceKey) return;

        object.appearanceKey = key;
        if (object.actor) void this.network.actors.loadAppearance(appearance, this.network.movement.riders.get(this.network.actors.userId) || object.actor);
    }

    protected updateInventory(showWindow: boolean = false, isFull: boolean = false) {
        this.network.ui.setInventory([...this.inventory.values()], showWindow, isFull);

        for (const shortcut of this.shortcuts.values())
            if (shortcut.type === GamePackets.ShortCutType_T.TYPE_ITEM) this.setShortCut(shortcut);
    }

    public onSkillList(packet: PacketReader) {
        const count = packet.d();

        if (count < 0 || count > Math.trunc(packet.getRemaining() / 12)) throw new Error(`Invalid SkillList count ${count}.`);

        this.skills.clear();
        for (let i = 0; i < count; i++) {
            const isPassive = packet.d() !== 0, level = packet.d(), id = packet.d();

            this.skills.set(id, { id, level, isPassive });
        }
        this.network.ui.setSkills([...this.skills.values()]);
        void this.preloadSkills();

        if (this.resolveSkillList) this.resolveSkillList();
        this.resolveSkillList = null;
    }

    protected async preloadSkills() {
        const asset = this.network.getParent().getComponent("asset"), player = this.network.getParent().getComponent("render").player;

        for (const skill of this.skills.values()) {
            if (skill.isPassive) continue;

            await asset.preloadPawnSkill(player, skill.id, skill.level);
        }
    }

    public onAquireSkillList(packet: PacketReader) {
        const fishing = packet.d(), count = packet.d();

        if (fishing !== 0 && fishing !== 1 || count < 0 || count > Math.trunc(packet.getRemaining() / 20)) throw new Error(`Invalid AquireSkillList payload (count ${count}).`);

        const skills: GamePackets.AquireSkillEntry_T[] = [];
        for (let i = 0; i < count; i++) skills.push({ id: packet.d(), nextLevel: packet.d(), maxLevel: packet.d(), spCost: packet.d(), requirements: packet.d() });
        if (packet.getRemaining()) throw new Error("Invalid AquireSkillList trailing data.");

        this.aquireSkillFishing = fishing !== 0;
        this.aquireSkills = skills;
        this.network.ui.showAquireSkillList(skills, fishing);
    }

    public onAquireSkillInfo(packet: PacketReader) {
        const id = packet.d(), level = packet.d(), spCost = packet.d(), mode = packet.d(), count = packet.d();

        if (count < 0 || count > Math.trunc(packet.getRemaining() / 16)) throw new Error(`Invalid AquireSkillInfo payload (count ${count}).`);

        const requirements: GamePackets.AquireSkillRequirement_T[] = [];
        for (let i = 0; i < count; i++) requirements.push({ type: packet.d(), itemId: packet.d(), count: packet.d(), unknown: packet.d() });
        if (packet.getRemaining()) throw new Error("Invalid AquireSkillInfo trailing data.");

        this.aquireSkillInfo = { id, level, spCost, mode, requirements };
        this.network.ui.showAquireSkillInfo(this.aquireSkillInfo);
    }

    public onAquireSkillDone(packet: PacketReader) {
        if (packet.getRemaining()) throw new Error("Invalid AquireSkillDone payload.");

        this.aquireSkills = [];
        this.aquireSkillInfo = null;
        this.network.ui.hideTrainWnd();
    }

    public onQuestList(packet: PacketReader) {
        const count = packet.h();

        if (count > Math.trunc(packet.getRemaining() / 8)) throw new Error(`Invalid QuestList count ${count}.`);

        this.questStates.clear();
        const states: GamePackets.QuestState_T[] = [];

        for (let i = 0; i < count; i++) {
            const id = packet.d(), condition = packet.d();
            const state = { id, condition };

            this.questStates.set(id, state);
            states.push(state);
        }
        if (packet.getRemaining()) {
            const itemCount = packet.h();

            if (itemCount > Math.trunc(packet.getRemaining() / 16)) throw new Error(`Invalid QuestList item count ${itemCount}.`);
            packet.skip(itemCount * 16);
        }
        if (packet.getRemaining()) throw new Error("Invalid QuestList trailing data.");
        this.network.ui.setQuestStates(states);
    }

    public onHennaInfo(packet: PacketReader) {
        const stats: number[] = [];

        for (let i = 0; i < 6; i++) stats.push(packet.c() << 24 >> 24);

        const slots = packet.d(), count = packet.d();

        if (slots < 0 || count < 0 || count > Math.trunc(packet.getRemaining() / 8)) throw new Error(`Invalid HennaInfo count ${count}.`);

        const symbols = [];
        for (let i = 0; i < count; i++) symbols.push({ symbolId: packet.d(), itemId: packet.d() });

        this.hennaStatus = { stats, slots, symbols };
        this.network.ui.setHenna(this.hennaStatus);
    }

    public onSendMacroList(packet: PacketReader) {
        const type = packet.c(), id = packet.d(), total = packet.c(), count = packet.c();
        const macros: GamePackets.Macro_T[] = [];

        if (total > 127 || count > 100) throw new Error(`Invalid SendMacroList count ${total}:${count}.`);

        for (let i = 0; i < count; i++) {
            const id = packet.d(), name = packet.S(), description = packet.S(), acronym = packet.S(), icon = packet.c(), commandCount = packet.c();

            if (commandCount > 12) throw new Error(`Invalid macro command count ${commandCount}.`);

            const commands = [];
            for (let j = 0; j < commandCount; j++) commands.push({ index: packet.c(), type: packet.c(), data1: packet.d(), data2: packet.c(), command: packet.S() });

            macros.push({ id, name, description, acronym, icon, commands });
        }

        if (packet.getRemaining() || total > 0 && count === 0) throw new Error(`Invalid SendMacroList payload.`);

        if (this.isMacroListComplete) {
            this.macros.clear();
            this.network.macroExecutor.clear();
            this.macroListReceived = 0;
            this.isMacroListComplete = false;
        }

        for (const macro of macros) {
            this.macros.set(macro.id, macro);
            this.macroListReceived++;
        }

        if (this.macroListReceived < total) return;

        this.isMacroListComplete = true;
        this.network.ui.setMacros(Array.from(this.macros.values()));
        for (const shortcut of this.shortcuts.values()) {
            if (shortcut.type !== GamePackets.ShortCutType_T.TYPE_MACRO) continue;

            if (type === GamePackets.MacroListChange_T.DELETE && shortcut.id === id) this.deleteShortCut(Math.trunc(shortcut.slot / 12), shortcut.slot % 12);
            else if (type === GamePackets.MacroListChange_T.UPDATE && shortcut.id === id) this.setShortCut(shortcut);
        }
    }

    public onEtcStatusUpdate(packet: PacketReader) {
        this.etcStatus = { charges: packet.d(), weightPenalty: packet.d(), messageRefusal: packet.d(), dangerArea: packet.d(), expertisePenalty: packet.d() };

        const effects: GamePackets.AbnormalStatus_T[] = [];
        const levels = [this.etcStatus.charges, this.etcStatus.weightPenalty, this.etcStatus.messageRefusal, this.etcStatus.dangerArea, this.etcStatus.expertisePenalty];

        levels.forEach((value, i) => {
            if (value > 0) effects.push({ id: 4271 - i, level: i < 2 ? value : 1, duration: -1 });
        });
        this.network.ui.setSecondaryAbnormalStatus(effects);
    }

    public onChooseInventoryItem(packet: PacketReader) {
        const itemId = packet.d();

        if (itemId <= 0) throw new Error(`Invalid ChooseInventoryItem item '${itemId}'.`);

        this.network.ui.chooseInventoryItem(itemId);
    }

    public onEnchantResult(packet: PacketReader) {
        const result = packet.d();

        if (result < 0 || result > 2 || packet.getRemaining()) throw new Error("Invalid EnchantResult payload.");

        this.network.ui.clearInventoryChoice();
    }

    public onMagicEffectIcons(packet: PacketReader) {
        const count = packet.h() << 16 >> 16;

        if (count > Math.trunc(packet.getRemaining() / 10)) throw new Error(`Invalid MagicEffectIcons count ${count}.`);

        this.abnormalStatuses.length = 0;
        for (let i = 0; i < count; i++) {
            const effect = { id: packet.d(), level: packet.h() << 16 >> 16, duration: packet.d() };

            this.abnormalStatuses.push(effect);
        }

        this.network.ui.setAbnormalStatus(this.abnormalStatuses);
    }

    public onShortBuffStatusUpdate(packet: PacketReader) {
        const id = packet.d(), level = packet.d(), duration = packet.d();

        this.shortBuff = { id, level, duration };
        this.network.ui.setShortBuff(this.shortBuff);
    }

    public onSkillCoolTime(packet: PacketReader) {
        const count = packet.d();

        if (count < 0 || count > Math.trunc(packet.getRemaining() / 16)) throw new Error(`Invalid SkillCoolTime count ${count}.`);

        for (let i = 0; i < count; i++) this.network.ui.setSkillCoolTime(packet.d(), packet.d(), packet.d(), packet.d());
    }

    public requestSkillList() { if (this.network.actors.inWorld) this.network.session.game.requestSkillList(); }

    public requestItemList() { if (this.network.actors.inWorld) this.network.session.game.requestItemList(); }

    public useItem(objectId: number) { if (this.network.actors.inWorld) this.network.session.game.useItem(objectId, this.network.ui.getInputModifiers()[0]); }

    public chooseInventoryItem(objectId: number) { if (this.network.actors.inWorld && (objectId === -1 || this.inventory.has(objectId))) this.network.session.game.requestEnchantItem(objectId); }

    protected readPetInventoryItem(packet: PacketReader, allowZeroCount: boolean = false): GamePackets.InventoryItem_T {
        const item = { type1: packet.h(), objectId: packet.d(), itemId: packet.d(), count: packet.d(), type2: packet.h(), customType1: packet.h(), isEquipped: packet.h() !== 0, bodyPart: packet.d(), enchantLevel: packet.h(), customType2: packet.h() };

        if (item.objectId <= 0 || item.itemId <= 0 || item.count < (allowZeroCount ? 0 : 1)) throw new Error(`Invalid pet inventory item '${item.itemId}'.`);

        return item;
    }

    public onPetItemList(packet: PacketReader) {
        const count = packet.h();

        if (count > Math.trunc(packet.getRemaining() / 28)) throw new Error(`Invalid PetItemList count '${count}'.`);

        const items: GamePackets.InventoryItem_T[] = [];
        for (let i = 0; i < count; i++) items.push(this.readPetInventoryItem(packet));
        if (packet.getRemaining()) throw new Error("Invalid PetItemList trailing data.");

        this.petInventory.clear();
        for (const item of items) this.petInventory.set(item.objectId, item);
        this.network.ui.setPetInventory(Array.from(this.petInventory.values()), true);
    }

    public onPetInventoryUpdate(packet: PacketReader) {
        const count = packet.h();

        if (count > Math.trunc(packet.getRemaining() / 30)) throw new Error(`Invalid PetInventoryUpdate count '${count}'.`);

        const changes: { change: number, item: GamePackets.InventoryItem_T }[] = [];
        for (let i = 0; i < count; i++) {
            const change = packet.h();
            if (change < GamePackets.InventoryChange_T.ADD || change > GamePackets.InventoryChange_T.REMOVE) throw new Error(`Unknown pet inventory change '${change}'.`);
            changes.push({ change, item: this.readPetInventoryItem(packet, change === GamePackets.InventoryChange_T.REMOVE) });
        }
        if (packet.getRemaining()) throw new Error("Invalid PetInventoryUpdate trailing data.");

        for (const change of changes) {
            if (change.change === GamePackets.InventoryChange_T.REMOVE) this.petInventory.delete(change.item.objectId);
            else if (change.change === GamePackets.InventoryChange_T.ADD || this.petInventory.has(change.item.objectId)) this.petInventory.set(change.item.objectId, change.item);
            if (change.change !== GamePackets.InventoryChange_T.ADD) this.updatePetShortCutItem(change.item.objectId);
        }
        this.network.ui.setPetInventory(Array.from(this.petInventory.values()));
    }

    protected updatePetShortCutItem(objectId: number) {
        for (const shortcut of this.shortcuts.values()) {
            if (shortcut.type !== GamePackets.ShortCutType_T.TYPE_ITEM || shortcut.id !== objectId) continue;
            if (this.petInventory.has(shortcut.id)) this.setShortCut(shortcut);
            else {
                this.shortcuts.delete(shortcut.slot);
                this.network.ui.removeShortCut(shortcut.slot);
            }
        }
    }

    protected getShortCutItem(shortcut: GamePackets.ShortCut_T) { return (shortcut.characterType === 2 ? this.petInventory : this.inventory).get(shortcut.id); }

    public setShortCut(shortcut: GamePackets.ShortCut_T) {
        const item = this.getShortCutItem(shortcut);

        if (shortcut.type === GamePackets.ShortCutType_T.TYPE_ITEM && shortcut.characterType === 2 && !item) return;
        this.shortcuts.set(shortcut.slot, shortcut);
        this.network.ui.setShortCut(shortcut, item, !!item && this.autoSoulShots.has(item.itemId), this.macros.get(shortcut.id));
    }

    public onShortCutDelete(packet: PacketReader) { // Engine 0x10403f30 reads one "d"; NWindow 0x10108500 only clears the slot.
        const index = packet.d();

        if (index >= 120) return;

        this.shortcuts.delete(index);
        this.network.ui.removeShortCut(index);
    }

    public onAutoSoulShot(packet: PacketReader) {
        const itemId = packet.d(), isEnabled = packet.d() !== 0;

        if (isEnabled) this.autoSoulShots.add(itemId);
        else this.autoSoulShots.delete(itemId);

        for (const shortcut of this.shortcuts.values()) {
            if (shortcut.type !== GamePackets.ShortCutType_T.TYPE_ITEM) continue;

            const item = this.getShortCutItem(shortcut);

            if (item && item.itemId === itemId) this.setShortCut(shortcut);
        }
    }

    public onStorageMaxCount(packet: PacketReader) {
        const values = [packet.d(), packet.d(), packet.d(), packet.d(), packet.d(), packet.d(), packet.d()];

        if (values.some(value => value < 0) || packet.getRemaining()) throw new Error("Invalid ExStorageMaxCount packet.");

        this.storageMaxCount = { inventory: values[0], warehouse: values[1], freight: values[2], privateSell: values[3], privateBuy: values[4], recipeDwarf: values[5], recipe: values[6] };
        this.network.ui.setInventoryLimit(values[0]);
        this.network.ui.setWarehouseLimit(values[1]);
        this.network.ui.setPrivateSellLimit(values[3]);
        this.network.ui.setPrivateBuyLimit(values[4]);
        this.network.ui.setRecipeLimits(values[5], values[6]);
    }

    public toggleAutoSoulShot(page: number, slot: number) {
        const shortcut = this.shortcuts.get(page * 12 + slot);

        if (!this.network.actors.inWorld || !shortcut || shortcut.type !== GamePackets.ShortCutType_T.TYPE_ITEM) return;

        const item = this.getShortCutItem(shortcut);

        if (!item) return;

        const id = item.itemId;

        // NCConsole 0x1006e500: retail automatic-shot item ranges.
        if (!(id >= 1463 && id <= 1467 || id === 1835 || id >= 2509 && id <= 2514 || id >= 3947 && id <= 3952 || id >= 5789 && id <= 5790 || id >= 6645 && id <= 6647)) return;

        this.network.session.game.requestAutoSoulShot(id, !this.autoSoulShots.has(id));
    }

    protected requestShortCutReg(type: GamePackets.ShortCutType_T, index: number, id: number, level: number = 1) { // NWindow 0x1007a1e0 plays pickup after registration.
        this.network.session.game.requestShortCutReg(type, index, id, level);
        void this.network.getParent().getComponent("audio").playInterfaceSound("ItemSound.pickup");
    }

    public registerSkillShortCut(id: number, page: number, slot: number) {
        const skill = this.skills.get(id);

        if (!this.network.actors.inWorld || !skill) return;
        if (!Number.isInteger(page) || page < 0 || page >= 10 || !Number.isInteger(slot) || slot < 0 || slot >= 12) throw new Error(`Invalid shortcut ${page}:${slot}.`);

        this.requestShortCutReg(GamePackets.ShortCutType_T.TYPE_SKILL, page * 12 + slot, id);
    }

    public registerRecipeShortCut(id: number, page: number, slot: number) {
        if (!this.network.actors.inWorld) return;
        if (!Number.isInteger(page) || page < 0 || page >= 10 || !Number.isInteger(slot) || slot < 0 || slot >= 12) throw new Error(`Invalid shortcut ${page}:${slot}.`);

        this.requestShortCutReg(GamePackets.ShortCutType_T.TYPE_RECIPE, page * 12 + slot, id);
    }

    public registerMacroShortCut(id: number, page: number, slot: number) {
        if (!this.network.actors.inWorld || !this.macros.has(id)) return;
        if (!Number.isInteger(page) || page < 0 || page >= 10 || !Number.isInteger(slot) || slot < 0 || slot >= 12) throw new Error(`Invalid shortcut ${page}:${slot}.`);

        this.requestShortCutReg(GamePackets.ShortCutType_T.TYPE_MACRO, page * 12 + slot, id);
    }

    public registerItemShortCut(objectId: number, page: number, slot: number) {
        if (!this.network.actors.inWorld || !this.inventory.has(objectId)) return;
        if (!Number.isInteger(page) || page < 0 || page >= 10 || !Number.isInteger(slot) || slot < 0 || slot >= 12) throw new Error(`Invalid shortcut ${page}:${slot}.`);

        this.requestShortCutReg(GamePackets.ShortCutType_T.TYPE_ITEM, page * 12 + slot, objectId);
    }

    public registerPetItemShortCut(objectId: number, page: number, slot: number) {
        if (!this.network.actors.inWorld || !this.petInventory.has(objectId)) return;
        if (!Number.isInteger(page) || page < 0 || page >= 10 || !Number.isInteger(slot) || slot < 0 || slot >= 12) throw new Error(`Invalid shortcut ${page}:${slot}.`);

        this.requestShortCutReg(GamePackets.ShortCutType_T.TYPE_ITEM, page * 12 + slot, objectId, 2);
    }

    public registerActionShortCut(id: number, page: number, slot: number) {
        if (!this.network.actors.inWorld || !this.network.ui.getStrings().actions[id]) return;
        if (!Number.isInteger(page) || page < 0 || page >= 10 || !Number.isInteger(slot) || slot < 0 || slot >= 12) throw new Error(`Invalid shortcut ${page}:${slot}.`);

        this.requestShortCutReg(GamePackets.ShortCutType_T.TYPE_ACTION, page * 12 + slot, id, id >= 0 && id <= 14 ? 1 : id >= 15 && id <= 27 ? 2 : 0);
    }

    public moveShortCut(page: number, slot: number, targetPage: number, targetSlot: number) {
        const index = page * 12 + slot, targetIndex = targetPage * 12 + targetSlot;
        const source = this.shortcuts.get(index), target = this.shortcuts.get(targetIndex);

        if (!this.network.actors.inWorld || !source || index === targetIndex) return;
        if (![page, targetPage].every(value => Number.isInteger(value) && value >= 0 && value < 10) || ![slot, targetSlot].every(value => Number.isInteger(value) && value >= 0 && value < 12)) throw new Error(`Invalid shortcut move ${page}:${slot} -> ${targetPage}:${targetSlot}.`);

        this.requestShortCutReg(source.type, targetIndex, source.id, source.characterType ?? 1);
        this.network.session.game.requestShortCutDel(index);
        this.shortcuts.delete(index);
        this.network.ui.removeShortCut(index);

        if (target) this.requestShortCutReg(target.type, index, target.id, target.characterType ?? 1);
    }

    public findPrivateStore(text: string) {
        const query = caps(text);

        for (const object of this.network.actors.objects.values()) {
            if (object.kind === "npc") continue;
            object.matchedStoreType = GamePackets.PrivateStoreType_T.STORE_PRIVATE_NONE;

            if (!query || !object.actor) continue;
            const type = object.privateStoreType;
            const messages = type === GamePackets.PrivateStoreType_T.STORE_PRIVATE_SELL || type === GamePackets.PrivateStoreType_T.STORE_PRIVATE_PACKAGE_SELL ? this.privateStoreSellMsgs : type === GamePackets.PrivateStoreType_T.STORE_PRIVATE_BUY ? this.privateStoreBuyMsgs : type === GamePackets.PrivateStoreType_T.STORE_PRIVATE_MANUFACTURE ? this.recipeShopMessages : null;

            if (!messages) continue;
            const message = messages.get(object.objectId);

            if (message && caps(message).includes(query)) object.matchedStoreType = type;
        }
    }

    public equipShortCut(page: number, slot: number) {
        const shortcut = this.shortcuts.get(page * 12 + slot);

        if (!shortcut || shortcut.type !== GamePackets.ShortCutType_T.TYPE_ITEM) return;
        const item = this.inventory.get(shortcut.id), info = item ? this.network.ui.getStrings().itemInfos[item.itemId] : null;

        if (!info || (info.templateClass !== "weapon" && info.templateClass !== "armor")) return;

        for (const equipped of this.inventory.values())
            if (equipped.isEquipped && equipped.itemId === item.itemId) return;

        this.useItem(item.objectId);
    }

    public useShortCut(page: number, slot: number, ctrl: boolean = false, shift: boolean = false) {
        const shortcut = this.shortcuts.get(page * 12 + slot);

        if (!shortcut) return;

        switch (shortcut.type) {
            case GamePackets.ShortCutType_T.TYPE_SKILL: this.network.session.game.requestMagicSkillUse(shortcut.id, ctrl, shift); break;
            case GamePackets.ShortCutType_T.TYPE_ACTION: this.network.useAction(shortcut.id, ctrl, shift); break;
            case GamePackets.ShortCutType_T.TYPE_ITEM:
                if (shortcut.characterType === 2) this.usePetItem(shortcut.id);
                else if ((shortcut.characterType ?? 1) === 1) this.useItem(shortcut.id);
                break;
            case GamePackets.ShortCutType_T.TYPE_MACRO: this.network.activateMacro(shortcut.id); break;
            case GamePackets.ShortCutType_T.TYPE_RECIPE: this.network.session.game.requestRecipeItemMakeInfo(shortcut.id); break;
            default: throw new Error(`Unknown shortcut type ${shortcut.type}.`);
        }
    }

    public onPrivateStoreManageListSell(packet: PacketReader) {
        const list = GamePackets.readPrivateStoreManageListSell(packet);

        if (list.playerId !== this.network.actors.userId) throw new Error(`PrivateStoreManageListSell for foreign player '${list.playerId}'.`);

        this.privateStoreManageSell = list;
        this.network.ui.showPrivateStoreManageSell(list);
    }

    public onPrivateStoreManageListBuy(packet: PacketReader) {
        const list = GamePackets.readPrivateStoreManageListBuy(packet);

        if (list.playerId !== this.network.actors.userId) throw new Error(`PrivateStoreManageListBuy for foreign player '${list.playerId}'.`);

        this.privateStoreManageBuy = list;
        this.network.ui.showPrivateStoreManageBuy(list);
    }

    public onPrivateStoreMsg(packet: PacketReader, messages: Map<number, string>) {
        const objectId = packet.d(), message = packet.S();

        if (objectId <= 0 || packet.getRemaining()) throw new Error("Invalid private store message payload.");

        messages.set(objectId, message);
    }

    public onPackageToList(packet: PacketReader) {
        const targets = GamePackets.readPackageToList(packet);

        this.packageTargets.clear();
        for (const target of targets) this.packageTargets.set(target.objectId, target.name);
        this.network.ui.showPackageTargets(targets);
    }

    public onMultiSellList(packet: PacketReader) {
        const list = GamePackets.readMultiSellList(packet);

        if (list.page === 1 || !this.multiSell) this.multiSell = { ...list, listId: list.page === 1 ? list.listId : 0, entries: [] };
        if (list.page === 1) this.network.ui.clearMultiSell(list.listId);

        for (const entry of list.entries) {
            let group = this.multiSell.entries.find(group => group.entryId === entry.entryId);

            entry.products.forEach((product, index) => {
                if (!group) {
                    group = { entryId: entry.entryId, mode: entry.mode, products: [], ingredients: [] };
                    this.multiSell.entries.push(group);
                }
                group.products.length++;
                group.products[index] = product;
                group.mode = entry.mode;
            });
            if (group) group.ingredients.push(...entry.ingredients);
        }
        this.multiSell.page = list.page;
        this.multiSell.isFinished = list.isFinished;
        if (list.isFinished) this.network.ui.showMultiSell(this.multiSell);

    }

    public requestTrade(objectId: number) { if (this.network.actors.inWorld) this.network.session.game.tradeRequest(objectId); }

    public canAddTradeItem(objectId: number) { return this.network.actors.inWorld && this.tradePartnerId > 0 && this.tradeAvailableItems.some(item => item.objectId === objectId) && !this.tradeOwnItems.some(item => item.objectId === objectId); }

    public addTradeItem(objectId: number, count: number) {
        if (!this.canAddTradeItem(objectId)) return;
        if (!Number.isInteger(count) || count <= 0 || count > 0x7fffffff) throw new Error(`Invalid trade item count '${count}'.`);

        this.network.session.game.addTradeItem(objectId, count);
    }

    public confirmTrade(isConfirmed: boolean) { if (this.network.actors.inWorld && this.tradePartnerId) this.network.session.game.tradeDone(isConfirmed); }

    public answerTradeRequest(isAccepted: boolean) {
        if (!this.network.actors.inWorld || !this.tradeRequestId) return;

        this.tradeRequestId = 0;
        this.network.session.game.answerTradeRequest(isAccepted);
    }

    public sellItems(items: GamePackets.SellItemRequest_T[]) { if (this.network.actors.inWorld) this.network.session.game.requestSellItem(this.shopSellNpcId, items); }

    public buyItems(items: GamePackets.ItemIdCount_T[]) { if (this.network.actors.inWorld) this.network.session.game.requestBuyItem(this.shopBuyListId, items); }

    public depositWarehouse(items: GamePackets.ItemCount_T[]) { if (this.network.actors.inWorld && this.warehouseDeposit) this.network.session.game.sendWareHouseDepositList(items); }

    public withdrawWarehouse(items: GamePackets.ItemCount_T[]) { if (this.network.actors.inWorld && this.warehouseWithdraw) this.network.session.game.sendWareHouseWithDrawList(items); }

    public requestPrivateStoreManageSell() { if (this.network.actors.inWorld) this.network.session.game.requestPrivateStoreManageSell(); }

    public setPrivateStoreListSell(isPackage: boolean, items: GamePackets.PrivateStoreOffer_T[]) { if (this.network.actors.inWorld) this.network.session.game.setPrivateStoreListSell(isPackage, items); }

    public quitPrivateStoreSell() { if (this.network.actors.inWorld) this.network.session.game.requestPrivateStoreQuitSell(); }

    public setPrivateStoreMsgSell(message: string) { if (this.network.actors.inWorld) this.network.session.game.setPrivateStoreMsgSell(message); }

    public getPrivateStoreMsgSell() { return this.privateStoreSellMsgs.get(this.network.actors.userId) ?? ""; }

    public buyFromPrivateStore(ownerId: number, items: GamePackets.PrivateStoreOffer_T[]) { if (this.network.actors.inWorld) this.network.session.game.requestPrivateStoreBuy(ownerId, items); }

    public requestPrivateStoreManageBuy() { if (this.network.actors.inWorld) this.network.session.game.requestPrivateStoreManageBuy(); }

    public setPrivateStoreListBuy(items: GamePackets.PrivateStoreBuyOffer_T[]) { if (this.network.actors.inWorld) this.network.session.game.setPrivateStoreListBuy(items); }

    public quitPrivateStoreBuy() { if (this.network.actors.inWorld) this.network.session.game.requestPrivateStoreQuitBuy(); }

    public cancelPrivateStoreManageBuy() { if (this.network.actors.inWorld) this.network.session.game.requestPrivateStoreManageCancelBuy(); }

    public setPrivateStoreMsgBuy(message: string) { if (this.network.actors.inWorld) this.network.session.game.setPrivateStoreMsgBuy(message); }

    public getPrivateStoreMsgBuy() { return this.privateStoreBuyMsgs.get(this.network.actors.userId) ?? ""; }

    public sellToPrivateStore(ownerId: number, items: GamePackets.PrivateStoreSellOffer_T[]) { if (this.network.actors.inWorld) this.network.session.game.requestPrivateStoreSell(ownerId, items); }

    public requestPackageSendableItemList(objectId: number) { if (this.network.actors.inWorld) this.network.session.game.requestPackageSendableItemList(objectId); }

    public sendPackage(objectId: number, items: GamePackets.ItemCount_T[]) { if (this.network.actors.inWorld) this.network.session.game.requestPackageSend(objectId, items); }

    public clearMultiSell() { if (this.multiSell) { this.multiSell.entries = []; this.multiSell.listId = 0; } }

    public chooseMultiSell(listId: number, entryId: number, amount: number) { if (this.network.actors.inWorld) this.network.session.game.multiSellChoose(listId, entryId, amount); }

    public requestPreviewItems(itemIds: number[]) { if (this.network.actors.inWorld && this.shopPreview) this.network.session.game.requestPreviewItem(this.shopPreview.unknown, this.shopPreview.listId, itemIds); }

    public buySeeds(items: GamePackets.ItemIdCount_T[], manorId?: number) { if (this.network.actors.inWorld && this.seedShop) this.network.session.game.requestBuySeed(manorId ?? this.seedShop.manorId, items); }

    public sellCrops(items: GamePackets.SellItemRequest_T[], listId?: number) { if (this.network.actors.inWorld && this.cropProcure) this.network.session.game.requestBuyProcure(listId ?? this.cropProcure.listId, items); }

    public dropItem(objectId: number, count: number, point: GamePackets.Location_T) { // NCGaraDialogBox kind4 reply 0x100097bd.
        if (!this.network.actors.inWorld) return;

        const player = this.network.getParent().getComponent("render").player;

        if (player.getUnrealScriptProperty("bGetOnVehicle")) {
            this.network.ui.addSystemMessage(this.network.ui.getSystemMessage(179), 0xffdcdcdc);
            return;
        }

        this.network.session.game.requestDropItem(objectId, count, point);
    }

    public destroyItem(objectId: number, count: number) { if (this.network.actors.inWorld) this.network.session.game.requestDestroyItem(objectId, count); }

    public crystallizeItem(objectId: number, count: number) { if (this.network.actors.inWorld) this.network.session.game.requestCrystallizeItem(objectId, count); }

    public unequipBodyPart(bodyPart: number) { if (this.network.actors.inWorld) this.network.session.game.requestUnEquipItem(bodyPart); }

    public giveItemToPet(objectId: number, count: number) { if (this.network.actors.inWorld) this.network.session.game.requestGiveItemToPet(objectId, count); }

    public getItemFromPet(objectId: number, count: number) { if (this.network.actors.inWorld) this.network.session.game.requestGetItemFromPet(objectId, count); }

    public usePetItem(objectId: number) { if (this.network.actors.inWorld) this.network.session.game.requestPetUseItem(objectId); }

    public petPickup(objectId: number) { if (this.network.actors.inWorld && this.network.actors.pickups.has(objectId)) this.network.session.game.requestPetGetItem(objectId); }

    public changePetName(name: string) { if (this.network.actors.inWorld) this.network.session.game.requestChangePetName(name); }

    public onRecipeShopMsg(packet: PacketReader) {
        const message = GamePackets.readRecipeShopMsg(packet);

        this.recipeShopMessages.set(message.objectId, message.storeName);
    }

    public getRecipeBook() { return this.recipeBook; }

    public getRecipeItemMakeInfo() { return this.recipeItemMakeInfo; }

    public getRecipeShopManageList() { return this.recipeShopManageList; }

    public getRecipeShopSellList() { return this.recipeShopSellList; }

    public getRecipeShopItemInfo() { return this.recipeShopItemInfo; }

    public getRecipeShopMessage(objectId: number) { return this.recipeShopMessages.get(objectId); }

    public getHennaEquipList() { return this.hennaEquipList; }

    public getHennaItemInfo() { return this.hennaItemInfo; }

    public openRecipeBook(isDwarven: boolean) { if (this.network.actors.inWorld) this.network.session.game.requestRecipeBookOpen(isDwarven); }

    public destroyRecipe(recipeId: number) { if (this.network.actors.inWorld) this.network.session.game.requestRecipeBookDestroy(recipeId); }

    public requestRecipeItemMakeInfo(recipeId: number) { if (this.network.actors.inWorld) this.network.session.game.requestRecipeItemMakeInfo(recipeId); }

    public makeRecipeItem(recipeId: number) { if (this.network.actors.inWorld) this.network.session.game.requestRecipeItemMakeSelf(recipeId); }

    public requestRecipeShopManage() { if (this.network.actors.inWorld) this.network.session.game.requestRecipeShopManageList(); }

    public getOwnRecipeShopMessage() { return this.recipeShopMessages.get(this.network.actors.userId) ?? ""; }

    public setRecipeShopMessage(name: string) { if (this.network.actors.inWorld) this.network.session.game.requestRecipeShopMessageSet(name); }

    public setRecipeShopList(items: GamePackets.RecipeShopListEntry_T[]) { if (this.network.actors.inWorld) this.network.session.game.requestRecipeShopListSet(items); }

    public quitRecipeShopManage() { if (this.network.actors.inWorld) this.network.session.game.requestRecipeShopManageQuit(); }

    public cancelRecipeShopManage() { if (this.network.actors.inWorld) this.network.session.game.requestRecipeShopManageCancel(); }

    public requestRecipeShopMakeInfo(objectId: number, recipeId: number) { if (this.network.actors.inWorld) this.network.session.game.requestRecipeShopMakeInfo(objectId, recipeId); }

    public makeRecipeShopItem(objectId: number, recipeId: number, price: number) { if (this.network.actors.inWorld) this.network.session.game.requestRecipeShopMakeItem(objectId, recipeId, price); }

    public recipeShopManagePrev(objectId: number) { if (this.network.actors.inWorld) this.network.session.game.requestRecipeShopManagePrev(objectId); }

    public requestHennaList() { if (this.network.actors.inWorld) this.network.session.game.requestHennaList(0); }

    public requestHennaItemInfo(symbolId: number) { if (this.network.actors.inWorld) this.network.session.game.requestHennaItemInfo(symbolId); }

    public equipHenna(symbolId: number) { if (this.network.actors.inWorld) this.network.session.game.requestHennaEquip(symbolId); }

    public requestHennaUnequipList() { if (this.network.actors.inWorld) this.network.session.game.requestHennaUnequipList(0); } // TODO: Capture the retail BD trailing DWORD; 103fa8b0 supplies no vararg.

    public requestHennaUnequipInfo(symbolId: number) { if (this.network.actors.inWorld) this.network.session.game.requestHennaUnequipInfo(symbolId); }

    public unequipHenna(symbolId: number) { if (this.network.actors.inWorld) this.network.session.game.requestHennaUnequip(symbolId); }

    public requestQuestList() { if (this.network.actors.inWorld) this.network.session.game.requestQuestList(); }

    public abortQuest(questId: number) { if (this.network.actors.inWorld) this.network.session.game.requestQuestAbort(questId); }

    public makeMacro(macro: GamePackets.Macro_T) {
        if (!this.network.actors.inWorld) return;
        if (macro.commands.length > 12) throw new Error(`Invalid macro command count ${macro.commands.length}.`);

        this.network.session.game.requestMakeMacro(macro);
    }

    public deleteMacro(id: number) { if (this.network.actors.inWorld && this.macros.has(id)) this.network.session.game.requestDeleteMacro(id); }

    public requestAquireSkillInfo(id: number, level: number, mode = Number(this.aquireSkillFishing)) { if (this.network.actors.inWorld) this.network.session.game.requestAquireSkillInfo(id, level, mode); }

    public aquireSkill(id: number, level: number, mode = Number(this.aquireSkillFishing)) { if (this.network.actors.inWorld) this.network.session.game.requestAquireSkill(id, level, mode); }

    public deleteShortCut(page: number, slot: number) {
        const index = page * 12 + slot;

        if (!this.network.actors.inWorld || !this.shortcuts.has(index)) return;

        const source = this.shortcuts.get(index);
        const item = source.type === GamePackets.ShortCutType_T.TYPE_ITEM ? this.getShortCutItem(source) : null;

        if (item && this.autoSoulShots.has(item.itemId)) {
            const isKept = [...this.shortcuts.values()].some(shortcut => shortcut.slot !== index && shortcut.type === GamePackets.ShortCutType_T.TYPE_ITEM && this.getShortCutItem(shortcut)?.itemId === item.itemId);

            if (!isKept) this.network.session.game.requestAutoSoulShot(item.itemId, false);
        }

        this.network.session.game.requestShortCutDel(index);
        this.shortcuts.delete(index);
        this.network.ui.removeShortCut(index);
    }

    public requestEnchantSkillInfo(id: number, level: number) { if (this.network.actors.inWorld) this.network.session.game.requestExEnchantSkillInfo(id, level); }

    public enchantSkill(id: number, level: number) { if (this.network.actors.inWorld) this.network.session.game.requestExEnchantSkill(id, level); }

    public requestManorList() { if (this.network.actors.inWorld) this.network.session.game.requestManorList(); }

    public procureCrops(items: GamePackets.ProcureCropRequest_T[]) { if (this.network.actors.inWorld) this.network.session.game.requestProcureCropList(items); }

    public setManorSeeds(manorId: number, items: GamePackets.SeedSettingRequest_T[]) { if (this.network.actors.inWorld) this.network.session.game.requestSetSeed(manorId, items); }

    public setManorCrops(manorId: number, items: GamePackets.CropSettingRequest_T[]) { if (this.network.actors.inWorld) this.network.session.game.requestSetCrop(manorId, items); }
}

function caps(text: string) { return text.replace(/[a-z]/g, char => String.fromCharCode(char.charCodeAt(0) - 32)); } // Core FString::Caps 0x1011d018..0x1011d02f.

export default NetworkItems;
