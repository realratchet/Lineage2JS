import L2Socket from "./l2-socket";
import PacketReader from "./packet-reader";
import PacketWriter from "./packet-writer";
import { GameCrypt } from "./l2-crypt";
import { GameClientPacket_T, GameClientExPacket_T, GameServerPacket_T, PROTOCOL_REVISION, Say2_T, BlockType_T } from "./game-packets";
import type { Location_T, Macro_T, ItemCount_T, ItemIdCount_T, SellItemRequest_T, PrivateStoreOffer_T, PrivateStoreBuyOffer_T, PrivateStoreSellOffer_T, RecipeShopListEntry_T, ProcureCropRequest_T, SeedSettingRequest_T, CropSettingRequest_T } from "./game-packets";
import type { SessionKey_T } from "./login-client";

type GamePacketHandler_T = (opcode: GameServerPacket_T, packet: PacketReader) => void;

export type CharacterCreate_T = { name: string, race: number, sex: number, classId: number, INT: number, STR: number, CON: number, MEN: number, DEX: number, WIT: number, hairStyle: number, hairColor: number, face: number };

export class GameClient {
    protected readonly socket = new L2Socket();
    protected readonly crypt = new GameCrypt();

    public onPacket: GamePacketHandler_T = null;
    public onClose: (code: number, reason: string) => void = null;

    public constructor() {
        this.socket.onPacket = body => this.receive(body);
        this.socket.onClose = (code, reason) => { if (this.onClose) this.onClose(code, reason); };
    }

    protected receive(body: Uint8Array) {
        this.crypt.decrypt(body);

        const packet = new PacketReader(body);
        const opcode = packet.c();

        if (opcode === GameServerPacket_T.KeyPacket && !this.crypt.isActive()) {
            if (packet.c() === 0) throw new Error(`Game server rejected protocol revision ${PROTOCOL_REVISION}.`);

            this.crypt.setKey(packet.b(8));
        }

        this.onPacket(opcode, packet);
    }

    protected send(writer: PacketWriter) {
        const body = writer.toBytes();

        this.crypt.encrypt(body);
        this.socket.send(body);
    }

    protected write(opcode: GameClientPacket_T): PacketWriter { return new PacketWriter().c(opcode); }

    public async connect(url: string) {
        await this.socket.connect(url);
        this.send(this.write(GameClientPacket_T.ProtocolVersion).d(PROTOCOL_REVISION));
    }

    public isConnected() { return this.socket.isOpen(); }
    public close() { this.socket.close(); }

