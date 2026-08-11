function getNpcBundleName(packageName: string): string {
    const name = packageName.toLowerCase();

    if (name === "lineagemonsters" || name === "lineagemonsters2") return "npc_monsters";
    if (name === "lineagenpcs" || name === "lineagedecos") return "npc_npcs";

    throw new Error(`NPC mesh package '${packageName}' has no bundle.`);
}

function isNpcMeshPackage(packageName: string): boolean {
    const name = packageName.toLowerCase();

    return name === "lineagemonsters" || name === "lineagemonsters2" || name === "lineagenpcs" || name === "lineagedecos";
}

export default getNpcBundleName;
export { getNpcBundleName, isNpcMeshPackage };
