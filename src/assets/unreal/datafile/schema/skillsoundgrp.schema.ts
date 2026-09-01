import type { ISchemaValue } from "./dat-schema";
const SCHEMA_SKILLSOUNDGRP_DAT: ISchemaValue[] = [
    { type: "uint32", name: "skill_id" },
    { type: "uint32", name: "skill_level" }
];

for (const effect of ["spelleffect", "shoteffect", "expeffect"]) {
    for (let i = 1; i <= 3; i++)
        SCHEMA_SKILLSOUNDGRP_DAT.push({ type: "utf16", name: `${effect}_sound_${i}` });

    for (let i = 1; i <= 3; i++) {
        SCHEMA_SKILLSOUNDGRP_DAT.push({ type: "float", name: `${effect}_sound_vol_${i}` });
        SCHEMA_SKILLSOUNDGRP_DAT.push({ type: "float", name: `${effect}_sound_rad_${i}` });
    }
}

const characterGroups = ["mfighter", "ffighter", "mdarkelf", "fdarkelf", "mdwarf", "fdwarf", "melf", "felf", "mmagic", "fmagic", "morc", "forc", "mshaman", "fshaman", "RESERVED"];

for (const characterGroup of characterGroups)
    SCHEMA_SKILLSOUNDGRP_DAT.push({ type: "utf16", name: `${characterGroup}_sub${characterGroup === "RESERVED" ? "_?" : ""}` });

for (const characterGroup of characterGroups)
    SCHEMA_SKILLSOUNDGRP_DAT.push({ type: "utf16", name: `${characterGroup}_throw${characterGroup === "RESERVED" ? "_?" : ""}` });

SCHEMA_SKILLSOUNDGRP_DAT.push(
    { type: "float", name: "sound_vol" },
    { type: "float", name: "sound_rad" }
);

export default SCHEMA_SKILLSOUNDGRP_DAT;
export { SCHEMA_SKILLSOUNDGRP_DAT };