    public authLogin(account: string, key: SessionKey_T) { this.send(this.write(GameClientPacket_T.AuthLogin).S(account).d(key.playOk2).d(key.playOk1).d(key.loginOk1).d(key.loginOk2)); }
    public characterSelected(slot: number) { this.send(this.write(GameClientPacket_T.CharacterSelected).d(slot).h(0).d(0).d(0).d(0)); }
    public newCharacter() { this.send(this.write(GameClientPacket_T.NewCharacter)); }
    public characterDelete(slot: number) { this.send(this.write(GameClientPacket_T.CharacterDelete).d(slot)); }
    public characterRestore(slot: number) { this.send(this.write(GameClientPacket_T.CharacterRestore).d(slot)); }
    public enterWorld() { this.send(this.write(GameClientPacket_T.EnterWorld)); }
    public requestSkillList() { this.send(this.write(GameClientPacket_T.RequestSkillList)); }
    public requestShortCutReg(type: number, slot: number, id: number, level: number = 1) { this.send(this.write(GameClientPacket_T.RequestShortCutReg).d(type).d(slot).d(id).d(level)); }
    public requestAutoSoulShot(itemId: number, isEnabled: boolean) { this.send(this.write(GameClientPacket_T.Extended).h(GameClientExPacket_T.RequestAutoSoulShot).d(itemId).d(isEnabled ? 1 : 0)); }
    public requestSkillCoolTime() { this.send(this.write(GameClientPacket_T.RequestSkillCoolTime)); }
    public dlgAnswer(messageId: number, isOk: boolean) { this.send(this.write(GameClientPacket_T.DlgAnswer).d(messageId).d(isOk ? 1 : 0)); }
    public appearing() { this.send(this.write(GameClientPacket_T.Appearing)); }
    public logout() { this.send(this.write(GameClientPacket_T.Logout)); }
    public requestRestart() { this.send(this.write(GameClientPacket_T.RequestRestart)); }
    public requestRestartPoint(type: number) { this.send(this.write(GameClientPacket_T.RequestRestartPoint).d(type)); }
    public requestTargetCanceld() { this.send(this.write(GameClientPacket_T.RequestTargetCanceld).h(0)); }
    public changeMoveType(isRunning: boolean) { this.send(this.write(GameClientPacket_T.ChangeMoveType2).d(isRunning ? 1 : 0)); }
    public changeWaitType(isStanding: boolean) { this.send(this.write(GameClientPacket_T.ChangeWaitType2).d(isStanding ? 1 : 0)); }
    public requestSocialAction(actionId: number) { this.send(this.write(GameClientPacket_T.RequestSocialAction).d(actionId)); }
    public requestActionUse(actionId: number, ctrl: boolean, shift: boolean) { this.send(this.write(GameClientPacket_T.RequestActionUse).d(actionId).d(ctrl ? 1 : 0).c(shift ? 1 : 0)); }
    public requestMagicSkillUse(skillId: number, ctrl: boolean, shift: boolean) { this.send(this.write(GameClientPacket_T.RequestMagicSkillUse).d(skillId).d(ctrl ? 1 : 0).c(shift ? 1 : 0)); }
    public requestBypassToServer(command: string) { this.send(this.write(GameClientPacket_T.RequestBypassToServer).S(command)); }
    public requestJoinPledge(objectId: number) { this.send(this.write(GameClientPacket_T.RequestJoinPledge).d(objectId)); }
    public answerJoinPledge(isAccepted: boolean) { this.send(this.write(GameClientPacket_T.RequestAnswerJoinPledge).d(isAccepted ? 1 : 0)); }
    public requestJoinParty(name: string, itemDistribution: number) { this.send(this.write(GameClientPacket_T.RequestJoinParty).S(name).d(itemDistribution)); }
    public answerJoinParty(isAccepted: boolean) { this.send(this.write(GameClientPacket_T.RequestAnswerJoinParty).d(isAccepted ? 1 : 0)); }
    public requestFriendInvite(name: string) { this.send(this.write(GameClientPacket_T.RequestFriendInvite).S(name)); }
    public answerFriendInvite(isAccepted: boolean) { this.send(this.write(GameClientPacket_T.RequestAnswerFriendInvite).d(isAccepted ? 1 : 0)); }
    public sendBypassBuildCmd(command: string) { this.send(this.write(GameClientPacket_T.SendBypassBuildCmd).S(command)); } // UNetworkHandler::SendBypassBuildCmd, Engine.dll 0x6c8fd0: "cS", 0x5b.
    public requestLinkHtml(link: string) { this.send(this.write(GameClientPacket_T.RequestLinkHtml).S(link)); }
    public useItem(objectId: number, ctrl: boolean = false) { this.send(this.write(GameClientPacket_T.UseItem).d(objectId).d(ctrl ? 1 : 0)); }
    public requestEnchantItem(objectId: number) { this.send(this.write(GameClientPacket_T.RequestEnchantItem).d(objectId)); }
    public requestItemList() { this.send(this.write(GameClientPacket_T.RequestItemList)); }

    public characterCreate(info: CharacterCreate_T) {
        this.send(this.write(GameClientPacket_T.CharacterCreate).S(info.name).d(info.race).d(info.sex).d(info.classId).d(info.INT).d(info.STR).d(info.CON).d(info.MEN).d(info.DEX).d(info.WIT).d(info.hairStyle).d(info.hairColor).d(info.face));
    }

    public moveBackwardToLocation(target: Location_T, origin: Location_T) { // Omitting moveType flags the client as L2Walker.
        this.send(this.write(GameClientPacket_T.MoveBackwardToLocation).d(Math.round(target.x)).d(Math.round(target.y)).d(Math.round(target.z)).d(Math.round(origin.x)).d(Math.round(origin.y)).d(Math.round(origin.z)).d(1));
    }

    public validatePosition(position: Location_T, heading: number) {
        this.send(this.write(GameClientPacket_T.ValidatePosition).d(Math.round(position.x)).d(Math.round(position.y)).d(Math.round(position.z)).d(heading).d(0));
    }

    public cannotMoveAnymore(position: Location_T, heading: number) {
        this.send(this.write(GameClientPacket_T.CannotMoveAnymore).d(Math.round(position.x)).d(Math.round(position.y)).d(Math.round(position.z)).d(heading));
    }

