import L2ReplayFile from "./l2-replay-file";
import PacketReader from "./packet-reader";

// FL2ReplayManager::MakeUsePacketTable 0x754f40, extended indices are 255 + subopcode.
const arrPacketIds = new Set([1, 3, 4, 5, 6, 7, 11, 12, 13, 18, 22, 28, 29, 40, 41, 43, 44, 45, 46, 47, 71, 72, 73, 75, 76, 77, 89, 90, 91, 92, 93, 96, 97, 98, 99, 113, 114, 115, 118, 127, 134, 137, 140, 152, 153, 159, 181, 182, 186, 196, 197, 199, 200, 212, 221, 225, 241, 247, 264, 266, 274, 275, 276, 277]);

export class L2ReplayRecorder {
    protected startTime: number = null;
    public readonly file: L2ReplayFile;

    public constructor(file: L2ReplayFile) {
        if (file.arrPackets.length || file.arrCameraInstructions.length) throw new Error(`Replay recording requires an empty file.`);
        file.toBytes();
        this.file = file;
    }

    public addPacket(body: Uint8Array, time: number): void {
        if (!Number.isFinite(time)) throw new Error(`Invalid replay clock '${time}'.`);
        const reader = new PacketReader(body), opcode = reader.c(), extendedOpcode = opcode === 254 ? reader.h() << 16 >> 16 : -1;

        if (this.startTime === null && opcode === 4) this.startTime = time;
        if (this.startTime === null || !arrPacketIds.has(opcode === 254 ? 255 + extendedOpcode : opcode)) return;
        if (time < this.startTime) throw new Error(`Replay clock precedes recording start.`);

        this.file.arrPackets.push({ time: time - this.startTime, opcode, extendedOpcode, payload: reader.b(reader.getRemaining()), extraByte: 0 });
    }

    public finish(time: number): L2ReplayFile {
        if (!Number.isFinite(time)) throw new Error(`Invalid replay clock '${time}'.`);
        this.file.setDuration(this.startTime === null ? 0 : time - this.startTime);
        return this.file;
    }

    public getElapsed(time: number): number { return this.startTime === null ? null : time - this.startTime; }
}

export default L2ReplayRecorder;
