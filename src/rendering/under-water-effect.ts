import { BufferAttribute, BufferGeometry, Color, DataTexture, LinearFilter, Mesh, MeshBasicMaterial, Object3D, PerspectiveCamera, RGBAFormat, Vector3, WebGLRenderer } from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass";
import ParticleMaterial from "@client/materials/particle-material/particle-material";
import ColorByte from "@client/utils/color-byte";

// UUnderWaterEffect::PostRender 0x7de880 and L2.water.trace 22083952: cellophane plus 60 SunBeam ribbons.

const BEAM_COUNT = 60;
const BEAM_SEGMENTS = 9;
const SEGMENT_LENGTH = 92;
const SPREAD = 900;
const WIDTH_MIN = 46, WIDTH_MAX = 120;
const TOP_JITTER = 12;
const LIFETIME = 6;
const DIRECTION = new Vector3(0.2, 0, -1).normalize();
const HEAD_COLOR = new Color(9 / 255, 11 / 255, 13 / 255);

const tmpPoint = new Vector3();
const tmpSide = new Vector3();
const tmpView = new Vector3();

type SunBeam_T = { x: number, y: number, top: number, width: number, life: number };

// two soft lobes across the ribbon, taper along its length - the profile of the 256x128 beam sprite
function makeBeamTexture(): DataTexture {
    const size = 64;
    const data = new Uint8Array(size * size * 4);

    for (let y = 0; y < size; y++) {
        const v = (y + 0.5) / size;
        const band = Math.exp(-((v - 0.36) ** 2) / (2 * 0.14 ** 2)) + 0.66 * Math.exp(-((v - 0.75) ** 2) / (2 * 0.06 ** 2));

        for (let x = 0; x < size; x++) {
            const u = (x + 0.5) / size;
            const taper = u < 0.12 ? u / 0.12 : Math.max(0, 1 - (u - 0.12) / 0.75);
            const l = Math.round(Math.min(1, band * taper) * 255);
            const o = (y * size + x) * 4;

            data[o] = data[o + 1] = data[o + 2] = l;
            data[o + 3] = 255;
        }
    }

    const texture = new DataTexture(data, size, size, RGBAFormat);

    texture.minFilter = texture.magFilter = LinearFilter;
    texture.needsUpdate = true;

    return texture;
}

class UnderWaterEffect extends Object3D {
    protected readonly beams: SunBeam_T[] = [];
    protected readonly mesh: Mesh;
    protected readonly positions: Float32Array;
    protected readonly colors: Float32Array;
    protected readonly beamTexture: DataTexture;
    protected readonly beamMaterial: ParticleMaterial;
    protected readonly cellophaneMaterial: MeshBasicMaterial;
    protected readonly cellophaneQuad: FullScreenQuad;
    protected surfaceZ = 0;

