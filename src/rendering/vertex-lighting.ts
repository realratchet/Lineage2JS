import { BufferAttribute, BufferGeometry, GLBufferAttribute, Matrix4, WebGLRenderer } from "three";
import type DynamicLight from "../objects/dynamic-light";
import type ColorByte from "../utils/color-byte";
import VERTEX_SOURCE from "../materials/mesh-static-material/shader/static-lighting.vs";
import { resolveShaderIncludes } from "../materials/shader-chunks/register-chunks";

const VERTEX_SHADER = resolveShaderIncludes(VERTEX_SOURCE.replace("#version 300 es", "#version 300 es\n#define DYNAMIC_LIGHTING"));
const FRAGMENT_SHADER = "#version 300 es\nprecision highp float;out vec4 color;void main(){color=vec4(0.0);}";
const cacheAffectedVertices = new WeakMap<Uint8Array, Uint32Array>();

export type VertexLight_T = { flags: Uint8Array, vertexRangeStart?: number, vertexRangeEnd?: number, flagsOffset?: number, instance?: DynamicLight };

export function getAffectedVertices(flags: Uint8Array, vertexCount: number, rangeStart: number = 0, rangeEnd: number = vertexCount, flagsOffset: number = 0): Uint32Array {
    let indices = cacheAffectedVertices.get(flags);

    if (!indices) {
        let count = 0;
        for (let vi = rangeStart; vi < rangeEnd; vi++)
            if (flags[(vi >> 3) - flagsOffset] & (1 << (vi & 7))) count++;

        indices = new Uint32Array(count);
        for (let vi = rangeStart, k = 0; vi < rangeEnd; vi++)
            if (flags[(vi >> 3) - flagsOffset] & (1 << (vi & 7))) indices[k++] = vi;

        cacheAffectedVertices.set(flags, indices);
    }

    return indices;
}

export class VertexLighting {
    public output: GLBufferAttribute;
    protected readonly gl: WebGL2RenderingContext;
    protected readonly buffers: WebGLBuffer[] = [];
    protected readonly textures: WebGLTexture[] = [];
    protected readonly shaders: WebGLShader[] = [];
    protected readonly attributes: { source: BufferAttribute, buffer: WebGLBuffer, version: number }[] = [];
    protected readonly table: Float32Array;
    protected readonly matrix = new Float32Array(16);
    protected readonly offsets: Uint32Array;
    protected readonly indices: Uint32Array;
    protected program: WebGLProgram;
    protected vao: WebGLVertexArrayObject;
    protected feedback: WebGLTransformFeedback;
    protected baseBuffer: WebGLBuffer;
    protected tableTexture: WebGLTexture;
    protected width: number;
    protected tableHeight: number;
    protected tableWidth: number;
    protected matrixUniform: WebGLUniformLocation;
    protected baseChanged = true;
    protected readonly onDispose = () => this.dispose();
    protected readonly onRestore = () => { this.program = null; this.render(); };

