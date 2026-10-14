import { ShaderChunk } from "three";
import Chunk_L2FogFragment from "./l2_fog_fragment.glsl";
import Chunk_ActorLight from "./actor_light.glsl";

ShaderChunk.l2_fog_fragment = ShaderChunk.l2_fog_fragment ?? Chunk_L2FogFragment;
ShaderChunk.actor_light = ShaderChunk.actor_light ?? Chunk_ActorLight;

export function resolveShaderIncludes(source: string): string {
    return source.replace(/^[ \t]*#include +<([\w\d./]+)>/gm, (_match, name) => {
        const chunk = ShaderChunk[name];

        if (chunk === undefined) throw new Error(`Cannot resolve shader include '${name}'.`);

        return resolveShaderIncludes(chunk);
    });
}
