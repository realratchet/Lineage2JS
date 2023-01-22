import BufferValue from "@client/assets/buffer-value";
import { NumberContainerType, UTF16ContainerType } from "./dat-container";

const SCHEMA_NPCGRP_DAT = [
    { type: BufferValue.uint32, name: "tag" },
    { type: BufferValue.utf16, name: "class" },
    { type: BufferValue.utf16, name: "mesh" },
    { type: new UTF16ContainerType(), name: "tex1" },
    { type: new UTF16ContainerType(), name: "tex2" },
    { type: new NumberContainerType(BufferValue.uint32), name: "dtab" },
    { type: BufferValue.float, name: "npc_speed" },
    { type: BufferValue.uint32, name: "UNK0" },
    { type: new UTF16ContainerType(), name: "sound1" },
    { type: new UTF16ContainerType(), name: "sound2" },
    { type: new UTF16ContainerType(), name: "sound3" },
    { type: BufferValue.uint32, name: "UNK1" },
    { type: new NumberContainerType(BufferValue.uint32), name: "UNK2" },
    { type: BufferValue.uint32, name: "levelLimLo" },
    { type: BufferValue.uint32, name: "levelLimHi" },
    { type: BufferValue.utf16, name: "effect" },
    { type: BufferValue.uint32, name: "UNK3" },
    { type: BufferValue.float, name: "soundRadius" },
    { type: BufferValue.float, name: "soundVolume" },
    { type: BufferValue.float, name: "soundRandom" },
    { type: BufferValue.uint32, name: "quest" },
    { type: BufferValue.uint32, name: "classLim" }
] as ISchemaValue[];

export default SCHEMA_NPCGRP_DAT;
export { SCHEMA_NPCGRP_DAT };