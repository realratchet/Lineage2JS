import { DataTexture, FloatType, GLSL3, KeyframeTrack, Matrix4, NearestFilter, NoBlending, RGBAFormat, RawShaderMaterial, WebGLRenderTarget, WebGLRenderer } from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass";
import RangeAllocator from "../utils/range-allocator";

const BONE_ATLAS_WIDTH = 1024;
const BONES_PER_ROW = BONE_ATLAS_WIDTH / 4;
const CLIP_ATLAS_WIDTH = 2048;
type ClipRange_T = { start: number, count: number, references: number, framerate: number };

export const POSE_TRANSFORM = 0;
export const POSE_LOCAL_MATRIX = 1;
export const POSE_SKIN_MATRIX = 2;
export const POSE_CLIP = 3; // position.w and scale.w hold track addresses, texel 3 the header bone, whose z and w are frame and last frame

export function writePoseMatrix(matrix: Matrix4, target: Float32Array, offset: number, mode: number): void {
    const elements = matrix.elements;

    target[offset] = elements[0]; target[offset + 1] = elements[4]; target[offset + 2] = elements[8]; target[offset + 3] = elements[12];
    target[offset + 4] = elements[1]; target[offset + 5] = elements[5]; target[offset + 6] = elements[9]; target[offset + 7] = elements[13];
    target[offset + 8] = elements[2]; target[offset + 9] = elements[6]; target[offset + 10] = elements[10]; target[offset + 11] = elements[14];
    target[offset + 12] = mode;
}

export class BoneAtlas {
    protected pose: Float32Array;
    protected bind: Float32Array;
    protected poseTexture: DataTexture;
    protected bindTexture: DataTexture;
    protected target: WebGLRenderTarget;
    protected rows: number;
    protected readonly ranges: RangeAllocator;
    protected readonly counts = new Map<number, number>();
    protected readonly material: RawShaderMaterial;
    protected readonly quad: FullScreenQuad;
    protected dirtyStart: number = Infinity;
    protected dirtyEnd: number = -1;
    protected clip: Float32Array;
    protected clipTexture: DataTexture;
    protected clipRows: number = 64;
    protected readonly clipRanges = new RangeAllocator(CLIP_ATLAS_WIDTH * this.clipRows);
    protected readonly cacheClips = new WeakMap<KeyframeTrack, ClipRange_T>();
    protected clipDirtyStart: number = Infinity;
    protected clipDirtyEnd: number = -1;

