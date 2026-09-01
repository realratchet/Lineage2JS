import type { ISchemaValue } from "./dat-schema";
import { UTF16SizedContainerType } from "./dat-container";

const CHARGRP_RECORD_COUNT = 15; // L2FileEdit C4/chargrp.ddf RECCNT.

const SCHEMA_CHARGRP_DAT: ISchemaValue[] = [
    { type: "utf16", name: "face_icon" },
    { type: "uint32", name: "cnt_hm" },
    { type: "uint32", name: "cnt_ht" },
    { type: "uint32", name: "cnt_fm" },
    { type: "uint32", name: "cnt_ft" },
    { type: new UTF16SizedContainerType("cnt_hm"), name: "hair_mesh" },
    { type: new UTF16SizedContainerType("cnt_ht"), name: "hair_tex" },
    { type: new UTF16SizedContainerType("cnt_fm"), name: "face_mesh" },
    { type: new UTF16SizedContainerType("cnt_ft"), name: "face_tex" },
    { type: new UTF16SizedContainerType(4), name: "body_mesh" },
    { type: new UTF16SizedContainerType(4), name: "body_tex" },
    { type: "utf16", name: "attack_eff" },
    { type: "uint32", name: "walkanimframe" },
    { type: "uint32", name: "cnt_att" },
    { type: "uint32", name: "cnt_def" },
    { type: "uint32", name: "cnt_dmg" },
    { type: new UTF16SizedContainerType("cnt_att"), name: "snd_att" },
    { type: new UTF16SizedContainerType("cnt_def"), name: "snd_def" },
    { type: new UTF16SizedContainerType("cnt_dmg"), name: "snd_dmg" },
    { type: "uint32", name: "cnth" },
    { type: new UTF16SizedContainerType("cnth"), name: "voice_snd_hand" },
    { type: "uint32", name: "cnt1h" },
    { type: new UTF16SizedContainerType("cnt1h"), name: "voice_snd_1hs" },
    { type: "uint32", name: "cnt2h" },
    { type: new UTF16SizedContainerType("cnt2h"), name: "voice_snd_2hs" },
    { type: "uint32", name: "cntd" },
    { type: new UTF16SizedContainerType("cntd"), name: "voice_snd_dual" },
    { type: "uint32", name: "cntp" },
    { type: new UTF16SizedContainerType("cntp"), name: "voice_snd_pole" },
    { type: "uint32", name: "cntb" },
    { type: new UTF16SizedContainerType("cntb"), name: "voice_snd_bow" },
    { type: "uint32", name: "cntu" },
    { type: new UTF16SizedContainerType("cntu"), name: "voice_snd_unknown" },
    { type: "uint32", name: "cntf" },
    { type: new UTF16SizedContainerType("cntf"), name: "voice_snd_fist" }
];

export default SCHEMA_CHARGRP_DAT;
export { CHARGRP_RECORD_COUNT, SCHEMA_CHARGRP_DAT };
