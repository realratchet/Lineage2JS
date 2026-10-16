import PacketReader from "./packet-reader";
import PacketWriter from "./packet-writer";

const SIGNATURE = "LineageII Replay File ";
const LEGACY_SIGNATURE = "LineageII Replay File";
const TRAILER = new TextEncoder().encode("\x0cSafePackage\0");

export type ReplayPacket_T = { time: number, opcode: number, extendedOpcode: number, payload: Uint8Array, extraByte: number };
export type ReplayCameraInstruction_T = { time: number, key: number, action: number, amount: number };
export type ReplayScene_T = { position: number[], yaw: number, pitch: number, zoom: number, desiredZoom: number, hour: number, minute: number, second: number, duration: number, cameraMode: number, firstPerson: number, observerMode: number, actorYaw: number, fixedCamera: number };

class ReplayReader extends PacketReader {
    public float(): number { this.need(4); const value = this.view.getFloat32(this.offset, true); this.offset += 4; return value; }
}

class ReplayWriter extends PacketWriter {
    public float(value: number): this { this.grow(4); this.view.setFloat32(this.offset, value, true); this.offset += 4; return this; }
}

function readString(reader: PacketReader): string {
    const first = reader.c();
    let count = first & 63, shift = 6, more = first & 64;

    for (let i = 1; more; i++) {
        if (i === 5) throw new Error(`Invalid replay string length.`);
        const next = reader.c();

        count += (next & 127) * 2 ** shift;
        shift += 7;
        more = next & 128;
    }

    const wide = (first & 128) !== 0;

    if (count > Math.floor(reader.getRemaining() / (wide ? 2 : 1))) throw new Error(`Replay string exceeds file length.`);
    if (count === 0) return "";

    let value = "";

    for (let i = 0; i < count; i++) {
        const code = wide ? reader.h() : reader.c();

        if (i === count - 1) {
            if (code !== 0) throw new Error(`Replay string is not terminated.`);
        } else value += String.fromCharCode(code);
    }
    return value;
}

function readCount(reader: PacketReader, size: number): number {
    const count = reader.d();

    if (count < 0 || count > Math.floor(reader.getRemaining() / size)) throw new Error(`Invalid replay record count '${count}'.`);
    return count;
}

