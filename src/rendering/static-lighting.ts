import { BufferGeometry, Matrix4, WebGLRenderer } from "three";
import DynamicLight from "../objects/dynamic-light";
import VERTEX_SOURCE from "../materials/mesh-static-material/shader/static-lighting.vs";
import { resolveShaderIncludes } from "../materials/shader-chunks/register-chunks";

const VERTEX_SHADER = resolveShaderIncludes(VERTEX_SOURCE);
const FRAGMENT_SHADER = "#version 300 es\nprecision highp float;out vec4 color;void main(){color=vec4(0.0);}";

type StaticLightingJob_T = { gl: WebGL2RenderingContext, output: WebGLBuffer, sync: WebGLSync, values: Uint32Array, count: number, matrix: Matrix4, table: Float32Array, release(): void, dispose(): void };
const cacheJobs = new WeakMap<Uint8ClampedArray, StaticLightingJob_T>();
const cachePrograms = new WeakMap<WebGL2RenderingContext, WebGLProgram>();
const pendingJobs = new Set<StaticLightingJob_T>();

type LightEntry_T = { flags: Uint8Array, vertexRangeStart?: number, vertexRangeEnd?: number, flagsOffset?: number, instance?: DynamicLight };

function checkError(gl: WebGL2RenderingContext, phase: string): void {
    const error = gl.getError();

    if (error !== gl.NO_ERROR && !gl.isContextLost()) throw new Error(`Static lighting GL error ${error} (${phase}).`);
}

export function cancelStaticLighting(target: Uint8ClampedArray): void {
    cacheJobs.get(target)?.dispose();
}

export function disposeStaticLighting(renderer: WebGLRenderer): void {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    for (const job of pendingJobs) if (job.gl === gl) job.dispose();
    const program = cachePrograms.get(gl);
    if (program) gl.deleteProgram(program);
    cachePrograms.delete(gl);
}

function getProgram(renderer: WebGLRenderer): WebGLProgram {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    let program = cachePrograms.get(gl);
    if (program) return program;

    program = gl.createProgram();
    const shaders: WebGLShader[] = [];

    try {
        for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX_SHADER], [gl.FRAGMENT_SHADER, FRAGMENT_SHADER]] as const) {
            const shader = gl.createShader(type);
            shaders.push(shader);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
            gl.attachShader(program, shader);
        }
        gl.transformFeedbackVaryings(program, ["packedLighting"], gl.INTERLEAVED_ATTRIBS);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
        cachePrograms.set(gl, program);
        renderer.domElement.addEventListener("webglcontextlost", () => cachePrograms.delete(gl), { once: true });
        return program;
    } catch (error) {
        gl.deleteProgram(program);
        throw error;
    } finally {
        for (const shader of shaders) gl.deleteShader(shader);
    }
}

function storeJob(renderer: WebGLRenderer, geometry: BufferGeometry, target: Uint8ClampedArray, output: WebGLBuffer, sync: WebGLSync, matrix: Matrix4, table: Float32Array): void {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    const job: StaticLightingJob_T = { gl, output, sync, values: null, count: geometry.getAttribute("position").count, matrix: matrix.clone(), table, release, dispose };

    function release(): void {
        if (!pendingJobs.delete(job)) return;
        gl.deleteSync(sync);
        gl.deleteBuffer(output);
    }

    function dispose(): void {
        if (cacheJobs.get(target) !== job) return;
        cacheJobs.delete(target);
        release();
        geometry.removeEventListener("dispose", dispose);
        renderer.domElement.removeEventListener("webglcontextlost", dispose);
    }

    cacheJobs.set(target, job);
    pendingJobs.add(job);
    geometry.addEventListener("dispose", dispose);
    renderer.domElement.addEventListener("webglcontextlost", dispose);
}

export function pollStaticLighting(): void {
    for (const job of pendingJobs) {
        const gl = job.gl;
        if (gl.isContextLost()) { job.dispose(); continue; }
        const status = gl.clientWaitSync(job.sync, 0, 0);
        if (status === gl.TIMEOUT_EXPIRED) continue;

        try {
            if (status === gl.WAIT_FAILED) throw new Error(`Static lighting fence wait failed.`);
            const values = new Uint32Array(job.count);

            gl.bindBuffer(gl.COPY_READ_BUFFER, job.output);
            gl.getBufferSubData(gl.COPY_READ_BUFFER, 0, values);
            if (gl.isContextLost()) { job.dispose(); continue; }
            checkError(gl, "readback");
            job.values = values;
            job.release();
        } catch (error) {
            job.dispose();
            throw error;
        } finally {
            gl.bindBuffer(gl.COPY_READ_BUFFER, null);
        }
    }
}

