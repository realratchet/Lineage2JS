import L2Socket from "./l2-socket";
import PacketReader from "./packet-reader";
import PacketWriter from "./packet-writer";
import { L2Blowfish, LOGIN_STATIC_KEY, buildLoginCredentials, encryptRSANoPadding, openLoginPacket, sealLoginPacket, unscrambleModulus } from "./l2-crypt";

export enum LoginServerPacket_T {
    Init = 0x00,
    LoginFail = 0x01,
    AccountKicked = 0x02,
    LoginOk = 0x03,
    ServerList = 0x04,
    PlayFail = 0x06,
    PlayOk = 0x07,
    GGAuth = 0x0b
}

export enum LoginClientPacket_T {
    RequestAuthLogin = 0x00,
    RequestServerLogin = 0x02,
    RequestServerList = 0x05,
    RequestAuthGG = 0x07
}

export type GameServerInfo_T = {
    id: number;
    address: string;
    port: number;
    pvp: boolean;
    currentPlayers: number;
    maxPlayers: number;
    isUp: boolean;
    isTestServer: boolean;
    showClock: boolean;
    brackets: boolean;
};

export type SessionKey_T = { loginOk1: number, loginOk2: number, playOk1: number, playOk2: number };

const LOGIN_FAIL_MESSAGES: Record<number, number[]> = { // NWindow 0x1006f1d0 OnAuthLoginFail switch, joined with "%s %s" / "%s %s %s"
    1: [448], 2: [449, 450], 3: [449, 450], 4: [461, 462, 463], 5: [453, 454], 6: [461, 462, 463], 7: [455],
    8: [461, 462, 463], 9: [461, 462, 463], 10: [461, 462, 463], 11: [461, 462, 463], 12: [456], 13: [461, 462, 463], 14: [461, 462, 463],
    15: [1650], 16: [457], 17: [396], 18: [458, 459, 460], 19: [398], 20: [399], 21: [461], 22: [621],
    30: [756], 31: [1243], 32: [1242], 33: [1340], 35: [1407]
};

export class LoginClient {
    protected readonly socket = new L2Socket();
    protected readonly blowfish = new L2Blowfish(LOGIN_STATIC_KEY);
    protected readonly received: PacketReader[] = [];
    protected waiting: { resolve: (packet: PacketReader) => void, reject: (error: Error) => void } = null;
    protected failure: Error = null;
    protected isInitialized = false;
    protected sessionId = 0;
    protected loginOk1 = 0;
    protected loginOk2 = 0;
    protected url: URL;

    public servers: GameServerInfo_T[] = [];
    public lastServerId = 0;

    public constructor() {
        this.socket.onPacket = body => this.onPacket(body);
        this.socket.onClose = (code, reason) => this.fail(new Error(`Login server closed the connection (${code}${reason ? ` ${reason}` : ""}).`));
    }

    protected onPacket(body: Uint8Array) {
        if (this.isInitialized) openLoginPacket(this.blowfish, body);
        else this.isInitialized = true;

        const packet = new PacketReader(body);

        if (this.waiting) {
            const waiting = this.waiting;

            this.waiting = null;
            waiting.resolve(packet);
        } else this.received.push(packet);
    }

    protected fail(error: Error) {
        this.failure = error;

        if (!this.waiting) return;

        const waiting = this.waiting;

        this.waiting = null;
        waiting.reject(error);
    }

    protected nextPacket(): Promise<PacketReader> {
        if (this.received.length > 0) return Promise.resolve(this.received.shift());
        if (this.failure) return Promise.reject(this.failure);

        return new Promise((resolve, reject) => this.waiting = { resolve, reject });
    }

    protected send(writer: PacketWriter) { this.socket.send(sealLoginPacket(this.blowfish, writer.toBytes())); }