    public action(objectId: number, origin: Location_T, isShift: boolean) {
        if (objectId <= 0) return;

        this.send(this.write(GameClientPacket_T.Action).d(objectId).d(Math.trunc(Math.fround(origin.x))).d(Math.trunc(Math.fround(origin.y))).d(Math.trunc(Math.fround(origin.z))).c(isShift ? 1 : 0));
    }

    public attackRequest(objectId: number, origin: Location_T, isShift: boolean) {
        if (objectId <= 0) return;

        this.send(this.write(GameClientPacket_T.AttackRequest).d(objectId).d(Math.trunc(Math.fround(origin.x))).d(Math.trunc(Math.fround(origin.y))).d(Math.trunc(Math.fround(origin.z))).c(isShift ? 1 : 0));
    }

    public say2(text: string, type: Say2_T, target: string = null) {
        const writer = this.write(GameClientPacket_T.Say2).S(text).d(type);

        if (type === Say2_T.TELL) writer.S(target);

        this.send(writer);
    }

    public requestPledgeInfo(clanId: number) { this.send(this.write(GameClientPacket_T.RequestPledgeInfo).d(clanId)); }
    public requestPledgeMemberList() { this.send(this.write(GameClientPacket_T.RequestPledgeMemberList)); }
    public requestWithdrawalPledge() { this.send(this.write(GameClientPacket_T.RequestWithdrawalPledge)); }
    public requestOustPledgeMember(name: string) { this.send(this.write(GameClientPacket_T.RequestOustPledgeMember).S(name)); }
    public requestGiveNickName(name: string, title: string) { this.send(this.write(GameClientPacket_T.RequestGiveNickName).S(name).S(title)); }
    public requestPledgePower(objectId: number) { this.send(this.write(GameClientPacket_T.RequestPledgePower).d(objectId).d(1)); }
    public requestMemberPledgePower(objectId: number) { this.send(this.write(GameClientPacket_T.RequestPledgePower).d(objectId).d(2)); }
    public setMemberPledgePower(objectId: number, privs: Uint8Array) {
        if (privs.length !== 32) throw new Error(`Invalid pledge power size ${privs.length}.`);

        this.send(this.write(GameClientPacket_T.RequestPledgePower).d(objectId).d(3).b(privs));
    }
    public requestStartPledgeWar(pledgeName: string) { this.send(this.write(GameClientPacket_T.RequestStartPledgeWar).S(pledgeName)); }
    public requestReplyStartPledgeWar(name: string, isAccepted: boolean) { this.send(this.write(GameClientPacket_T.RequestReplyStartPledgeWar).S(name).d(isAccepted ? 1 : 0)); }
    public requestStopPledgeWar(pledgeName: string) { this.send(this.write(GameClientPacket_T.RequestStopPledgeWar).S(pledgeName)); }
    public requestReplyStopPledgeWar(name: string, isAccepted: boolean) { this.send(this.write(GameClientPacket_T.RequestReplyStopPledgeWar).S(name).d(isAccepted ? 1 : 0)); }
    public requestSurrenderPledgeWar(pledgeName: string) { this.send(this.write(GameClientPacket_T.RequestSurrenderPledgeWar).S(pledgeName)); }
    public requestReplySurrenderPledgeWar(name: string, isAccepted: boolean) { this.send(this.write(GameClientPacket_T.RequestReplySurrenderPledgeWar).S(name).d(isAccepted ? 1 : 0)); }
    public requestSurrenderPersonally(pledgeName: string) { this.send(this.write(GameClientPacket_T.RequestSurrenderPersonally).S(pledgeName)); }
    public requestSetPledgeCrest(data: Uint8Array) { this.send(this.write(GameClientPacket_T.RequestSetPledgeCrest).d(data.length).b(data)); }
    public requestPledgeCrest(crestId: number) { this.send(this.write(GameClientPacket_T.RequestPledgeCrest).d(crestId)); }
    public requestExPledgeCrestLarge(crestId: number) { this.send(this.write(GameClientPacket_T.Extended).h(GameClientExPacket_T.RequestExPledgeCrestLarge).d(crestId)); }
    public requestExSetPledgeCrestLarge(data: Uint8Array) { this.send(this.write(GameClientPacket_T.Extended).h(GameClientExPacket_T.RequestExSetPledgeCrestLarge).d(data.length).b(data)); }
    public requestJoinAlly(objectId: number) { this.send(this.write(GameClientPacket_T.RequestJoinAlly).d(objectId)); }
    public answerJoinAlly(isAccepted: boolean) { this.send(this.write(GameClientPacket_T.RequestAnswerJoinAlly).d(isAccepted ? 1 : 0)); }
    public allyLeave() { this.send(this.write(GameClientPacket_T.AllyLeave)); }
    public allyDismiss(clanName: string) { this.send(this.write(GameClientPacket_T.AllyDismiss).S(clanName)); }
    public requestDismissAlly() { this.send(this.write(GameClientPacket_T.RequestDismissAlly)); }
    public requestSetAllyCrest(data: Uint8Array) { this.send(this.write(GameClientPacket_T.RequestSetAllyCrest).d(data.length).b(data)); }
    public requestAllyCrest(crestId: number) { this.send(this.write(GameClientPacket_T.RequestAllyCrest).d(crestId)); }
    public requestAllyInfo() { this.send(this.write(GameClientPacket_T.RequestAllyInfo)); }



