import L2ReplayFile from "./l2-replay-file";
import PacketReader from "./packet-reader";

// FL2ReplayManager::MakeUsePacketTable 0x754f40, extended indices are 255 + subopcode.
const arrPacketIds = new Set([1, 3, 4, 5, 6, 7, 11, 12, 13, 18, 22, 28, 29, 40, 41, 43, 44, 45, 46, 47, 71, 72, 73, 75, 76, 77, 89, 90, 91, 92, 93, 96, 97, 98, 99, 113, 114, 115, 118, 127, 134, 137, 140, 152, 153, 159, 181, 182, 186, 196, 197, 199, 200, 212, 221, 225, 241, 247, 264, 266, 274, 275, 276, 277]);

export function isReplayPacket(opcode: number, extendedOpcode: number, useChatData = false): boolean {
    const index = opcode === 254 ? 255 + extendedOpcode : opcode;

    return arrPacketIds.has(index) || useChatData && (index === 2 || index === 74);
}

export class L2ReplayRecorder {
    protected startTime: number = null;
    protected isCameraRotating = false;
    protected readonly arrCameraAngles = [0, 0];
    protected readonly arrRecordedCameraAngles = [0, 0];
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
        // FL2ReplayManager::PrepareSave 0x75798d/0x757ba2 enables NPC_SAY and SAY before recording.
        if (this.startTime === null || !isReplayPacket(opcode, extendedOpcode, true)) return;
        if (time < this.startTime) throw new Error(`Replay clock precedes recording start.`);

        this.file.arrPackets.push({ time: time - this.startTime, opcode, extendedOpcode, payload: reader.b(reader.getRemaining()), extraByte: 0 });
    }

    public addCameraInput(action: "press" | "release" | "axis" | "wheel", yaw: number, pitch: number, time: number): void {
        if (!Number.isFinite(time) || !Number.isFinite(yaw) || !Number.isFinite(pitch)) throw new Error(`Invalid replay camera input.`);
        if (this.startTime === null) return;
        if (time < this.startTime) throw new Error(`Replay clock precedes recording start.`);

        const elapsed = time - this.startTime;

        switch (action) {
            case "wheel": {
                if (yaw === 0) return;
                if (yaw !== -1 && yaw !== 1) throw new Error(`Invalid replay wheel direction '${yaw}'.`);
                const key = yaw < 0 ? 236 : 237;

                this.file.arrCameraInstructions.push({ time: elapsed, key, action: 1, amount: 0 }, { time: elapsed, key, action: 3, amount: 0 });
                return;
            }
            case "press":
            case "release": {
                const pressed = action === "press";

                if (this.isCameraRotating === pressed) return;
                this.isCameraRotating = pressed;
                this.file.arrCameraInstructions.push({ time: elapsed, key: 2, action: pressed ? 1 : 3, amount: 0 });
                return;
            }
            case "axis":
                if (!this.isCameraRotating) return;
                break;
            default: throw new Error(`Unknown replay camera action '${action}'.`);
        }

        // UInput::Exec 0x850352/0x8504cc: truncate amount * Speed3600 * float32(0.01).
        for (let i = 0; i < 2; i++) {
            const angle = this.arrCameraAngles[i] + (i === 0 ? yaw : pitch), next = Math.trunc(angle), delta = next - this.arrRecordedCameraAngles[i];

            if (!Number.isSafeInteger(next) || Math.abs(delta) > 0x7fffffff) throw new Error(`Replay camera rotation exceeds native input range.`);
            const amount = Math.fround((delta + Math.sign(delta) * 0.5) / (3600 * Math.fround(0.01)));

            if (Math.trunc(amount * 3600 * Math.fround(0.01)) !== delta) throw new Error(`Replay camera input loses native precision.`);
            this.arrCameraAngles[i] = angle;
            this.arrRecordedCameraAngles[i] = next;
            if (delta === 0) continue;

            this.file.arrCameraInstructions.push({ time: elapsed, key: 228 + i, action: 4, amount });
        }
    }

    public finish(time: number): L2ReplayFile {
        if (!Number.isFinite(time)) throw new Error(`Invalid replay clock '${time}'.`);
        this.file.setDuration(this.startTime === null ? 0 : time - this.startTime);
        return this.file;
    }

    public getElapsed(time: number): number { return this.startTime === null ? null : time - this.startTime; }
}

export default L2ReplayRecorder;