    public constructor(rows: number = 64) {

        this.rows = rows;
        this.ranges = new RangeAllocator(rows * BONES_PER_ROW);

        this.material = new RawShaderMaterial({
            glslVersion: GLSL3,
            depthTest: false,
            depthWrite: false,
            blending: NoBlending,
            uniforms: { poseMap: { value: null }, bindMap: { value: null }, clipMap: { value: null } },
            vertexShader: `
                in vec3 position;
                void main() {
                    gl_Position = vec4(position.xy, 0.0, 1.0);
                }
            `,
            fragmentShader: `
                precision highp float;
                precision highp sampler2D;
                uniform sampler2D poseMap;
                uniform sampler2D bindMap;
                uniform sampler2D clipMap;
                out vec4 boneColumn;
                mat4 fromRows(vec4 a, vec4 b, vec4 c) {
                    return mat4(a.x, b.x, c.x, 0.0, a.y, b.y, c.y, 0.0, a.z, b.z, c.z, 0.0, a.w, b.w, c.w, 1.0);
                }
                mat4 compose(vec3 position, vec4 q, vec3 scale) {
                    float x2 = q.x + q.x, y2 = q.y + q.y, z2 = q.z + q.z;
                    float xx = q.x * x2, xy = q.x * y2, xz = q.x * z2;
                    float yy = q.y * y2, yz = q.y * z2, zz = q.z * z2;
                    float wx = q.w * x2, wy = q.w * y2, wz = q.w * z2;
                    return mat4(
                        (1.0 - (yy + zz)) * scale.x, (xy + wz) * scale.x, (xz - wy) * scale.x, 0.0,
                        (xy - wz) * scale.y, (1.0 - (xx + zz)) * scale.y, (yz + wx) * scale.y, 0.0,
                        (xz + wy) * scale.z, (yz - wx) * scale.z, (1.0 - (xx + yy)) * scale.z, 0.0,
                        position, 1.0
                    );
                }
                vec4 clipKey(int address) {
                    return texelFetch(clipMap, ivec2(address % ${CLIP_ATLAS_WIDTH}, address / ${CLIP_ATLAS_WIDTH}), 0);
                }
                float sine(float x) {
                    float x2 = x * x;
                    return x * (1.0 + x2 * (-1.0 / 6.0 + x2 * (1.0 / 120.0 + x2 * (-1.0 / 5040.0 + x2 * (1.0 / 362880.0 + x2 * (-1.0 / 39916800.0))))));
                }
                vec4 slerp(vec4 a, vec4 b, float t) { // driver sin and atan are a few 1e-5 off, enough to drift a twelve bone chain
                    float cosine = dot(a, b), direction = cosine >= 0.0 ? 1.0 : -1.0, sineSq = 1.0 - cosine * cosine, s = 1.0 - t;
                    if (sineSq > 1e-6) {
                        float cosine2 = sqrt(0.5 + 0.5 * cosine * direction), cosine4 = sqrt(0.5 + 0.5 * cosine2), cosine8 = sqrt(0.5 + 0.5 * cosine4);
                        float x = 0.125 * sqrt(sineSq) / (cosine2 * cosine4 * cosine8), x2 = x * x, angle = 8.0 * x * (1.0 + x2 * (1.0 / 6.0 + x2 * (3.0 / 40.0 + x2 * (15.0 / 336.0))));
                        float scale = 1.0 / sine(angle);
                        s = sine(s * angle) * scale;
                        t = sine(t * angle) * scale;
                    }
                    return a * s + b * (t * direction);
                }
                void main() {
                    ivec2 texel = ivec2(gl_FragCoord.xy);
                    int column = texel.x & 3;
                    ivec2 bone = ivec2(texel.x - column, texel.y);
                    mat4 result;
                    if (texelFetch(poseMap, bone + ivec2(3, 0), 0).x == ${POSE_SKIN_MATRIX}.0) {
                        result = fromRows(texelFetch(poseMap, bone, 0), texelFetch(poseMap, bone + ivec2(1, 0), 0), texelFetch(poseMap, bone + ivec2(2, 0), 0));
                    } else {
                        result = fromRows(texelFetch(bindMap, bone, 0), texelFetch(bindMap, bone + ivec2(1, 0), 0), texelFetch(bindMap, bone + ivec2(2, 0), 0));
                        while (true) {
                            vec4 a = texelFetch(poseMap, bone, 0), b = texelFetch(poseMap, bone + ivec2(1, 0), 0), c = texelFetch(poseMap, bone + ivec2(2, 0), 0), d = texelFetch(poseMap, bone + ivec2(3, 0), 0);
                            if (d.x == ${POSE_CLIP}.0) {
                                int header = int(d.y);
                                vec4 time = texelFetch(poseMap, ivec2((header % ${BONES_PER_ROW}) * 4 + 3, header / ${BONES_PER_ROW}), 0);
                                int last = int(time.w), frame = min(int(time.z), last), next = min(frame + 1, last);
                                float alpha = time.z - float(frame);
                                if (a.w >= 0.0) a.xyz = mix(clipKey(int(a.w) + frame).xyz, clipKey(int(a.w) + next).xyz, alpha);
                                if (c.w >= 0.0) b = slerp(clipKey(int(c.w) + frame), clipKey(int(c.w) + next), alpha);
                            }
                            result = (d.x == ${POSE_LOCAL_MATRIX}.0 ? fromRows(a, b, c) : compose(a.xyz, b, c.xyz)) * result;
                            int parent = int(texelFetch(bindMap, bone + ivec2(3, 0), 0).x);
                            if (parent < 0) break;
                            bone = ivec2((parent % ${BONES_PER_ROW}) * 4, parent / ${BONES_PER_ROW});
                        }
                    }
                    boneColumn = result[column];
                }
            `
        });
        this.quad = new FullScreenQuad(this.material);

        this.createTextures();
        this.createClipTexture();
    }