    public tradeRequest(objectId: number) { this.send(this.write(GameClientPacket_T.TradeRequest).d(objectId)); }
    public addTradeItem(objectId: number, count: number) { this.send(this.write(GameClientPacket_T.AddTradeItem).d(1).d(objectId).d(count)); }
    public tradeDone(isConfirmed: boolean) { this.send(this.write(GameClientPacket_T.TradeDone).d(isConfirmed ? 1 : 0)); }
    public answerTradeRequest(isAccepted: boolean) { this.send(this.write(GameClientPacket_T.AnswerTradeRequest).d(isAccepted ? 1 : 0)); }
    public requestPrivateStoreManageSell() { this.send(this.write(GameClientPacket_T.RequestPrivateStoreManageSell)); }
    public requestPrivateStoreQuitSell() { this.send(this.write(GameClientPacket_T.RequestPrivateStoreQuitSell)); }
    public setPrivateStoreMsgSell(message: string) { this.send(this.write(GameClientPacket_T.SetPrivateStoreMsgSell).S(message)); }
    public requestPrivateStoreManageBuy() { this.send(this.write(GameClientPacket_T.RequestPrivateStoreManageBuy)); }
    public requestPrivateStoreManageCancelBuy() { this.send(this.write(GameClientPacket_T.RequestPrivateStoreManageCancelBuy)); }
    public requestPrivateStoreQuitBuy() { this.send(this.write(GameClientPacket_T.RequestPrivateStoreQuitBuy)); }
    public setPrivateStoreMsgBuy(message: string) { this.send(this.write(GameClientPacket_T.SetPrivateStoreMsgBuy).S(message)); }
    public requestPackageSendableItemList(objectId: number) { this.send(this.write(GameClientPacket_T.RequestPackageSendableItemList).d(objectId)); }
    public multiSellChoose(listId: number, entryId: number, amount: number) { this.send(this.write(GameClientPacket_T.MultiSellChoose).d(listId).d(entryId).d(amount)); } // entryId already carries enchant as id*100000+enchant.
    public requestDestroyItem(objectId: number, count: number) { this.send(this.write(GameClientPacket_T.RequestDestroyItem).d(objectId).d(count)); }
    public requestUnEquipItem(bodyPart: number) { this.send(this.write(GameClientPacket_T.RequestUnEquipItem).d(bodyPart)); }
    public requestCrystallizeItem(objectId: number, count: number) { this.send(this.write(GameClientPacket_T.RequestCrystallizeItem).d(objectId).d(count)); }
    public requestGiveItemToPet(objectId: number, count: number) { this.send(this.write(GameClientPacket_T.RequestGiveItemToPet).d(objectId).d(count)); }
    public requestGetItemFromPet(objectId: number, count: number) { this.send(this.write(GameClientPacket_T.RequestGetItemFromPet).d(objectId).d(count).d(0)); }
    public requestPetUseItem(objectId: number) { this.send(this.write(GameClientPacket_T.RequestPetUseItem).d(objectId)); }
    public requestPetGetItem(objectId: number) { this.send(this.write(GameClientPacket_T.RequestPetGetItem).d(objectId)); }
    public requestChangePetName(name: string) { this.send(this.write(GameClientPacket_T.RequestChangePetName).S(name)); }

    public requestDropItem(objectId: number, count: number, point: Location_T) {
        this.send(this.write(GameClientPacket_T.RequestDropItem).d(objectId).d(count).d(Math.trunc(point.x)).d(Math.trunc(point.y)).d(Math.trunc(point.z)));
    }

    public sendWareHouseDepositList(items: ItemCount_T[]) {
        const writer = this.write(GameClientPacket_T.SendWareHouseDepositList).d(items.length);

        for (const item of items) writer.d(item.objectId).d(item.count);

        this.send(writer);
    }