function checkInteger(value: number, min: number, max: number): void {
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid replay integer '${value}'.`);
}

function checkTime(value: number): void {
    if (!Number.isFinite(value)) throw new Error(`Invalid replay time '${value}'.`);
}

export class L2ReplayFile {
    public version = 660;
    public format = 1;
    public header = new Uint8Array(62);
    public arrPackets: ReplayPacket_T[] = [];
    public arrCameraInstructions: ReplayCameraInstruction_T[] = [];
    public arrUserIds: number[] = [];
    public trailer = TRAILER.slice();
    protected legacy = false;

    public constructor(bytes: Uint8Array = null) {
        if (bytes) this.load(bytes);
    }

    public getScene(): ReplayScene_T {
        const reader = new ReplayReader(this.header);

        return { position: [reader.float(), reader.float(), reader.float()], yaw: reader.float(), pitch: reader.float(), zoom: reader.float(), desiredZoom: reader.float(), hour: reader.c(), minute: reader.c(), second: reader.float(), duration: reader.f(), cameraMode: reader.d(), firstPerson: reader.d(), observerMode: reader.d(), actorYaw: reader.float(), fixedCamera: reader.d() };
    }

    public setScene(scene: ReplayScene_T): void {
        if (scene.position.length !== 3) throw new Error(`Invalid replay starting position.`);
        for (const value of [...scene.position, scene.yaw, scene.pitch, scene.zoom, scene.desiredZoom, scene.second, scene.actorYaw])
            if (!Number.isFinite(value) || Math.abs(value) > 3.4028234663852886e38) throw new Error(`Invalid replay scene float '${value}'.`);

        checkInteger(scene.hour, 0, 23);
        checkInteger(scene.minute, 0, 59);
        checkTime(scene.duration);
        if (scene.duration < 0) throw new Error(`Invalid replay duration '${scene.duration}'.`);
        for (const value of [scene.cameraMode, scene.firstPerson, scene.observerMode, scene.fixedCamera]) checkInteger(value, -2147483648, 2147483647);

        const writer = new ReplayWriter();

        scene.position.forEach(value => writer.float(value));
        writer.float(scene.yaw).float(scene.pitch).float(scene.zoom).float(scene.desiredZoom).c(scene.hour).c(scene.minute).float(scene.second).f(scene.duration).d(scene.cameraMode).d(scene.firstPerson).d(scene.observerMode).float(scene.actorYaw).d(scene.fixedCamera);
        this.header = writer.toBytes();
    }

    public setDuration(duration: number): void {
        checkTime(duration);
        if (duration < 0) throw new Error(`Invalid replay duration '${duration}'.`);
        if (this.header.length !== 62) throw new Error(`Invalid replay scene header length '${this.header.length}'.`);

        // FL2ReplayManager::PublicModeSave 0x7584de stores now - start at native header+0x28.
        new DataView(this.header.buffer, this.header.byteOffset, this.header.byteLength).setFloat64(34, duration, true);
    }

    public load(bytes: Uint8Array): void {
        const reader = new ReplayReader(bytes), signature = readString(reader), legacy = signature === LEGACY_SIGNATURE;

        if (!legacy && signature !== SIGNATURE) throw new Error(`Invalid replay signature '${signature}'.`);
        const format = legacy ? 0 : reader.d(), version = reader.d();

        if (version > 660) throw new Error(`Unsupported replay version '${version}'.`);
        const header = reader.b(62), arrPackets: ReplayPacket_T[] = [], arrCameraInstructions: ReplayCameraInstruction_T[] = [], arrUserIds: number[] = [];

        // FL2ReplayManager packet serializer 0x754ad0 writes payload size plus one byte.
        for (let i = 0, count = readCount(reader, 16); i < count; i++) {
            const time = reader.f(), opcode = reader.c(), extendedOpcode = reader.h() << 16 >> 16, size = reader.d();

            checkTime(time);
            if (size < 0 || size >= reader.getRemaining()) throw new Error(`Invalid replay payload size '${size}'.`);
            arrPackets.push({ time, opcode, extendedOpcode, payload: reader.b(size), extraByte: reader.c() });
        }

        for (let i = 0, count = readCount(reader, 20); i < count; i++) {
            const time = reader.f(), key = reader.d(), action = reader.d(), amount = reader.float();

            checkTime(time);
            if (!Number.isFinite(amount)) throw new Error(`Invalid replay camera amount '${amount}'.`);
            arrCameraInstructions.push({ time, key, action, amount });
        }

        if (format >= 1)
            for (let i = 0, count = readCount(reader, 4); i < count; i++) arrUserIds.push(reader.d());

        const trailer = reader.b(reader.getRemaining());

        this.legacy = legacy;
        this.format = format;
        this.version = version;
        this.header = header;
        this.arrPackets = arrPackets;
        this.arrCameraInstructions = arrCameraInstructions;
        this.arrUserIds = arrUserIds;
        this.trailer = trailer;
    }

    public toBytes(): Uint8Array {
        const writer = new ReplayWriter(), signature = this.legacy ? LEGACY_SIGNATURE : SIGNATURE;

        checkInteger(this.version, -0x80000000, 660);
        checkInteger(this.format, -0x80000000, 0x7fffffff);
        if (this.legacy && this.format !== 0) throw new Error(`Legacy replay cannot store format '${this.format}'.`);
        if (this.header.length !== 62) throw new Error(`Invalid replay scene header length '${this.header.length}'.`);
        if (this.format < 1 && this.arrUserIds.length) throw new Error(`Replay format '${this.format}' cannot store user IDs.`);

        writer.c(signature.length + 1);
        for (let i = 0; i < signature.length; i++) writer.c(signature.charCodeAt(i));
        writer.c(0);
        if (!this.legacy) writer.d(this.format);
        writer.d(this.version).b(this.header);

        checkInteger(this.arrPackets.length, 0, 0x7fffffff);
        writer.d(this.arrPackets.length);
        for (const packet of this.arrPackets) {
            checkTime(packet.time);
            checkInteger(packet.opcode, 0, 255);
            checkInteger(packet.extendedOpcode, -32768, 32767);
            checkInteger(packet.extraByte, 0, 255);
            checkInteger(packet.payload.length, 0, 0x7fffffff);
            writer.f(packet.time).c(packet.opcode).h(packet.extendedOpcode).d(packet.payload.length).b(packet.payload).c(packet.extraByte);
        }

        checkInteger(this.arrCameraInstructions.length, 0, 0x7fffffff);
        writer.d(this.arrCameraInstructions.length);
        for (const instruction of this.arrCameraInstructions) {
            checkTime(instruction.time);
            checkInteger(instruction.key, -0x80000000, 0x7fffffff);
            checkInteger(instruction.action, -0x80000000, 0x7fffffff);
            if (!Number.isFinite(instruction.amount) || Math.abs(instruction.amount) > 3.4028234663852886e38) throw new Error(`Invalid replay camera amount '${instruction.amount}'.`);
            writer.f(instruction.time).d(instruction.key).d(instruction.action).float(instruction.amount);
        }

        if (this.format >= 1) {
            checkInteger(this.arrUserIds.length, 0, 0x7fffffff);
            writer.d(this.arrUserIds.length);
            for (const id of this.arrUserIds) {
                checkInteger(id, -0x80000000, 0x7fffffff);
                writer.d(id);
            }
        }
        return writer.b(this.trailer).toBytes();
    }
}

export default L2ReplayFile;
