import { checkPacketSize, readPacketFrame, writePacketFrame } from "./packet-frame";

type PacketHandler_T = (body: Uint8Array) => void;
type CloseHandler_T = (code: number, reason: string) => void;

export class L2Socket {
    protected socket: WebSocket = null;
    protected pending = new Uint8Array(0);
    protected isClosedByUs = false;

    public onPacket: PacketHandler_T = null;
    public onClose: CloseHandler_T = null;

    public connect(url: string): Promise<this> {
        return new Promise((resolve, reject) => {
            this.close();

            const socket = new WebSocket(url);

            this.attach(socket);
            socket.onopen = () => resolve(this);
            socket.onerror = () => reject(new Error(`Could not connect to '${url}'.`));
        });
    }

    public adopt(socket: WebSocket): this {
        if (socket.readyState !== WebSocket.OPEN) throw new Error(`Cannot adopt a WebSocket that is not open.`);

        this.close();
        this.attach(socket);
        socket.onopen = socket.onerror = null;

        return this;
    }

    protected attach(socket: WebSocket) {
        this.pending = new Uint8Array(0);
        this.isClosedByUs = false;

        socket.binaryType = "arraybuffer";
        socket.onmessage = event => { if (this.socket === socket) this.receive(event.data); };
        socket.onclose = event => {
            if (this.socket !== socket) return;

            this.socket = null;
            this.pending = new Uint8Array(0);

            if (!this.isClosedByUs && this.onClose) this.onClose(event.code, event.reason);
        };

        this.socket = socket;
    }

    public isOpen() { return !!this.socket && this.socket.readyState === WebSocket.OPEN; }

    public static checkPacketSize = checkPacketSize;

    protected receive(data: ArrayBuffer | string) {
        if (typeof data === "string") throw new Error(`L2 socket received a text frame.`);

        const socket = this.socket;
        const chunk = new Uint8Array(data);
        const buffer = new Uint8Array(this.pending.length + chunk.length);

        buffer.set(this.pending);
        buffer.set(chunk, this.pending.length);

        let offset = 0;

        try {
            while (offset < buffer.length) {
                const frame = readPacketFrame(buffer, offset);

                if (!frame) break;
                offset = frame.end;
                if (frame.body.length > 0) this.onPacket(frame.body);
                if (this.socket !== socket) return;
            }
        } finally {
            if (this.socket === socket) this.pending = buffer.slice(offset);
        }
    }

    public send(body: Uint8Array) {
        if (!this.isOpen()) throw new Error(`L2 socket is not open.`);
        this.socket.send(writePacketFrame(body));
    }

    public close() {
        this.isClosedByUs = true;
        this.pending = new Uint8Array(0);

        if (this.socket) this.socket.close(1000);

        this.socket = null;
    }
}

export default L2Socket;
