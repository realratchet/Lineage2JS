import { BufferGeometry, Matrix4, WebGLRenderer } from "three";
import DynamicLight from "../objects/dynamic-light";
import VERTEX_SOURCE from "../materials/mesh-static-material/shader/static-lighting.vs";
import { resolveShaderIncludes } from "../materials/shader-chunks/register-chunks";

const VERTEX_SHADER = resolveShaderIncludes(VERTEX_SOURCE);
const FRAGMENT_SHADER = "#version 300 es\nprecision highp float;out vec4 color;void main(){color=vec4(0.0);}";

type LightEntry_T = { flags: Uint8Array, vertexRangeStart?: number, vertexRangeEnd?: number, flagsOffset?: number, instance?: DynamicLight };

export function computeStaticLighting(renderer: WebGLRenderer, geometry: BufferGeometry, matrix: Matrix4, lights: LightEntry_T[], glow: Float32Array, target: Uint8ClampedArray, prepared: { offsets: Uint32Array, indices: Uint16Array | Uint32Array }): boolean {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    if (gl.isContextLost()) return false;

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

    const maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE), width = Math.min(4096, maxSize);
    if (Math.max(offsets.length, indices.length, table.length / 4) > width * maxSize) return false;

    const buffers: WebGLBuffer[] = [], textures: WebGLTexture[] = [], shaders: WebGLShader[] = [];
    const renderTarget = renderer.getRenderTarget(), cubeFace = renderer.getActiveCubeFace(), mipLevel = renderer.getActiveMipmapLevel();
    let program: WebGLProgram, vao: WebGLVertexArrayObject, feedback: WebGLTransformFeedback;

    function shader(type: number, source: string): WebGLShader {
        const shader = gl.createShader(type);
        shaders.push(shader);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
        return shader;
    }

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
        program = gl.createProgram();
        gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX_SHADER));
        gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
        gl.transformFeedbackVaryings(program, ["packedLighting"], gl.INTERLEAVED_ATTRIBS);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
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
        gl.disable(gl.RASTERIZER_DISCARD);
        const values = new Uint32Array(count);
        // shortcut: read back while ambient and changing lights still update the CPU color buffer.
        gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, 0, values);
        if (gl.isContextLost()) return false;
        const error = gl.getError();
        if (error !== gl.NO_ERROR) throw new Error(`Static lighting GL error ${error}.`);
        for (let i = 0; i < count; i++) {
            target[i * 3] = values[i] & 255;
            target[i * 3 + 1] = (values[i] >>> 8) & 255;
            target[i * 3 + 2] = (values[i] >>> 16) & 255;
        }
        return true;
    } finally {
        gl.disable(gl.RASTERIZER_DISCARD);
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
        gl.bindVertexArray(null);
        for (const buffer of buffers) gl.deleteBuffer(buffer);
        for (const texture of textures) gl.deleteTexture(texture);
        for (const shader of shaders) gl.deleteShader(shader);
        if (feedback) gl.deleteTransformFeedback(feedback);
        if (vao) gl.deleteVertexArray(vao);
        if (program) gl.deleteProgram(program);
        renderer.resetState();
        renderer.setRenderTarget(renderTarget, cubeFace, mipLevel);
    }
}
