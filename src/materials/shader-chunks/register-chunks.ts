import { ShaderChunk } from "three";
import Chunk_L2FogFragment from "./l2_fog_fragment.glsl";

ShaderChunk.l2_fog_fragment = ShaderChunk.l2_fog_fragment ?? Chunk_L2FogFragment;