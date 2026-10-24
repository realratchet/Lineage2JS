import { EInputKey_T, EInputAction_T } from "@l2js/engine/un-interactions";
import type NetworkManager from "./network-manager";
import { Vector3 } from "three";
import BaseActor from "../base-actor";
import LoginClient, { type SessionKey_T } from "./login-client";
import GameClient, { type CharacterCreate_T } from "./game-client";
import L2Lobby from "./l2-lobby";
import L2ReplayFile from "./l2-replay-file";
import { saveReplayFile } from "./replay-files";
import * as GamePackets from "./game-packets";
import PacketReader from "./packet-reader";
import type { PawnCreateSelection_T } from "../nwindow/nc-pawn-create-wnd";
import type { ICharacterGroup } from "@l2js/engine/contracts/pawn";
import { setVector } from "./network-location";

export enum GMTransferPhase_T { Idle, Queued, Restart, Reconnect, Login, SelectServer, SelectCharacter, Complete }

type GMServerTransfer_T = { phase: GMTransferPhase_T, lastPhase: GMTransferPhase_T, serverId: number, position: GamePackets.Location_T, selectedSlot: number, error: string };

const GAME_TIME_SCALE = 1 / 6; // GameTimeController: one in-game day lasts four real hours.

export class NetworkSession {
    public login: LoginClient = null;
    public lobby: L2Lobby = null;
    protected loginUrl: string = null;
    public gameServerUrl: string = null;
    public game: GameClient = null;
    public account: string = null;
    protected loginAccount: string = null;
    protected loginPassword: string = null;
    public gmTransfer: GMServerTransfer_T = null;
    public sessionKey: SessionKey_T = null;
    public characters: GamePackets.CharSelectEntry_T[] = [];
    public templates: GamePackets.CharTemplate_T[] = [];
    public charGroups: ICharacterGroup[] = null;
    public selectedSlot = -1;
    public replayLoading = false;

    public constructor(protected readonly network: NetworkManager) {}

    public async showLogin(url: string) {
        this.loginUrl = url;

        const asset = this.network.getParent().getComponent("asset"), render = this.network.getParent().getComponent("render");

        asset.setStreaming(render, false);

        if (!this.network.ui) {
            this.network.ui = this.network.getParent().getComponent("gui");
            this.network.ui.create();
            this.lobby = new L2Lobby(this.network.getParent(), (appearance, actor) => this.network.actors.loadAppearance(appearance, actor));

            await this.network.ui.setStrings(await asset.getGameStrings());

            void this.network.actors.loadNpcNames();
            void this.network.community.loadRadar();

            await Promise.all([this.network.ui.createScreens(), this.lobby.enter(this.network.ui.getStrings().logonSpots), asset.precacheCharacters()]);
        } else await this.lobby.enter(this.network.ui.getStrings().logonSpots);

        this.lobby.showLogin();
        this.network.ui.showLogin();
    }

    public async connectLogin(account: string, password: string) {
        if (this.game?.isPlayingReplay()) throw new Error(`Cannot log in during replay playback.`);
        this.gmTransfer = null;
        if (this.login) this.login.close();

        this.loginAccount = account;
        this.loginPassword = password;
        const login = this.login = new LoginClient();
        this.account = account.toLowerCase();
        this.network.ui.setLoginBusy(true);

        try {
            const servers = await login.login(this.loginUrl, account, password);

            if (this.login !== login) return;
            this.network.ui.showServers(servers, login.lastServerId);
        } catch (e) {
            if (this.login !== login) return;
            this.network.ui.showLogin();
            this.network.ui.showMessage(this.getLoginErrorMessage(e));
        }
    }

    public cancelLogin() {
        this.gmTransfer = null;
        const login = this.login;

        this.login = null;
        if (login) login.close();
        this.network.ui.showLogin();
    }

    public async connectGame(serverId: number) {
        const login = this.login, transfer = this.gmTransfer;
        const server = login.servers.find(entry => entry.id === serverId);

        try {
            const key = await login.selectServer(server.id);

            if (this.login !== login || this.gmTransfer !== transfer) return;
            this.sessionKey = key;
            this.network.ui.setCrestServer(server.id);
            const game = this.game = new GameClient();

            game.onPacket = (opcode, packet) => { if (this.game === game) this.network.onPacket(opcode, packet); };
            game.onClose = (code, reason) => { if (this.game === game) void this.onDisconnected(`Game server closed the connection (${code}${reason ? ` ${reason}` : ""}).`); };

            this.gameServerUrl = login.getGameServerUrl(server);
            await game.connect(this.gameServerUrl);
        } catch (e) {
            if (this.login !== login || this.gmTransfer !== transfer) return;
            if (transfer) transfer.error = (e as Error).message;
            this.network.ui.showLogin();
            this.network.ui.showMessage(this.getLoginErrorMessage(e));
        }
    }

