import { DataTexture, LinearFilter, RGBAFormat } from "three";

// WaterTexture/WetTexture simulation. The water lives in a half-x-resolution byte
// field (row parity ping-pong wave automaton), each step writes a displacement bitmap
// through the render table (horizontal slope of the field) and the output frame
// samples the source rgba shifted by that displacement:
// out[u] = src[(u + disp[u]) & umask].

const STEP_MS = 33; // fractal textures animate at roughly 30hz
const MAX_STEPS = 3;

// 8-bit sine
const PHASE_TABLE = new Uint8Array(256);
for (let t = 0; t < 256; t++)
    PHASE_TABLE[t] = Math.round(127.45 + 127.5 * Math.sin((t / 256) * 6.2831853));

// wave update lut, halving acts as damping
const WAVE_TABLE = new Uint8Array(1536);
for (let t = 0; t < 1536; t++)
    WAVE_TABLE[t] = Math.min(255, Math.max(0, ((t >> 1) - 256) + ((t - 512) < 256 ? 1 : 0)));

type WetDrop_T = { type: number, depth: number, x: number, y: number, byteA: number, byteB: number, byteC: number, byteD: number };

// horizontal, vertical, '/', '\'
const LINE_DIRS: [number, number][] = [[1, 0], [0, 1], [-1, 1], [1, 1]];

class WetWaterTexture extends DataTexture {
    public readonly isUpdatable = true;

    protected readonly srcPixels: Uint8Array;   // rgba, width * height ('source' is taken by Texture)
    protected readonly outPixels: Uint8Array;   // this.image.data
    protected readonly field: Uint8Array;       // water heights, xdim * height
    protected readonly disp: Uint8Array;        // displacement bitmap, width * height
    protected readonly renderTable: Uint8Array; // signed displacement as wrapping bytes
    protected readonly drops: WetDrop_T[];
    protected readonly xdim: number;
    protected parity = 0;
    protected lastTime = -1;

    public constructor(info: { width: number, height: number, buffer: ArrayBuffer, waveAmp: number, drops: WetDrop_T[], dropsX: number, dropsY: number }) {
        const image = new Uint8Array(info.width * info.height * 4);

        super(image, info.width, info.height, RGBAFormat);

        this.outPixels = image;
        this.srcPixels = new Uint8Array(info.buffer, 0, info.width * info.height * 4);
        this.xdim = info.width >> 1;
        this.field = new Uint8Array(this.xdim * info.height).fill(128);
        this.disp = new Uint8Array(info.width * info.height);

        // refraction lut - linear displacement scaled by WaveAmp
        this.renderTable = new Uint8Array(1024);
        for (let i = 0; i < 1024; i++)
            this.renderTable[i] = Math.min(127, Math.max(-128, Math.round((i - 511) * (info.waveAmp / 512)))) & 0xff;

        // drop coordinates come in the wet texture's own half-res grid
        const sx = (info.width >> 1) / Math.max(1, info.dropsX);
        const sy = (info.height >> 1) / Math.max(1, info.dropsY);

        this.drops = info.drops.map(d => ({ ...d, x: Math.floor(d.x * sx), y: Math.floor(d.y * sy) }));

        this.outPixels.set(this.srcPixels);
        this.generateMipmaps = false;
        this.minFilter = LinearFilter;
        this.magFilter = LinearFilter;
        this.flipY = false;
        this.needsUpdate = true;
    }

    public update(currentTime: number) {
        if (this.lastTime < 0) this.lastTime = currentTime;

        let steps = Math.min(MAX_STEPS, Math.floor((currentTime - this.lastTime) / STEP_MS));

        if (steps <= 0) return;

        this.lastTime = currentTime;

        while (steps-- > 0) {
            this.redrawDrops();
            this.calculateWater();
        }

        this.applyWetTexture();
        this.needsUpdate = true;
    }

