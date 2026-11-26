import type { ISchemaValue } from "./dat-schema";

export const SCHEMA_SKILLSOUNDGRP_DAT: ISchemaValue[] = [
    { type: "uint32", name: "skill_id" },
    { type: "uint32", name: "skill_level" }
];

// Engine.dll 0x70afad..0x70b032 serializes cast/shot/explosion per slot.
for (let i = 1; i <= 3; i++) {
    for (const effect of ["spelleffect", "shoteffect", "expeffect"])
        SCHEMA_SKILLSOUNDGRP_DAT.push({ type: "utf16", name: `${effect}_sound_${i}` });

    for (const effect of ["spelleffect", "shoteffect", "expeffect"]) {
        SCHEMA_SKILLSOUNDGRP_DAT.push({ type: "float", name: `${effect}_sound_vol_${i}` });
        SCHEMA_SKILLSOUNDGRP_DAT.push({ type: "float", name: `${effect}_sound_rad_${i}` });
    }
}

const characterGroups = ["mfighter", "ffighter", "mdarkelf", "fdarkelf", "mdwarf", "fdwarf", "melf", "felf", "mmagic", "fmagic", "morc", "forc", "mshaman", "fshaman", "reserved"];

for (const characterGroup of characterGroups)
    SCHEMA_SKILLSOUNDGRP_DAT.push({ type: "utf16", name: `${characterGroup}_cast` });

for (const characterGroup of characterGroups)
    SCHEMA_SKILLSOUNDGRP_DAT.push({ type: "utf16", name: `${characterGroup}_magic` });

SCHEMA_SKILLSOUNDGRP_DAT.push(
    { type: "float", name: "cast_volume" },
    { type: "float", name: "cast_rad" }
);

export default SCHEMA_SKILLSOUNDGRP_DAT;