    protected async expect(...opcodes: LoginServerPacket_T[]): Promise<[LoginServerPacket_T, PacketReader]> {
        const packet = await this.nextPacket();
        const opcode = packet.c() as LoginServerPacket_T;

        switch (opcode) {
            case LoginServerPacket_T.LoginFail: {
                const reason = packet.c();

                if (!LOGIN_FAIL_MESSAGES[reason]) throw new Error(`Unknown LoginFail reason ${reason}.`);

                throw Object.assign(new Error(`LoginFail reason ${reason}.`), { systemMessageIds: LOGIN_FAIL_MESSAGES[reason] });
            }
            case LoginServerPacket_T.AccountKicked: throw new Error(`Account was kicked (reason ${packet.d()}).`);
            case LoginServerPacket_T.PlayFail: throw new Error(`PlayFail reason ${packet.c()}.`); // UGameEngine::OnAuthServerSelectFail 0x1046d050 shows nothing
        }

        if (!opcodes.includes(opcode)) throw new Error(`Unexpected login packet 0x${opcode.toString(16)}, expected ${opcodes.map(op => `0x${op.toString(16)}`).join("/")}.`);

        return [opcode, packet];
    }

    public onLoginOk: () => Promise<void> = null;

    public async login(url: string, account: string, password: string): Promise<GameServerInfo_T[]> {
        this.url = new URL(url);

        await this.socket.connect(url);

        const [, init] = await this.expect(LoginServerPacket_T.Init);

        this.sessionId = init.d();

        const revision = init.d();

        if (revision !== 0xc621) throw new Error(`Unsupported login protocol revision 0x${revision.toString(16)}.`);

        const modulus = unscrambleModulus(init.b(128));

        this.send(new PacketWriter().c(LoginClientPacket_T.RequestAuthGG).d(this.sessionId).d(0).d(0).d(0).d(0));
        await this.expect(LoginServerPacket_T.GGAuth);

        this.send(new PacketWriter().c(LoginClientPacket_T.RequestAuthLogin).b(encryptRSANoPadding(buildLoginCredentials(account, password), modulus)));

        let [opcode, packet] = await this.expect(LoginServerPacket_T.LoginOk, LoginServerPacket_T.ServerList);

        if (opcode === LoginServerPacket_T.LoginOk) {
            this.loginOk1 = packet.d();
            this.loginOk2 = packet.d();
            if (this.onLoginOk) await this.onLoginOk();
            this.send(new PacketWriter().c(LoginClientPacket_T.RequestServerList).d(this.loginOk1).d(this.loginOk2).c(4));
            [, packet] = await this.expect(LoginServerPacket_T.ServerList);
        }

        this.readServerList(packet);

        return this.servers;
    }

    protected readServerList(packet: PacketReader) {
        const count = packet.c();

        this.lastServerId = packet.c();
        this.servers = [];

        for (let i = 0; i < count; i++) {
            const id = packet.c();
            const address = [packet.c(), packet.c(), packet.c(), packet.c()].join(".");
            const port = packet.d();

            packet.c();

            const pvp = packet.c() !== 0;
            const currentPlayers = packet.h();
            const maxPlayers = packet.h();
            const isUp = packet.c() !== 0;
            const bits = packet.d();
            const brackets = packet.c() !== 0;

            this.servers.push({ id, address, port, pvp, currentPlayers, maxPlayers, isUp, isTestServer: (bits & 0x04) !== 0, showClock: (bits & 0x02) !== 0, brackets });
        }
    }

    public async selectServer(serverId: number): Promise<SessionKey_T> {
        this.send(new PacketWriter().c(LoginClientPacket_T.RequestServerLogin).d(this.loginOk1).d(this.loginOk2).c(serverId));

        const [, packet] = await this.expect(LoginServerPacket_T.PlayOk);
        const playOk1 = packet.d();
        const playOk2 = packet.d();

        return { loginOk1: this.loginOk1, loginOk2: this.loginOk2, playOk1, playOk2 };
    }

    public getGameServerUrl(server: GameServerInfo_T): string { // WS uses the login host and the advertised game port.
        return `${this.url.protocol}//${this.url.hostname}:${server.port}${this.url.pathname}`;
    }

    public close() { this.socket.close(); }
}

export default LoginClient;
