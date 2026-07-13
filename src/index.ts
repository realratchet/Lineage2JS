import "../style/style.scss";
import startCore from "./core";
import runSectorTest from "./sector-test";

if (new URLSearchParams(location.search).has("sectorTest")) runSectorTest();
else startCore();