    protected getLoginErrorMessage(e: any): string {
        if (!e.systemMessageIds) return e.message;

        return e.systemMessageIds.map((id: number) => this.network.ui.getSystemMessage(id)).join(" ");
    }

    public relogin() {
        this.game.close();
        this.game = null;
        this.lobby.showLogin();
        this.network.ui.showLogin();
    }

    public pickLobbyPawn(actor: BaseActor) {
        if (!this.lobby || !this.network.ui.isLobbyVisible()) return;

        const index = this.lobby.getPawnIndex(actor);

        if (index < 0) return;
        if (actor === this.lobby.getSelectedPawn()) this.network.combat.playSocialAction(actor, 3);
        this.network.ui.pickCharacter(index);
    }

    public previewCharacter(index: number) {
        if (this.gmTransfer) this.gmTransfer.selectedSlot = index;
        this.lobby.select(index);
        this.network.ui.setSelectedCharacter(index);
    }

    public cancelCreate() {
        this.network.ui.showCharacters(this.characters);
        void this.lobby.showSelect(this.characters);
    }

    public previewCreate(selection: PawnCreateSelection_T) { void this.lobby.previewCreate(selection); }

    public rotateCreatePreview(direction: number) { this.lobby.rotateCreate(direction); }

    public zoomCreatePreview(isIn: boolean) { this.lobby.zoomCreate(isIn); }

    public selectCharacter(slot: number) {
        const character = this.characters[slot];

        if (slot < 0 || slot >= 7 || !character || character.deleteSeconds > 0 || character.isDeletionMarked) return;
        if (character.name && !this.network.ui.getScreenCanvas().hasGlyphs(character.name)) { this.network.ui.showMessage(this.network.ui.getSystemMessage(205)); return; }

        this.selectedSlot = slot;
        this.network.ui.showLoading();
        this.game.characterSelected(slot, this.gmTransfer ? this.gmTransfer.position : null);
    }

    public startGMServerTransfer(serverId: number) {
        if (!this.network.actors.inWorld) return;
        if (this.loginAccount === null || this.loginPassword === null) throw new Error(`GM server transfer has no saved authentication.`);
        const position = this.network.getParent().getComponent("render").player.position;

        this.gmTransfer = { phase: GMTransferPhase_T.Queued, lastPhase: GMTransferPhase_T.Idle, serverId, position: { x: Math.fround(position.x), y: Math.fround(position.y), z: Math.fround(position.z) }, selectedSlot: -1, error: null };
    }

    public tickGMServerTransfer() {
        const transfer = this.gmTransfer;

        if (!transfer || transfer.error || transfer.phase === transfer.lastPhase) return;
        transfer.lastPhase = transfer.phase;
        switch (transfer.phase) {
            case GMTransferPhase_T.Queued: transfer.phase = GMTransferPhase_T.Restart; break;
            case GMTransferPhase_T.Restart: this.game.requestRestart(); break;
            case GMTransferPhase_T.Reconnect: void this.reconnectGMServer(transfer); break;
            case GMTransferPhase_T.Login: break;
            case GMTransferPhase_T.SelectServer:
                if (transfer.serverId > 0 && this.login.servers.some(server => server.id === transfer.serverId)) void this.connectGame(transfer.serverId);
                break;
            case GMTransferPhase_T.SelectCharacter:
                this.selectCharacter(transfer.selectedSlot);
                transfer.phase = GMTransferPhase_T.Complete;
                this.gmTransfer = null;
                break;
            case GMTransferPhase_T.Complete: this.gmTransfer = null; break;
            default: throw new Error(`Invalid GM transfer phase ${transfer.phase}.`);
        }
    }

    protected async reconnectGMServer(transfer: GMServerTransfer_T) {
        this.game.logout();
        this.game.onClose = null;
        this.game.close();
        this.game = null;
        this.login.close();
        const login = this.login = new LoginClient();

        login.onLoginOk = async () => {
            if (this.gmTransfer !== transfer || transfer.phase !== GMTransferPhase_T.Reconnect) return;
            transfer.phase = GMTransferPhase_T.Login;
            await this.network.waitNextTick();
        };
        try {
            await login.login(this.loginUrl, this.loginAccount, this.loginPassword);
            if (this.gmTransfer === transfer && transfer.phase === GMTransferPhase_T.Login) transfer.phase = GMTransferPhase_T.SelectServer;
        } catch (e) {
            if (this.gmTransfer !== transfer) return;
            transfer.error = (e as Error).message;
            this.network.ui.showLogin();
            this.network.ui.showMessage(transfer.error);
        }
    }

    public requestNewCharacter() { this.game.newCharacter(); }

    public createCharacter(info: CharacterCreate_T) { this.game.characterCreate(info); }