    public sendWareHouseWithDrawList(items: ItemCount_T[]) {
        const writer = this.write(GameClientPacket_T.SendWareHouseWithDrawList).d(items.length);

        for (const item of items) writer.d(item.objectId).d(item.count);

        this.send(writer);
    }

    public setPrivateStoreListSell(isPackage: boolean, items: PrivateStoreOffer_T[]) {
        const writer = this.write(GameClientPacket_T.SetPrivateStoreListSell).d(isPackage ? 1 : 0).d(items.length);

        for (const item of items) writer.d(item.objectId).d(item.count).d(item.price);

        this.send(writer);
    }

    public requestPrivateStoreBuy(storePlayerId: number, items: PrivateStoreOffer_T[]) {
        const writer = this.write(GameClientPacket_T.RequestPrivateStoreBuy).d(storePlayerId).d(items.length);

        for (const item of items) writer.d(item.objectId).d(item.count).d(item.price);

        this.send(writer);
    }

    public setPrivateStoreListBuy(items: PrivateStoreBuyOffer_T[]) {
        const writer = this.write(GameClientPacket_T.SetPrivateStoreListBuy).d(items.length);

        for (const item of items) writer.d(item.itemId).h(item.enchantLevel).h(item.type2).d(item.count).d(item.price);

        this.send(writer);
    }

    public requestPrivateStoreSell(storePlayerId: number, items: PrivateStoreSellOffer_T[]) {
        const writer = this.write(GameClientPacket_T.RequestPrivateStoreSell).d(storePlayerId).d(items.length);

        for (const item of items) writer.d(item.objectId).d(item.itemId).h(item.enchantLevel).h(item.type2).d(item.count).d(item.price);

        this.send(writer);
    }

    public requestPackageSend(objectId: number, items: ItemCount_T[]) {
        const writer = this.write(GameClientPacket_T.RequestPackageSend).d(objectId).d(items.length);

        for (const item of items) writer.d(item.objectId).d(item.count);

        this.send(writer);
    }

    public requestPreviewItem(unknown: number, listId: number, itemIds: number[]) {
        const writer = this.write(GameClientPacket_T.RequestPreviewItem).d(unknown).d(listId).d(itemIds.length);

        for (const itemId of itemIds) writer.d(itemId);

        this.send(writer);
    }

    public requestBuySeed(manorId: number, items: ItemIdCount_T[]) {
        const writer = this.write(GameClientPacket_T.RequestBuySeed).d(manorId).d(items.length);

        for (const item of items) writer.d(item.itemId).d(item.count);

        this.send(writer);
    }

    public requestBuyProcure(listId: number, items: SellItemRequest_T[]) {
        const writer = this.write(GameClientPacket_T.RequestBuyProcure).d(listId).d(items.length);

        for (const item of items) writer.d(item.objectId).d(item.itemId).d(item.count);

        this.send(writer);
    }

    public requestSellItem(listId: number, items: SellItemRequest_T[]) {
        const writer = this.write(GameClientPacket_T.RequestSellItem).d(listId).d(items.length);

        for (const item of items) writer.d(item.objectId).d(item.itemId).d(item.count);

        this.send(writer);
    }

    public requestBuyItem(listId: number, items: ItemIdCount_T[]) {
        const writer = this.write(GameClientPacket_T.RequestBuyItem).d(listId).d(items.length);

        for (const item of items) writer.d(item.itemId).d(item.count);

        this.send(writer);
    }

    public observerReturn() { this.send(this.write(GameClientPacket_T.ObserverReturn)); }
    public requestSSQStatus(page: number) { this.send(this.write(GameClientPacket_T.RequestSSQStatus).c(page)); }
    public requestSiegeAttackerList(castleId: number) { this.send(this.write(GameClientPacket_T.RequestSiegeAttackerList).d(castleId)); }
    public requestSiegeDefenderList(castleId: number) { this.send(this.write(GameClientPacket_T.RequestSiegeDefenderList).d(castleId)); }
    public requestJoinSiege(castleId: number, isAttacker: boolean, isJoining: boolean) { this.send(this.write(GameClientPacket_T.RequestJoinSiege).d(castleId).d(isAttacker ? 1 : 0).d(isJoining ? 1 : 0)); }
    public requestConfirmSiegeWaitingList(castleId: number, clanId: number, isApproved: boolean) { this.send(this.write(GameClientPacket_T.RequestConfirmSiegeWaitingList).d(castleId).d(clanId).d(isApproved ? 1 : 0)); }
    public gameGuardReply() { this.send(this.write(GameClientPacket_T.GameGuardReply)); } // GameGuardReply.readImpl reads nothing; runImpl just flags the client gg-ok.
    public startRotating(heading: number, side: number) { this.send(this.write(GameClientPacket_T.StartRotating).d(heading).d(side)); }
    public finishRotating(heading: number, unknown: number) { this.send(this.write(GameClientPacket_T.FinishRotating).d(heading).d(unknown)); }
    public requestRecordInfo() { this.send(this.write(GameClientPacket_T.RequestRecordInfo)); }
    public requestShowMiniMap() { this.send(this.write(GameClientPacket_T.RequestShowMiniMap)); }