    protected createClipTexture(): void {
        const clip = new Float32Array(CLIP_ATLAS_WIDTH * this.clipRows * 4);

        if (this.clip) {
            clip.set(this.clip);
            this.clipTexture.dispose();
        }

        this.clip = clip;
        this.clipTexture = new DataTexture(clip, CLIP_ATLAS_WIDTH, this.clipRows, RGBAFormat, FloatType);
        this.clipTexture.needsUpdate = true;
        this.material.uniforms.clipMap.value = this.clipTexture;
    }

    protected createTextures(): void {
        const pose = new Float32Array(BONE_ATLAS_WIDTH * this.rows * 4), bind = new Float32Array(BONE_ATLAS_WIDTH * this.rows * 4);

        for (let i = 12; i < bind.length; i += 16) bind[i] = -1;

        if (this.pose) {
            pose.set(this.pose);
            bind.set(this.bind);
            this.poseTexture.dispose();
            this.bindTexture.dispose();
            this.target.dispose();
        }

        this.pose = pose;
        this.bind = bind;
        this.poseTexture = new DataTexture(pose, BONE_ATLAS_WIDTH, this.rows, RGBAFormat, FloatType);
        this.poseTexture.needsUpdate = true;
        this.bindTexture = new DataTexture(bind, BONE_ATLAS_WIDTH, this.rows, RGBAFormat, FloatType);
        this.bindTexture.needsUpdate = true;
        this.target = new WebGLRenderTarget(BONE_ATLAS_WIDTH, this.rows, { type: FloatType, format: RGBAFormat, minFilter: NearestFilter, magFilter: NearestFilter, depthBuffer: false });
        this.target.scissorTest = true;
        this.material.uniforms.poseMap.value = this.poseTexture;
        this.material.uniforms.bindMap.value = this.bindTexture;
    }

    public getTexture() { return this.target.texture; }
    public getPose(): Float32Array { return this.pose; }
    public retainClip(track: KeyframeTrack, framerate: number, lastFrame: number): number {
        const cached = this.cacheClips.get(track), count = lastFrame + 1;

        if (cached) {
            if (cached.count !== count || cached.framerate !== framerate) throw new Error(`Animation track '${track.name}' has conflicting frame grids.`);
            cached.references++;
            return cached.start;
        }

        let start = this.clipRanges.allocate(count);

        if (start < 0) {
            const previous = this.clipRows;

            while ((this.clipRows - previous) * CLIP_ATLAS_WIDTH < count) this.clipRows *= 2;
            this.createClipTexture();
            this.clipRanges.grow(CLIP_ATLAS_WIDTH * this.clipRows);
            start = this.clipRanges.allocate(count);
        }

        const size = track.getValueSize(), interpolant = track.createInterpolant();

        for (let frame = 0; frame <= lastFrame; frame++) {
            const value = track.times.length === count ? track.values.subarray(frame * size, frame * size + size) : interpolant.evaluate(frame / framerate);

            for (let i = 0; i < size; i++) this.clip[(start + frame) * 4 + i] = value[i];
        }

        this.cacheClips.set(track, { start, count, references: 1, framerate });
        this.clipDirtyStart = Math.min(this.clipDirtyStart, Math.floor(start / CLIP_ATLAS_WIDTH));
        this.clipDirtyEnd = Math.max(this.clipDirtyEnd, Math.floor((start + count - 1) / CLIP_ATLAS_WIDTH));
        return start;
    }

