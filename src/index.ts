import "../style/style.scss";
import startCore from "./core";
import runSkillViewer from "./skill-viewer/skill-viewer";

const params = new URLSearchParams(location.search);

if (params.has("skillViewer")) runSkillViewer(params.get("skillViewer") === "player");
else startCore();