    public requestGetOnVehicle(vehicleId: number, position: Location_T) {
        this.send(this.write(GameClientPacket_T.RequestGetOnVehicle).d(vehicleId).d(Math.round(position.x)).d(Math.round(position.y)).d(Math.round(position.z)));
    }

    public requestGetOffVehicle(vehicleId: number, position: Location_T) {
        this.send(this.write(GameClientPacket_T.RequestGetOffVehicle).d(vehicleId).d(Math.round(position.x)).d(Math.round(position.y)).d(Math.round(position.z)));
    }

    public requestMoveToLocationInVehicle(vehicleId: number, target: Location_T, origin: Location_T) {
        this.send(this.write(GameClientPacket_T.RequestMoveToLocationInVehicle).d(vehicleId).d(Math.round(target.x)).d(Math.round(target.y)).d(Math.round(target.z)).d(Math.round(origin.x)).d(Math.round(origin.y)).d(Math.round(origin.z)));
    }

    public cannotMoveAnymoreInVehicle(vehicleId: number, position: Location_T, heading: number) {
        this.send(this.write(GameClientPacket_T.CannotMoveAnymoreInVehicle).d(vehicleId).d(Math.round(position.x)).d(Math.round(position.y)).d(Math.round(position.z)).d(heading));
    }

