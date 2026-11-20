import { ShaderChunk } from "three";
import Chunk_L2FogFragment from "./l2_fog_fragment.glsl";
import Chunk_ActorLight from "./actor_light.glsl";
import Chunk_ProjectorFragment from "./projector_fragment.glsl";
import Chunk_ProjectorReceiver from "./projector_receiver.glsl";
import Chunk_SkillLight from "./skill_light.glsl";
import Chunk_StaticMeshLodVertex from "./static_mesh_lod_vertex.glsl";
import Chunk_StaticMeshLodFragment from "./static_mesh_lod_fragment.glsl";

const chunks = ShaderChunk as Record<string, string>;

chunks.static_mesh_lod_vertex = Chunk_StaticMeshLodVertex;
chunks.static_mesh_lod_fragment = Chunk_StaticMeshLodFragment;
chunks.l2_fog_fragment = chunks.l2_fog_fragment ?? Chunk_L2FogFragment;
chunks.actor_light = chunks.actor_light ?? Chunk_ActorLight;
chunks.projector_fragment = chunks.projector_fragment ?? Chunk_ProjectorFragment;
chunks.projector_receiver = chunks.projector_receiver ?? Chunk_ProjectorReceiver;
chunks.skill_light = chunks.skill_light ?? Chunk_SkillLight;

export function resolveShaderIncludes(source: string): string {
    return source.replace(/^[ \t]*#include +<([\w\d./]+)>/gm, (_match, name) => {
        const chunk = chunks[name];

        if (chunk === undefined) throw new Error(`Cannot resolve shader include '${name}'.`);

        return resolveShaderIncludes(chunk);
    });
}