    public releaseClip(track: KeyframeTrack): void {
        const range = this.cacheClips.get(track);

        if (!range) throw new Error(`Animation track '${track.name}' is not retained in the bone atlas.`);
        if (--range.references > 0) return;

        this.cacheClips.delete(track);
        this.clipRanges.free(range.start, range.count);
    }

    public allocate(count: number): number {
        let start = this.ranges.allocate(count);

        if (start < 0) {
            const previous = this.rows;

            while ((this.rows - previous) * BONES_PER_ROW < count) this.rows *= 2;

            this.createTextures();
            this.ranges.grow(this.rows * BONES_PER_ROW);
            start = this.ranges.allocate(count);
        }

        this.counts.set(start, count);
        return start;
    }

    public setBind(start: number, inverses: Matrix4[], parents: Int32Array): void {
        for (let i = 0; i < inverses.length; i++)
            writePoseMatrix(inverses[i], this.bind, (start + i) * 16, parents[i] < 0 ? -1 : start + parents[i]);

        this.bindTexture.needsUpdate = true;
    }

    public free(start: number): void {
        const count = this.counts.get(start);

        if (count === undefined) throw new Error(`Bone atlas range ${start} is not allocated.`);

        this.counts.delete(start);
        this.ranges.free(start, count);
    }

    public markDirty(start: number, count: number): void {
        const first = Math.floor(start / BONES_PER_ROW), last = Math.floor((start + count - 1) / BONES_PER_ROW);

        if (first < this.dirtyStart) this.dirtyStart = first;
        if (last > this.dirtyEnd) this.dirtyEnd = last;
    }

    protected uploadRows(renderer: WebGLRenderer, texture: DataTexture, data: Float32Array, width: number, start: number, end: number): boolean {
        const properties = renderer.properties.get(texture) as { __webglTexture: WebGLTexture };

        if (!properties.__webglTexture) { // first use, atlas growth or a restored context
            renderer.initTexture(texture);
            return true;
        }
        if (end < 0) return false;

        const gl = renderer.getContext() as WebGL2RenderingContext, state = renderer.state as any;

        state.bindTexture(gl.TEXTURE_2D, properties.__webglTexture);
        state.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        state.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        state.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, start, width, end - start + 1, gl.RGBA, gl.FLOAT, data, start * width * 4);
        return false;
    }

    public upload(renderer: WebGLRenderer): void {
        this.uploadRows(renderer, this.clipTexture, this.clip, CLIP_ATLAS_WIDTH, this.clipDirtyStart, this.clipDirtyEnd);
        this.clipDirtyStart = Infinity;
        this.clipDirtyEnd = -1;

        if (this.uploadRows(renderer, this.poseTexture, this.pose, BONE_ATLAS_WIDTH, this.dirtyStart, this.dirtyEnd)) {
            this.dirtyStart = 0;
            this.dirtyEnd = this.rows - 1;
        } else if (this.dirtyEnd < 0) return;

        const depth = renderer.state.buffers.depth, isReversed = depth.getReversed();
        const target = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), level = renderer.getActiveMipmapLevel();
        const autoClear = renderer.autoClear, autoReset = renderer.info.autoReset;

        this.target.scissor.set(0, this.dirtyStart, BONE_ATLAS_WIDTH, this.dirtyEnd - this.dirtyStart + 1);

        try {
            renderer.autoClear = false;
            renderer.info.autoReset = false;
            renderer.setRenderTarget(this.target);
            this.quad.render(renderer);
            this.dirtyStart = Infinity;
            this.dirtyEnd = -1;
        } finally {
            renderer.setRenderTarget(target, face, level);
            renderer.autoClear = autoClear;
            renderer.info.autoReset = autoReset;
            depth.setReversed(isReversed); // the render wrapper follows the quad camera
        }
    }
}

export const boneAtlas = new BoneAtlas();
export default boneAtlas;