    // drops stamp into both interleaved field rows at (x, 2y)/(x, 2y+1),
    // coordinates are in the half resolution grid
    protected redrawDrops() {
        const field = this.field, xdim = this.xdim;
        const u2mask = xdim - 1, v2mask = (this.image.height >> 1) - 1;
        const rand = () => (Math.random() * 256) | 0;

        const stamp = (x: number, y: number, a: number, b: number = a) => {
            const row = ((y & v2mask) << 1) * xdim + (x & u2mask);

            field[row] = a;
            field[row + xdim] = b;
        };

        for (const drop of this.drops) {
            switch (drop.type) {
                case 0: // DROP_FixedDepth
                    stamp(drop.x, drop.y, drop.byteD);
                    break;
                case 1: // DROP_PhaseSpot
                    drop.depth = (drop.depth + drop.byteD) & 0xff;
                    stamp(drop.x, drop.y, PHASE_TABLE[drop.depth]);
                    break;
                case 2: // DROP_ShallowSpot
                    drop.depth = (drop.depth + drop.byteD) & 0xff;
                    stamp(drop.x, drop.y, 64 + (PHASE_TABLE[drop.depth] >> 1));
                    break;
                case 3: { // DROP_HalfAmpl
                    drop.depth = (drop.depth + drop.byteD) & 0xff;
                    stamp(drop.x, drop.y, Math.max(128, PHASE_TABLE[drop.depth]));
                    break;
                }
                case 4: // DROP_RandomMover
                    drop.x = (drop.x - (rand() & 3) + (rand() & 3)) & u2mask;
                    drop.y = (drop.y - (rand() & 3) + (rand() & 3)) & v2mask;
                    stamp(drop.x, drop.y, 128 + 57, 128 - 57);
                    break;
                case 5: // DROP_FixedRandomSpot
                    stamp(drop.x, drop.y, rand(), rand());
                    break;
                case 6: case 7: { // DROP_WhirlyThing / DROP_BigWhirly
                    const shift = drop.type === 6 ? 4 : 3;
                    let phase = ((drop.byteB << 8) | drop.byteA) + ((drop.byteD << 8) | drop.byteC);

                    phase &= 0xffff;
                    drop.byteA = phase & 0xff;
                    drop.byteB = (phase >> 8) & 0xff;

                    stamp(drop.x + (PHASE_TABLE[drop.byteB] >> shift), drop.y + (PHASE_TABLE[(drop.byteB + 64) & 0xff] >> shift), drop.depth);
                    break;
                }
                case 8: case 9: case 10: case 11: // lines: horizontal/vertical/'/'/'\'
                case 12: case 13: case 14: case 15: { // oscillating variants
                    let depth = drop.depth;

                    if (drop.type >= 12) {
                        drop.depth = (drop.depth + drop.byteC) & 0xff;
                        depth = PHASE_TABLE[drop.depth];
                    }

                    const size = drop.byteD >> 1;
                    const [dx, dy] = LINE_DIRS[(drop.type - 8) & 3];

                    for (let t = 0; t <= size; t++)
                        stamp(drop.x + t * dx, drop.y + t * dy, depth);
                    break;
                }
                case 16: { // DROP_RainDrops
                    if ((rand() & 15) === 0) {
                        const spray = drop.byteD;

                        stamp(drop.x + ((rand() * spray) >> 8), drop.y + ((rand() * spray) >> 8), drop.depth, 255 ^ drop.depth);
                    }
                    break;
                }
                case 17: { // DROP_AreaClamp
                    const size = drop.byteD >> 1;

                    for (let v = 0; v < size; v++)
                        for (let u = 0; u <= size; u++)
                            stamp(drop.x + u, drop.y + v, drop.depth);
                    break;
                }
                case 18: // DROP_LeakyTap
                    drop.byteA = (drop.byteA + drop.byteD) & 0xff;
                    if (drop.byteA <= drop.byteD) stamp(drop.x, drop.y, drop.depth, 255 ^ drop.depth);
                    break;
                case 19: // DROP_DrippyTap
                    drop.byteA = (drop.byteA + drop.byteD) & 0xff;
                    if (drop.byteA <= drop.byteD) {
                        drop.byteA = rand();
                        stamp(drop.x, drop.y, drop.depth, 255 ^ drop.depth);
                    }
                    break;
            }
        }
    }

    // rows of one parity update from the other parity's rows, each cell emits a
    // 2x2 block of output pixels - slopes through the render table
    protected calculateWater() {
        const field = this.field, disp = this.disp, rt = this.renderTable;
        const xdim = this.xdim, width = this.image.width, height = this.image.height;
        const xmask = xdim - 1, umask = width - 1, vmask = height - 1;

        this.parity ^= 1;

        for (let y = this.parity; y < height; y += 2) {
            const up = ((y - 1) & vmask) * xdim;
            const down = ((y + 1) & vmask) * xdim;
            const row = y * xdim;
            const outUp = ((y - 1) & vmask) * width;
            const outDown = y * width;

            for (let x = 0; x < xdim; x++) {
                const x1 = (x - 1) & xmask, x2 = (x - 2) & xmask, x3 = (x - 3) & xmask;

                const A = field[up + x3], C = field[up + x2], E = field[up + x1], G = field[up + x];
                const B = field[down + x3], D = field[down + x2], F = field[down + x1], H = field[down + x];

                field[row + x] = WAVE_TABLE[512 + E + G + F + H - (field[row + x] << 1)];

                const EA = E - A, FB = F - B, GC = G - C, HD = H - D;
                const px = (2 * x + this.parity) & umask, px1 = (2 * x - 1 + this.parity) & umask;

                disp[outUp + px1] = rt[512 + ((FB + HD + EA + GC) >> 1)];
                disp[outUp + px] = rt[512 + GC + HD];
                disp[outDown + px1] = rt[512 + FB + HD];
                disp[outDown + px] = rt[512 + HD + HD];
            }
        }
    }

    // displace the source horizontally by the water bitmap (rgba instead of palette indices)
    protected applyWetTexture() {
        const out = this.outPixels, src = this.srcPixels, disp = this.disp;
        const width = this.image.width, height = this.image.height, umask = width - 1;

        for (let v = 0; v < height; v++) {
            const line = v * width;

            for (let u = 0; u < width; u++) {
                const s = (line + ((u + disp[line + u]) & umask)) * 4, d = (line + u) * 4;

                out[d] = src[s];
                out[d + 1] = src[s + 1];
                out[d + 2] = src[s + 2];
                out[d + 3] = src[s + 3];
            }
        }
    }
}

export default WetWaterTexture;
export { WetWaterTexture };
