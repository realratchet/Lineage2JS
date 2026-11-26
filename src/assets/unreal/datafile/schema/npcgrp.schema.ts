import type { ISchemaValue } from "./dat-schema";
import { BufferValue } from "@l2js/core";
import { NumberContainerType, UTF16ContainerType } from "./dat-container";

export const SCHEMA_NPCGRP_DAT: ISchemaValue[] = [
    { type: "uint32", name: "tag" },
    { type: "utf16", name: "class" },
    { type: "utf16", name: "mesh" },
    { type: new UTF16ContainerType(), name: "tex1" },
    { type: new UTF16ContainerType(), name: "tex2" },
    { type: new NumberContainerType(BufferValue.uint32), name: "dtab" },
    { type: "float", name: "npc_speed" },
    { type: "uint32", name: "has_silhouette" },
    { type: new UTF16ContainerType(), name: "sound1" },
    { type: new UTF16ContainerType(), name: "sound2" },
    { type: new UTF16ContainerType(), name: "sound3" },
    { type: "uint32", name: "quest_be" },
    { type: new NumberContainerType(BufferValue.uint32), name: "class_limit" },
    { type: "uint32", name: "levelLimLo" },
    { type: "uint32", name: "levelLimHi" },
    { type: "utf16", name: "effect" },
    { type: "uint32", name: "walkanimframe" },
    { type: "float", name: "soundRadius" },
    { type: "float", name: "soundVolume" },
    { type: "float", name: "soundRandom" },
    { type: "uint32", name: "social" },
    { type: "uint32", name: "hpshowable" } // Engine.dll NpcDataLoad 0x73238a, serialize 0x718e60: last two dwords are social, hpshowable.
];

export default SCHEMA_NPCGRP_DAT;
