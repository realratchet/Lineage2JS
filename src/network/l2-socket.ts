type PacketHandler_T = (body: Uint8Array) => void;
type CloseHandler_T = (code: number, reason: string) => void;

export class L2Socket { // Legacy packet lengths include the header; WS messages may split packets.
    protected socket: WebSocket = null;
    protected pending = new Uint8Array(0);
    protected isClosedByUs = false;

    public onPacket: PacketHandler_T = null;
    public onClose: CloseHandler_T = null;

    public connect(url: string): Promise<this> {
        return new Promise((resolve, reject) => {
            const socket = new WebSocket(url);

            socket.binaryType = "arraybuffer";
            socket.onopen = () => resolve(this);
            socket.onerror = () => reject(new Error(`Could not connect to '${url}'.`));
            socket.onmessage = event => this.receive(event.data);
            socket.onclose = event => {
                this.socket = null;

                if (!this.isClosedByUs && this.onClose) this.onClose(event.code, event.reason);
            };

            this.socket = socket;
        });
    }

    public isOpen() { return !!this.socket && this.socket.readyState === WebSocket.OPEN; }

    protected receive(data: ArrayBuffer | string) {
        if (typeof data === "string") throw new Error(`L2 socket received a text frame.`);

        const chunk = new Uint8Array(data);
        const buffer = new Uint8Array(this.pending.length + chunk.length);

        buffer.set(this.pending);
        buffer.set(chunk, this.pending.length);

        let offset = 0;

        while (buffer.length - offset >= 2) {
            const size = buffer[offset] | (buffer[offset + 1] << 8);

            if (size < 2) throw new Error(`L2 socket received invalid packet length ${size}.`);
            if (buffer.length - offset < size) break;

            const body = buffer.slice(offset + 2, offset + size);

            offset += size;

            if (body.length > 0) this.onPacket(body);
        }

        this.pending = buffer.slice(offset);
    }

    public send(body: Uint8Array) {
        if (!this.isOpen()) throw new Error(`L2 socket is not open.`);

        const frame = new Uint8Array(body.length + 2);

        frame[0] = frame.length & 0xff;
        frame[1] = (frame.length >>> 8) & 0xff;
        frame.set(body, 2);

        this.socket.send(frame);
    }

    public close() {
        this.isClosedByUs = true;

        if (this.socket) this.socket.close(1000);

        this.socket = null;
    }
}

export default L2Socket;