    public deleteCharacter(slot: number) { this.game.characterDelete(slot); }

    public restoreCharacter(slot: number) { this.game.characterRestore(slot); }

    public async onDisconnected(reason: string) {
        if (this.gmTransfer) this.gmTransfer.error = reason;
        this.network.leaveWorld();
        this.game = null;
        this.network.ui.showMessage(reason);
        await this.showLogin(this.loginUrl);
        this.network.ui.showMessage(reason);
    }

    public onCharCreateOk(packet: PacketReader) {
        if (packet.d() !== 1 || packet.getRemaining()) throw new Error("Invalid CharCreateOk payload.");
    }

    public onCharDeleteOk(packet: PacketReader) {
        if (packet.getRemaining()) throw new Error("Invalid CharDeleteOk payload.");
    }

    public onCharSelected(packet: PacketReader) {
        const selected = GamePackets.readCharSelected(packet);
        const entry = this.characters[this.selectedSlot];
        const render = this.network.getParent().getComponent("render");
        const environment = render.getEnvironment();

        environment.setTimeOfDay(selected.gameTime / 60);
        environment.setTimeScale(GAME_TIME_SCALE);

        this.lobby.leave();
        render.player.teleportTo(setVector(new Vector3(), selected), true);
        this.network.getParent().getComponent("input").resetFollowCamera();

        void this.network.actors.enterWorld(entry);
    }

    public requestRestart() { if (this.game?.isPlayingReplay()) void this.stopReplayPlayback(); else if (this.network.actors.inWorld) this.game.requestRestart(); }

    public logout() { if (this.game?.isPlayingReplay()) void this.stopReplayPlayback(); else if (this.network.actors.inWorld) this.game.logout(); }

    public async playReplay(bytes: Uint8Array, lockCamera = true, useChatData = false): Promise<void> {
        if (this.network.actors.inWorld || this.game || this.network.ui.getScreen() !== "login" && this.network.ui.getScreen() !== "replay") throw new Error(`Replay playback requires the login screen.`);
        const file = new L2ReplayFile(bytes), scene = file.getScene(), first = file.arrPackets[0];
        const properties = this.network.getParent().getComponent("asset").playerController.scriptProperties;

        file.setScene(scene);
        // shortcut: follow-camera presets; extend after free-camera initialization is traced.
        if (scene.cameraMode) throw new Error(`Replay camera mode is not implemented.`);
        const presetCount = properties.get("FixedDefaultViewNum") as number;

        if (scene.fixedCamera < 0 || scene.fixedCamera >= Math.max(1, presetCount)) throw new Error(`Invalid replay camera preset '${scene.fixedCamera}'.`);
        if (!first || first.opcode !== GamePackets.GameServerPacket_T.UserInfo || first.time !== 0) throw new Error(`Replay requires an initial UserInfo snapshot.`);
        if (lockCamera) {
            for (const { key, action, amount } of file.arrCameraInstructions) {
                if ((key === EInputKey_T.IK_MouseX || key === EInputKey_T.IK_MouseY) && action === EInputAction_T.IST_Axis) {
                    if (Math.abs(Math.trunc(amount * 3600 * Math.fround(0.01))) > 0x7fffffff) throw new Error(`Replay camera axis exceeds the implemented input range.`);
                    continue;
                }
                if ((key === EInputKey_T.IK_RightMouse || key === EInputKey_T.IK_MouseWheelUp || key === EInputKey_T.IK_MouseWheelDown) && (action === EInputAction_T.IST_Press || action === EInputAction_T.IST_Release)) continue;
                if ((key === EInputKey_T.IK_PageUp || key === EInputKey_T.IK_PageDown || key === EInputKey_T.IK_Home) && (action === EInputAction_T.IST_Press || action === EInputAction_T.IST_Hold || action === EInputAction_T.IST_Release)) continue;
                throw new Error(`Replay camera key/action '${key}/${action}' is not implemented.`);
            }
        }
        const info = GamePackets.readUserInfo(new PacketReader(first.payload)), render = this.network.getParent().getComponent("render"), input = this.network.getParent().getComponent("input");
        const game = new GameClient();

        game.onPacket = (opcode, packet) => { if (this.game === game) this.network.onPacket(opcode, packet); };
        game.onReplayCamera = instruction => input.applyReplayCamera(instruction);
        game.startReplayPlayback(file, lockCamera, useChatData);
        this.game = game;
        this.replayLoading = true;

        try {
            this.gmTransfer = null;
            const login = this.login;

            this.login = null;
            if (login) login.close();
            this.network.ui.showLoading();
            this.lobby.leave();
            render.player.teleportTo(setVector(new Vector3(), info), true);
            input.resetFollowCamera();
            await this.network.actors.enterWorld(info);
            if (this.game !== game) return;

            if (scene.observerMode) this.network.movement.startReplayObservation(info); // SetCameraPosition 0x10489775: GL2 observer flag and controller observer bit
            render.getEnvironment().setTimeOfDay(scene.hour + scene.minute / 60 + scene.second / 3600);
            render.getEnvironment().setTimeScale(GAME_TIME_SCALE);
            game.prepareReplayPlayback();
            await this.network.actors.worldLoad;
            if (this.game !== game) return;

            const yaw = Math.trunc(scene.actorYaw);

            render.player.setUnrealScriptProperty("Rotation", [0, yaw, 0]);
            render.player.setUnrealScriptProperty("DesiredRotation", [0, yaw, 0]);
            render.player.setRotationYaw(yaw);
            input.startReplayCamera(scene);
            game.tickReplayPlayback(0);
            this.replayLoading = false;
        } catch (error) {
            if (this.game === game) await this.stopReplayPlayback();
            throw error;
        }
    }

