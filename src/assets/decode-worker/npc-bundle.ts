const npcBundles = new Map<string, string>([
    ["lineagemonsters", "npc_monsters"],
    ["lineagemonsters2", "npc_monsters"],
    ["lineagenpcs", "npc_npcs"],
    ["lineagedecos", "npc_npcs"],
    ["dropitems", "npc_npcs"]
]);

export function getNpcBundleName(packageName: string): string {
    const bundle = npcBundles.get(packageName.toLowerCase());

    if (!bundle) throw new Error(`NPC mesh package '${packageName}' has no bundle.`);
    return bundle;
}

export function isNpcMeshPackage(packageName: string): boolean {
    return npcBundles.has(packageName.toLowerCase());
}

export default getNpcBundleName;
