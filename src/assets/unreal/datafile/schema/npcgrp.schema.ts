import { BufferValue } from "@l2js/core";
import { NumberContainerType, UTF16ContainerType } from "@client/assets/unreal/datafile/schema/dat-container";

const SCHEMA_NPCGRP_DAT: ISchemaValue[] = [
    { type: "uint32", name: "tag" },
    { type: "utf16", name: "class" },
    { type: "utf16", name: "mesh" },
    { type: new UTF16ContainerType(), name: "tex1" },
    { type: new UTF16ContainerType(), name: "tex2" },
    { type: new NumberContainerType(BufferValue.uint32), name: "dtab" },
    { type: "float", name: "npc_speed" },
    { type: "uint32", name: "UNK0" },
    { type: new UTF16ContainerType(), name: "sound1" },
    { type: new UTF16ContainerType(), name: "sound2" },
    { type: new UTF16ContainerType(), name: "sound3" },
    { type: "uint32", name: "UNK1" },
    { type: new NumberContainerType(BufferValue.uint32), name: "UNK2" },
    { type: "uint32", name: "levelLimLo" },
    { type: "uint32", name: "levelLimHi" },
    { type: "utf16", name: "effect" },
    { type: "uint32", name: "UNK3" },
    { type: "float", name: "soundRadius" },
    { type: "float", name: "soundVolume" },
    { type: "float", name: "soundRandom" },
    { type: "uint32", name: "quest" },
    { type: "uint32", name: "classLim" }
];

export default SCHEMA_NPCGRP_DAT;
export { SCHEMA_NPCGRP_DAT };