    public async stopReplayPlayback(): Promise<void> {
        const game = this.game;

        if (!game || !game.isPlayingReplay()) return;
        this.network.leaveWorld();
        game.close();
        this.game = null;
        this.replayLoading = false;
        this.network.getParent().getComponent("input").endReplayCamera();
        await this.showLogin(this.loginUrl);
    }

    public startReplayRecording(): void {
        if (!this.network.actors.inWorld || this.game.isRecording()) return;
        const render = this.network.getParent().getComponent("render"), properties = this.network.getParent().getComponent("asset").playerController.scriptProperties;
        const file = new L2ReplayFile(), direction = render.camera.getWorldDirection(new Vector3());
        const time = (render.environment.getTimeSeconds() % 86400 + 86400) % 86400;
        const zoom = properties.get("CurZoomingDist") as number;
        const fixedCamera = properties.get("CurFixedDefaultCameraNo") as number;

        file.setScene({ position: render.camera.position.toArray(), yaw: Math.trunc(Math.atan2(direction.y, direction.x) * 32768 / Math.PI), pitch: Math.trunc(Math.atan2(direction.z, Math.hypot(direction.x, direction.y)) * 32768 / Math.PI), zoom, desiredZoom: properties.get("DesiredZoomingDist") as number, hour: Math.floor(time / 3600), minute: Math.floor(time / 60) % 60, second: time % 60, duration: 0, cameraMode: properties.get("bCameraWalking") ? 1 : 0, firstPerson: fixedCamera === 1 ? 1 : 0, observerMode: this.network.movement.observation ? 1 : 0, actorYaw: render.player.getRotationYaw(), fixedCamera });
        file.arrUserIds = [...this.network.actors.objects.keys()];
        this.game.startRecording(file);
        this.network.ui.setReplayRecording(true);
        this.network.ui.addSystemMessage(this.network.ui.getSystemMessage(1652), this.network.ui.getStrings().systemMessageColors[1652]);
    }

    public async stopReplayRecording(): Promise<void> {
        if (!this.game || !this.game.isRecording()) return;
        const file = this.game.stopRecording(), bytes = file.toBytes();
        this.network.ui.setReplayRecording(false);
        let name = "Replay.l2r";

        try { name = await saveReplayFile(bytes); }
        finally {
            const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" })), link = document.createElement("a");

            link.href = url;
            link.download = name;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
        this.network.ui.addSystemMessage(this.network.ui.getSystemMessage(1653).replace("$s1", name), this.network.ui.getStrings().systemMessageColors[1653]);
    }

    public getReplayRecordingTime() { return this.game ? this.game.getRecordingTime() : null; }

    public async showLobby() {
        const game = this.game, characters = this.characters, transfer = this.gmTransfer;
        const isTransferList = transfer && transfer.phase === GMTransferPhase_T.SelectServer;

        await this.lobby.enter(this.network.ui.getStrings().logonSpots);
        if (this.game !== game || this.characters !== characters) return;

        this.network.ui.showCharacters(characters);
        let lastUsed = characters.findIndex(character => character.isLastUsed);

        if (isTransferList) {
            lastUsed = -1;
            characters.slice(0, 7).forEach((character, index) => { if (character.isLastUsed && (character.deleteSeconds <= 0 || character.isDeletionMarked)) lastUsed = index; });
            transfer.selectedSlot = lastUsed;
        }
        const asset = this.network.getParent().getComponent("asset");

        await this.lobby.showSelect(characters);
        if (this.game !== game || this.characters !== characters) return;

        if (lastUsed >= 0) this.previewCharacter(lastUsed);
        if (isTransferList && this.gmTransfer === transfer && transfer.phase === GMTransferPhase_T.SelectServer) transfer.phase = GMTransferPhase_T.SelectCharacter;
    }
}

export default NetworkSession;