    public requestRecipeBookOpen(isDwarven: boolean) { this.send(this.write(GameClientPacket_T.RequestRecipeBookOpen).d(isDwarven ? 0 : 1)); }
    public requestRecipeBookDestroy(recipeId: number) { this.send(this.write(GameClientPacket_T.RequestRecipeBookDestroy).d(recipeId)); }
    public requestRecipeItemMakeInfo(recipeId: number) { this.send(this.write(GameClientPacket_T.RequestRecipeItemMakeInfo).d(recipeId)); }
    public requestRecipeItemMakeSelf(recipeId: number) { this.send(this.write(GameClientPacket_T.RequestRecipeItemMakeSelf).d(recipeId)); }
    public requestRecipeShopManageList() { this.send(this.write(GameClientPacket_T.RequestRecipeShopManageList)); }
    public requestRecipeShopMessageSet(name: string) { this.send(this.write(GameClientPacket_T.RequestRecipeShopMessageSet).S(name)); }
    public requestRecipeShopManageQuit() { this.send(this.write(GameClientPacket_T.RequestRecipeShopManageQuit)); }
    public requestRecipeShopManageCancel() { this.send(this.write(GameClientPacket_T.RequestRecipeShopManageCancel)); }
    public requestRecipeShopMakeInfo(objectId: number, recipeId: number) { this.send(this.write(GameClientPacket_T.RequestRecipeShopMakeInfo).d(objectId).d(recipeId)); }
    public requestRecipeShopMakeItem(objectId: number, recipeId: number, price: number) { this.send(this.write(GameClientPacket_T.RequestRecipeShopMakeItem).d(objectId).d(recipeId).d(price)); }
    public requestRecipeShopManagePrev(objectId: number) { this.send(this.write(GameClientPacket_T.RequestRecipeShopManagePrev).d(objectId)); }
    public requestHennaList(unknown: number) { this.send(this.write(GameClientPacket_T.RequestHennaList).d(unknown)); }
    public requestHennaItemInfo(symbolId: number) { this.send(this.write(GameClientPacket_T.RequestHennaItemInfo).d(symbolId)); }
    public requestHennaEquip(symbolId: number) { this.send(this.write(GameClientPacket_T.RequestHennaEquip).d(symbolId)); }
    public requestHennaUnequipList(unknown: number) { this.send(this.write(GameClientPacket_T.RequestHennaUnequipList).d(unknown)); }
    public requestHennaUnequipInfo(symbolId: number) { this.send(this.write(GameClientPacket_T.RequestHennaUnequipInfo).d(symbolId)); }
    public requestHennaUnequip(symbolId: number) { this.send(this.write(GameClientPacket_T.RequestHennaUnequip).d(symbolId)); }
    public requestPartyMatchConfig(page: number, location: number, limit: number) { this.send(this.write(GameClientPacket_T.RequestPartyMatchConfig).d(page).d(location).d(limit)); }
    public requestPartyMatchList(roomId: number, maxMembers: number, minLevel: number, maxLevel: number, lootType: number, title: string) { this.send(this.write(GameClientPacket_T.RequestPartyMatchList).d(roomId).d(maxMembers).d(minLevel).d(maxLevel).d(lootType).S(title)); }
    public requestPartyMatchDetail(roomId: number, location: number) { this.send(this.write(GameClientPacket_T.RequestPartyMatchDetail).d(roomId).d(location)); }
    public requestWithDrawalParty() { this.send(this.write(GameClientPacket_T.RequestWithDrawalParty)); }
    public requestOustPartyMember(name: string) { this.send(this.write(GameClientPacket_T.RequestOustPartyMember).S(name)); }
    public requestTutorialLinkHtml(link: string) { this.send(this.write(GameClientPacket_T.RequestTutorialLinkHtml).S(link)); }
    public requestTutorialPassCmdToServer(command: string) { this.send(this.write(GameClientPacket_T.RequestTutorialPassCmdToServer).S(command)); }
    public requestTutorialQuestionMark(id: number) { this.send(this.write(GameClientPacket_T.RequestTutorialQuestionMark).d(id)); }
    public requestTutorialClientEvent(eventId: number) { this.send(this.write(GameClientPacket_T.RequestTutorialClientEvent).d(eventId)); }
    public requestGMCommand(targetName: string, command: number) { this.send(this.write(GameClientPacket_T.RequestGMCommand).S(targetName).d(command).d(0)); }
    public requestGmList() { this.send(this.write(GameClientPacket_T.RequestGmList)); }
    public snoopQuit(objectId: number) { this.send(this.write(GameClientPacket_T.SnoopQuit).d(objectId)); }
    public requestPetition(content: string, type: number) { this.send(this.write(GameClientPacket_T.RequestPetition).S(content).d(type)); }
    public requestPetitionCancel() { this.send(this.write(GameClientPacket_T.RequestPetitionCancel)); }
    public requestFriendList() { this.send(this.write(GameClientPacket_T.RequestFriendList)); }
    public requestFriendDel(name: string) { this.send(this.write(GameClientPacket_T.RequestFriendDel).S(name)); }
    public requestSendFriendMsg(message: string, receiver: string) { this.send(this.write(GameClientPacket_T.RequestSendFriendMsg).S(message).S(receiver)); }
    public requestQuestList() { this.send(this.write(GameClientPacket_T.RequestQuestList)); }
    public requestQuestAbort(questId: number) { this.send(this.write(GameClientPacket_T.RequestQuestAbort).d(questId)); }
    public requestDeleteMacro(id: number) { this.send(this.write(GameClientPacket_T.RequestDeleteMacro).d(id)); }
    public requestShortCutDel(slot: number) { this.send(this.write(GameClientPacket_T.RequestShortCutDel).d(slot)); }
    public requestUserCommand(id: number) { this.send(this.write(GameClientPacket_T.RequestUserCommand).d(id)); }
    public requestEvaluate(objectId: number) { this.send(this.write(GameClientPacket_T.RequestEvaluate).d(objectId)); }
    public requestShowBoard(unknown: number) { this.send(this.write(GameClientPacket_T.RequestShowBoard).d(unknown)); }
    public requestBBSwrite(url: string, arg1: string, arg2: string, arg3: string, arg4: string, arg5: string) { this.send(this.write(GameClientPacket_T.RequestBBSwrite).S(url).S(arg1).S(arg2).S(arg3).S(arg4).S(arg5)); }
    public requestAquireSkillInfo(id: number, level: number, mode: number) { this.send(this.write(GameClientPacket_T.RequestAquireSkillInfo).d(id).d(level).d(mode)); }
    public requestAquireSkill(id: number, level: number, mode: number) { this.send(this.write(GameClientPacket_T.RequestAquireSkill).d(id).d(level).d(mode)); }

