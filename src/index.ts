import "../style/style.scss";
import startCore from "./core";
import runNpcTest from "../tools/npc-test";
import runSectorTest from "../tools/sector-test";
import runSkillViewer from "./skill-viewer/skill-viewer";

const params = new URLSearchParams(location.search);

if (params.has("npcTest")) runNpcTest();
else if (params.has("sectorTest")) runSectorTest();
else if (params.has("skillViewer")) runSkillViewer(params.get("skillViewer") === "player");
else startCore();
