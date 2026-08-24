import "../style/style.scss";
import startCore from "./core";
import runNpcTest from "./npc-test";
import runSectorTest from "./sector-test";

const params = new URLSearchParams(location.search);

if (params.has("npcTest")) runNpcTest();
else if (params.has("sectorTest")) runSectorTest();
else startCore();
