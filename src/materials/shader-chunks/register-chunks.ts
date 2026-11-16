import { ShaderChunk } from "three";
import Chunk_L2FogFragment from "./l2_fog_fragment.glsl";
import Chunk_ActorLight from "./actor_light.glsl";
import Chunk_ProjectorReceiver from "./projector_receiver.glsl";

const chunks = ShaderChunk as Record<string, string>;

chunks.l2_fog_fragment = chunks.l2_fog_fragment ?? Chunk_L2FogFragment;
chunks.actor_light = chunks.actor_light ?? Chunk_ActorLight;
chunks.projector_receiver = chunks.projector_receiver ?? Chunk_ProjectorReceiver;

export function resolveShaderIncludes(source: string): string {
    return source.replace(/^[ \t]*#include +<([\w\d./]+)>/gm, (_match, name) => {
        const chunk = chunks[name];

        if (chunk === undefined) throw new Error(`Cannot resolve shader include '${name}'.`);

        return resolveShaderIncludes(chunk);
    });
}