export function computeStaticLighting(renderer: WebGLRenderer, geometry: BufferGeometry, matrix: Matrix4, lights: LightEntry_T[], glow: Float32Array, target: Uint8ClampedArray, prepared: { offsets: Uint32Array, indices: Uint16Array | Uint32Array }): boolean | null {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    if (gl.isContextLost()) return null;

    const count = geometry.getAttribute("position").count;
    const { offsets, indices } = prepared;

    const table = new Float32Array(lights.length * 12);

    for (let i = 0; i < lights.length; i++) {
        const light = lights[i].instance;

        light.lightPosition.toArray(table, i * 12);
        table[i * 12 + 3] = light.lightRadius;
        light.lightDirection.toArray(table, i * 12 + 4);
        table[i * 12 + 7] = light.cone;
        table[i * 12 + 8] = light.bakedColor.r;
        table[i * 12 + 9] = light.bakedColor.g;
        table[i * 12 + 10] = light.bakedColor.b;
        table[i * 12 + 11] = light.lightEffect;
    }

    const job = cacheJobs.get(target);

    if (job && (!job.matrix.equals(matrix) || job.table.length !== table.length || job.table.some((value, index) => value !== table[index]))) job.dispose();
    else if (job) {
        if (!job.values) return null;
        for (let i = 0; i < count; i++) {
            target[i * 3] = job.values[i] & 255;
            target[i * 3 + 1] = (job.values[i] >>> 8) & 255;
            target[i * 3 + 2] = (job.values[i] >>> 16) & 255;
        }
        job.dispose();
        return true;
    }

    if (pendingJobs.size >= 4) return null;
    checkError(gl, "before setup");
    const maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE), width = Math.min(4096, maxSize);
    if (Math.max(offsets.length, indices.length, table.length / 4) > width * maxSize) return false;

    const buffers: WebGLBuffer[] = [], textures: WebGLTexture[] = [];
    const renderTarget = renderer.getRenderTarget(), cubeFace = renderer.getActiveCubeFace(), mipLevel = renderer.getActiveMipmapLevel();
    let program: WebGLProgram, vao: WebGLVertexArrayObject, feedback: WebGLTransformFeedback;

    function attribute(data: ArrayBufferView, index: number, size: number, type: number): void {
        const buffer = gl.createBuffer();
        buffers.push(buffer);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(index);
        gl.vertexAttribPointer(index, size, type, false, 0, 0);
    }

    function texture(data: Uint16Array | Uint32Array | Float32Array, channels: number, unit: number, internal: number, format: number, type: number, name: string): void {
        const height = Math.max(1, Math.ceil(data.length / (width * channels)));
        const padded = new (data.constructor as any)(width * height * channels);
        padded.set(data);
        const texture = gl.createTexture();
        textures.push(texture);
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texImage2D(gl.TEXTURE_2D, 0, internal, width, height, 0, format, type, padded);
        gl.uniform1i(gl.getUniformLocation(program, name), unit);
    }

    try {
        renderer.resetState();
        program = getProgram(renderer);
        gl.useProgram(program);
        vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        attribute(geometry.getAttribute("position").array, 0, 3, gl.FLOAT);
        attribute(geometry.getAttribute("normal").array, 1, 3, gl.FLOAT);
        attribute(glow, 2, 1, gl.FLOAT);
        attribute(target, 3, 3, gl.UNSIGNED_BYTE);
        texture(offsets, 1, 0, gl.R32UI, gl.RED_INTEGER, gl.UNSIGNED_INT, "offsets");
        texture(indices, 1, 1, indices.BYTES_PER_ELEMENT === 2 ? gl.R16UI : gl.R32UI, gl.RED_INTEGER, indices.BYTES_PER_ELEMENT === 2 ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT, "indices");
        texture(table, 4, 2, gl.RGBA32F, gl.RGBA, gl.FLOAT, "lights");
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "matrix"), false, new Float32Array(matrix.elements));
        gl.uniform1ui(gl.getUniformLocation(program, "textureWidth"), width);
        checkError(gl, "input upload");
        const output = gl.createBuffer();
        buffers.push(output);
        gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, output);
        gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, count * 4, gl.STREAM_READ);
        feedback = gl.createTransformFeedback();
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, feedback);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, output);
        gl.enable(gl.RASTERIZER_DISCARD);
        gl.beginTransformFeedback(gl.POINTS);
        gl.drawArrays(gl.POINTS, 0, count);
        gl.endTransformFeedback();
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
        gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null);
        gl.disable(gl.RASTERIZER_DISCARD);
        checkError(gl, "transform feedback");
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        if (!sync) {
            if (gl.isContextLost()) return null;
            throw new Error(`Static lighting fence creation failed.`);
        }
        storeJob(renderer, geometry, target, output, sync, matrix, table);
        buffers.pop();
        gl.flush();
        return null;
    } finally {
        gl.disable(gl.RASTERIZER_DISCARD);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
        gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null);
        gl.bindVertexArray(null);
        for (const buffer of buffers) gl.deleteBuffer(buffer);
        for (const texture of textures) gl.deleteTexture(texture);
        if (feedback) gl.deleteTransformFeedback(feedback);
        if (vao) gl.deleteVertexArray(vao);
        renderer.resetState();
        renderer.setRenderTarget(renderTarget, cubeFace, mipLevel);
    }
}