    public constructor(protected readonly renderer: WebGLRenderer, protected readonly geometry: BufferGeometry, protected readonly glow: Float32Array, protected readonly lights: VertexLight_T[], protected readonly environmentStart: number, protected base: Uint8ClampedArray) {
        this.gl = renderer.getContext() as WebGL2RenderingContext;
        const count = geometry.getAttribute("position").count;
        const counts = new Uint32Array(count);

        for (const entry of lights)
            for (const vi of getAffectedVertices(entry.flags, count, entry.vertexRangeStart, entry.vertexRangeEnd, entry.flagsOffset)) counts[vi]++;

        this.offsets = new Uint32Array(count + 1);
        for (let i = 0; i < count; i++) this.offsets[i + 1] = this.offsets[i] + counts[i];
        this.indices = new Uint32Array(this.offsets[count]);
        counts.set(this.offsets.subarray(0, count));
        for (let i = 0; i < lights.length; i++) {
            const entry = lights[i];
            for (const vi of getAffectedVertices(entry.flags, count, entry.vertexRangeStart, entry.vertexRangeEnd, entry.flagsOffset)) this.indices[counts[vi]++] = i;
        }

        const maxSize = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE);
        this.width = Math.min(4096, maxSize);
        this.tableHeight = Math.max(1, Math.ceil(lights.length * 4 / this.width));
        this.tableWidth = Math.min(this.width, Math.max(1, lights.length * 4));
        if (Math.max(this.offsets.length, this.indices.length, lights.length * 4) > this.width * maxSize) throw new Error(`Vertex lighting tables exceed GPU texture limits for '${geometry.name}'.`);
        this.table = new Float32Array(this.width * this.tableHeight * 4);
        geometry.addEventListener("dispose", this.onDispose);
        renderer.domElement.addEventListener("webglcontextrestored", this.onRestore);
    }

    protected createShader(type: number, source: string): WebGLShader {
        const gl = this.gl, shader = gl.createShader(type);
        this.shaders.push(shader);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
        return shader;
    }

    protected attribute(data: ArrayBufferView, index: number, size: number, type: number): WebGLBuffer {
        const gl = this.gl, buffer = gl.createBuffer();
        this.buffers.push(buffer);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(index);
        gl.vertexAttribPointer(index, size, type, false, 0, 0);
        return buffer;
    }

    protected texture(data: Uint32Array | Float32Array, channels: number, unit: number, name: string): WebGLTexture {
        const gl = this.gl, height = Math.max(1, Math.ceil(data.length / (this.width * channels)));
        const padded = new (data.constructor as any)(this.width * height * channels);
        padded.set(data);
        const texture = gl.createTexture();
        this.textures.push(texture);
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texImage2D(gl.TEXTURE_2D, 0, channels === 1 ? gl.R32UI : gl.RGBA32F, this.width, height, 0, channels === 1 ? gl.RED_INTEGER : gl.RGBA, channels === 1 ? gl.UNSIGNED_INT : gl.FLOAT, padded);
        gl.uniform1i(gl.getUniformLocation(this.program, name), unit);
        return texture;
    }

    protected create() {
        const gl = this.gl;
        this.buffers.length = this.textures.length = this.shaders.length = 0;
        this.attributes.length = 0;
        this.program = gl.createProgram();
        gl.attachShader(this.program, this.createShader(gl.VERTEX_SHADER, VERTEX_SHADER));
        gl.attachShader(this.program, this.createShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
        gl.transformFeedbackVaryings(this.program, ["packedLighting"], gl.INTERLEAVED_ATTRIBS);
        gl.linkProgram(this.program);
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program));
        gl.useProgram(this.program);
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);
        for (let i = 0; i < 2; i++) {
            const source = this.geometry.getAttribute(i === 0 ? "position" : "normal") as BufferAttribute;
            if ((source as any).isInterleavedBufferAttribute || !(source.array instanceof Float32Array) || source.count !== this.glow.length || source.itemSize !== 3) throw new Error(`Invalid vertex lighting input for '${this.geometry.name}'.`);
            this.attributes.push({ source, buffer: this.attribute(source.array, i, 3, gl.FLOAT), version: source.version });
        }
        this.attribute(this.glow, 2, 1, gl.FLOAT);
        this.baseBuffer = this.attribute(this.base, 3, 3, gl.UNSIGNED_BYTE);
        this.texture(this.offsets, 1, 0, "offsets");
        this.texture(this.indices, 1, 1, "indices");
        this.tableTexture = this.texture(this.table, 4, 2, "lights");
        gl.uniform1ui(gl.getUniformLocation(this.program, "textureWidth"), this.width);
        this.matrixUniform = gl.getUniformLocation(this.program, "matrix");
        const buffer = gl.createBuffer();
        this.buffers.push(buffer);
        gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, buffer);
        gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, this.glow.length * 4, gl.DYNAMIC_COPY);
        this.feedback = gl.createTransformFeedback();
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.feedback);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, buffer);
        if (this.output) {
            this.output.setBuffer(buffer);
            this.output.needsUpdate = true;
        } else this.output = new GLBufferAttribute(buffer, gl.UNSIGNED_BYTE, 4, 1, this.glow.length, true);
        this.baseChanged = false;
    }

    public update(matrix: Matrix4, base: Uint8ClampedArray, baseChanged: boolean, color: ColorByte, current: number, next: number, lerp: number) {
        this.base = base;
        this.baseChanged = this.baseChanged || baseChanged;
        matrix.toArray(this.matrix);
        for (let i = 0; i < this.lights.length; i++) {
            const light = this.lights[i].instance, offset = i * 16, environment = i >= this.environmentStart;
            light.lightPosition.toArray(this.table, offset);
            this.table[offset + 3] = light.lightRadius;
            light.lightDirection.toArray(this.table, offset + 4);
            this.table[offset + 7] = light.cone;
            this.table[offset + 8] = environment ? color.r : light.bakedColor.r;
            this.table[offset + 9] = environment ? color.g : light.bakedColor.g;
            this.table[offset + 10] = environment ? color.b : light.bakedColor.b;
            this.table[offset + 11] = light.lightEffect;
            const index = i - this.environmentStart;
            this.table[offset + 12] = environment ? (index === current ? 1 - lerp : 0) + (index === next ? lerp : 0) : 1;
        }
        this.render();
    }

    protected render() {
        const gl = this.gl;
        if (gl.isContextLost()) return;
        const target = this.renderer.getRenderTarget(), cubeFace = this.renderer.getActiveCubeFace(), mipLevel = this.renderer.getActiveMipmapLevel();
        this.renderer.resetState();
        try {
            const created = !this.program;
            if (created) this.create();
            gl.useProgram(this.program);
            gl.bindVertexArray(this.vao);
            gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.feedback);
            for (let i = 0; i < this.textures.length; i++) {
                gl.activeTexture(gl.TEXTURE0 + i);
                gl.bindTexture(gl.TEXTURE_2D, this.textures[i]);
            }
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.tableWidth, this.tableHeight, gl.RGBA, gl.FLOAT, this.table);
            for (const entry of this.attributes)
                if (entry.version !== entry.source.version) {
                    gl.bindBuffer(gl.ARRAY_BUFFER, entry.buffer);
                    gl.bufferSubData(gl.ARRAY_BUFFER, 0, entry.source.array);
                    entry.version = entry.source.version;
                }
            if (this.baseChanged) {
                gl.bindBuffer(gl.ARRAY_BUFFER, this.baseBuffer);
                gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.base);
                this.baseChanged = false;
            }
            gl.uniformMatrix4fv(this.matrixUniform, false, this.matrix);
            gl.enable(gl.RASTERIZER_DISCARD);
            gl.beginTransformFeedback(gl.POINTS);
            gl.drawArrays(gl.POINTS, 0, this.glow.length);
            gl.endTransformFeedback();
            gl.disable(gl.RASTERIZER_DISCARD);
            if (created) {
                const error = gl.getError();
                if (error !== gl.NO_ERROR && !gl.isContextLost()) throw new Error(`Vertex lighting GL error ${error}.`);
            }
        } finally {
            gl.disable(gl.RASTERIZER_DISCARD);
            gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
            gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
            gl.bindVertexArray(null);
            this.renderer.resetState();
            this.renderer.setRenderTarget(target, cubeFace, mipLevel);
        }
    }

    public dispose() {
        const gl = this.gl;
        this.geometry.removeEventListener("dispose", this.onDispose);
        this.renderer.domElement.removeEventListener("webglcontextrestored", this.onRestore);
        for (const buffer of this.buffers) gl.deleteBuffer(buffer);
        for (const texture of this.textures) gl.deleteTexture(texture);
        for (const shader of this.shaders) gl.deleteShader(shader);
        if (this.feedback) gl.deleteTransformFeedback(this.feedback);
        if (this.vao) gl.deleteVertexArray(this.vao);
        if (this.program) gl.deleteProgram(this.program);
    }
}

export default VertexLighting;