    public constructor() {

        super();

        const crossSections = BEAM_SEGMENTS + 1;
        const vertexCount = BEAM_COUNT * crossSections * 2;

        this.positions = new Float32Array(vertexCount * 3);
        this.colors = new Float32Array(vertexCount * 3);

        const uvs = new Float32Array(vertexCount * 2);
        const indices = new Uint16Array(BEAM_COUNT * BEAM_SEGMENTS * 6);

        for (let r = 0; r < BEAM_COUNT; r++) {
            const base = r * crossSections * 2;

            for (let s = 0; s < crossSections; s++) {
                const u = s / BEAM_SEGMENTS;

                uvs[(base + s * 2) * 2] = u;
                uvs[(base + s * 2) * 2 + 1] = 0;
                uvs[(base + s * 2 + 1) * 2] = u;
                uvs[(base + s * 2 + 1) * 2 + 1] = 1;
            }

            for (let s = 0; s < BEAM_SEGMENTS; s++) {
                const i = (r * BEAM_SEGMENTS + s) * 6;
                const v = base + s * 2;

                indices[i] = v; indices[i + 1] = v + 1; indices[i + 2] = v + 2;
                indices[i + 3] = v + 1; indices[i + 4] = v + 3; indices[i + 5] = v + 2;
            }

            this.beams.push({ x: 0, y: 0, top: 0, width: 0, life: Math.random() });
        }

        const geometry = new BufferGeometry();

        geometry.setAttribute("position", new BufferAttribute(this.positions, 3));
        geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
        geometry.setAttribute("color", new BufferAttribute(this.colors, 3));
        geometry.setIndex(new BufferAttribute(indices, 1));
        geometry.boundingSphere = null;

        this.beamTexture = makeBeamTexture();
        this.beamMaterial = new ParticleMaterial({ map: { uniforms: { map: { texture: this.beamTexture } } } as any, blendingMode: "brighten", name: "SunBeam" });

        this.beamMaterial.vertexColors = true;

        this.mesh = new Mesh(geometry, this.beamMaterial);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 3000;

        this.add(this.mesh);
        this.visible = false;

        this.cellophaneMaterial = new MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false });
        this.cellophaneQuad = new FullScreenQuad(this.cellophaneMaterial);
    }

    // bUseCellophane picks the volume's own color, otherwise the Env.int [WaterVolume] one (0x7de880)
    public setVolume(volume: GD.IWaterVolumeDecodeInfo | null, envCellophane: ColorByte) {
        this.visible = !!volume;

        if (!volume) return;

        const color = volume.cellophane ?? [envCellophane.r, envCellophane.g, envCellophane.b, envCellophane.a];

        this.cellophaneMaterial.color.setRGB(color[0] / 255, color[1] / 255, color[2] / 255);
        this.cellophaneMaterial.opacity = color[3] / 255;

        this.surfaceZ = surfaceHeight(volume);
    }

    public update(camera: PerspectiveCamera, deltaTime: number) {
        if (!this.visible) return;

        const crossSections = BEAM_SEGMENTS + 1;
        const step = deltaTime / 1000 / LIFETIME;

        for (let r = 0; r < BEAM_COUNT; r++) {
            const beam = this.beams[r];

            beam.life += step;

            if (beam.life >= 1 || beam.width === 0) {
                beam.life = 0;
                beam.x = camera.position.x + (Math.random() - 0.5) * SPREAD;
                beam.y = camera.position.y + (Math.random() - 0.5) * SPREAD;
                beam.top = this.surfaceZ + (Math.random() - 0.5) * TOP_JITTER;
                beam.width = WIDTH_MIN + Math.random() * (WIDTH_MAX - WIDTH_MIN);
            }

            const fade = 1 - beam.life;
            const half = beam.width * 0.5;
            const base = r * crossSections * 2;

            for (let s = 0; s < crossSections; s++) {
                tmpPoint.set(beam.x, beam.y, beam.top).addScaledVector(DIRECTION, s * SEGMENT_LENGTH);
                tmpView.subVectors(tmpPoint, camera.position);
                tmpSide.crossVectors(DIRECTION, tmpView).normalize().multiplyScalar(half);

                const a = (base + s * 2) * 3, b = a + 3;

                this.positions[a] = tmpPoint.x - tmpSide.x;
                this.positions[a + 1] = tmpPoint.y - tmpSide.y;
                this.positions[a + 2] = tmpPoint.z - tmpSide.z;
                this.positions[b] = tmpPoint.x + tmpSide.x;
                this.positions[b + 1] = tmpPoint.y + tmpSide.y;
                this.positions[b + 2] = tmpPoint.z + tmpSide.z;

                this.colors[a] = this.colors[b] = HEAD_COLOR.r * fade;
                this.colors[a + 1] = this.colors[b + 1] = HEAD_COLOR.g * fade;
                this.colors[a + 2] = this.colors[b + 2] = HEAD_COLOR.b * fade;
            }
        }

        this.mesh.geometry.getAttribute("position").needsUpdate = true;
        this.mesh.geometry.getAttribute("color").needsUpdate = true;
    }

    public renderCellophane(renderer: WebGLRenderer) {
        if (!this.visible) return;

        this.cellophaneQuad.render(renderer);
    }

    public dispose(): void {
        this.mesh.geometry.dispose();
        this.beamMaterial.dispose();
        this.beamTexture.dispose();
        this.cellophaneQuad.dispose();
        this.cellophaneMaterial.dispose();
    }
}

// the water sheet sits on the volume brush's +Z plane
function surfaceHeight(volume: GD.IWaterVolumeDecodeInfo) {
    let best = -Infinity;

    for (const node of volume.bsp.nodes)
        if (node.plane[2] > 0.99) best = Math.max(best, node.plane[3]);

    return best === -Infinity ? 0 : best;
}

export default UnderWaterEffect;
export { UnderWaterEffect };