    public requestRecipeShopListSet(items: RecipeShopListEntry_T[]) {
        const writer = this.write(GameClientPacket_T.RequestRecipeShopListSet).d(items.length);

        for (const item of items) writer.d(item.recipeId).d(item.cost);

        this.send(writer);
    }

    public requestMakeMacro(macro: Macro_T) {
        const writer = this.write(GameClientPacket_T.RequestMakeMacro).d(macro.id).S(macro.name).S(macro.description).S(macro.acronym).c(macro.icon).c(macro.commands.length);

        for (const command of macro.commands) writer.c(command.index).c(command.type).d(command.data1).c(command.data2).S(command.command);

        this.send(writer);
    }

    public requestBlock(type: BlockType_T, name: string = null) {
        const writer = this.write(GameClientPacket_T.RequestBlock).d(type);

        if (type === BlockType_T.BLOCK || type === BlockType_T.UNBLOCK) writer.S(name);

        this.send(writer);
    }

    public requestOustFromPartyRoom(objectId: number) { this.send(this.write(GameClientPacket_T.Extended).h(GameClientExPacket_T.RequestOustFromPartyRoom).d(objectId)); }
    public requestDismissPartyRoom(roomId: number) { this.send(this.write(GameClientPacket_T.Extended).h(GameClientExPacket_T.RequestDismissPartyRoom).d(roomId).d(0)); }
    public requestWithdrawPartyRoom(roomId: number) { this.send(this.write(GameClientPacket_T.Extended).h(GameClientExPacket_T.RequestWithdrawPartyRoom).d(roomId).d(0)); }
    public requestChangePartyLeader(name: string) { this.send(this.write(GameClientPacket_T.Extended).h(GameClientExPacket_T.RequestChangePartyLeader).S(name)); }
    public requestExEnchantSkillInfo(id: number, level: number) { this.send(this.write(GameClientPacket_T.Extended).h(GameClientExPacket_T.RequestExEnchantSkillInfo).d(id).d(level)); }
    public requestExEnchantSkill(id: number, level: number) { this.send(this.write(GameClientPacket_T.Extended).h(GameClientExPacket_T.RequestExEnchantSkill).d(id).d(level)); }
    public requestManorList() { this.send(this.write(GameClientPacket_T.Extended).h(GameClientExPacket_T.RequestManorList)); }
    public requestWriteHeroWords(words: string) { this.send(this.write(GameClientPacket_T.Extended).h(GameClientExPacket_T.RequestWriteHeroWords).S(words)); }
    public requestExAskJoinMPCC(name: string) { this.send(this.write(GameClientPacket_T.Extended).h(GameClientExPacket_T.RequestExAskJoinMPCC).S(name)); }
    public requestExAcceptJoinMPCC(isAccepted: boolean) { this.send(this.write(GameClientPacket_T.Extended).h(GameClientExPacket_T.RequestExAcceptJoinMPCC).d(isAccepted ? 1 : 0)); }
    public requestExOustFromMPCC(name: string) { this.send(this.write(GameClientPacket_T.Extended).h(GameClientExPacket_T.RequestExOustFromMPCC).S(name)); }
    public requestOlympiadObserverEnd() { this.send(this.write(GameClientPacket_T.Extended).h(GameClientExPacket_T.RequestOlympiadObserverEnd)); }
    public requestOlympiadMatchList() { this.send(this.write(GameClientPacket_T.Extended).h(GameClientExPacket_T.RequestOlympiadMatchList)); }

    public requestProcureCropList(items: ProcureCropRequest_T[]) {
        const writer = this.write(GameClientPacket_T.Extended).h(GameClientExPacket_T.RequestProcureCropList).d(items.length);

        for (const item of items) writer.d(item.objectId).d(item.itemId).d(item.manorId).d(item.count);

        this.send(writer);
    }

    public requestSetSeed(manorId: number, items: SeedSettingRequest_T[]) {
        const writer = this.write(GameClientPacket_T.Extended).h(GameClientExPacket_T.RequestSetSeed).d(manorId).d(items.length);

        for (const item of items) writer.d(item.seedId).d(item.sales).d(item.price);

        this.send(writer);
    }

    public requestSetCrop(manorId: number, items: CropSettingRequest_T[]) {
        const writer = this.write(GameClientPacket_T.Extended).h(GameClientExPacket_T.RequestSetCrop).d(manorId).d(items.length);

        for (const item of items) writer.d(item.cropId).d(item.sales).d(item.price).c(item.rewardType);

        this.send(writer);
    }
}

export default GameClient;
