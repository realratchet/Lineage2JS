import startCore from "@client/core";
import type BaseActor from "@client/base-actor";
import { Vector3 } from "three";

const NPC_TIMEOUT_MS = 240_000;
const RENDER_FRAMES = 3;
const ENTER_ANIMATION_TIMEOUT_MS = 30_000;
const NPC_PRIORITY_NAMES = ["anakim", "baium", "valakas"];
const tmpSpawnPosition = new Vector3();

type NpcTestPhase_T = "spawn" | "render" | "remove";

type NpcReport_T = {
    id?: number;
    name?: string;
    className?: string;
    mesh?: string;
    selector?: string | number;
    index?: number;
    total?: number;
    ok?: boolean;
    phase?: NpcTestPhase_T;
    error?: string;
    stack?: string;
    errors?: string[];
    warnings?: string[];
    enterEvent?: GD.INpcEnterEvent;
    ms?: number;
    done?: boolean;
    note?: string;
};

async function report(data: NpcReport_T): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const response = await fetch("/npc-test/report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });

            if (response.ok) return;

            console.warn(`[npc-test] report rejected (${response.status}), retrying`);
        } catch (e) {
            console.warn("[npc-test] failed to post report, retrying:", e);
        }

        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
}

function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms: ${what}`)), ms);

        promise.then(
            value => { clearTimeout(timer); resolve(value); },
            error => { clearTimeout(timer); reject(error); }
        );
    });
}

function continueFrom(index: number): void {
    const params = new URLSearchParams(location.search);

    params.set("start", `${index}`);
    location.search = params.toString();
}

async function waitForRenderFrames(): Promise<void> {
    for (let i = 0; i < RENDER_FRAMES; i++)
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

async function waitForEnterAnimation(pawn: BaseActor, animationName: string): Promise<void> {
    if (!pawn.isPlayingOneShotAnimation(animationName)) throw new Error(`enter animation '${animationName}' did not start.`);

    const deadline = performance.now() + ENTER_ANIMATION_TIMEOUT_MS;

    while (pawn.isPlayingOneShotAnimation(animationName)) {
        if (performance.now() >= deadline) throw new Error(`enter animation '${animationName}' did not finish after ${ENTER_ANIMATION_TIMEOUT_MS}ms.`);

        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }
}

function getPriority(npc: GD.INpcDefinition): number {
    const name = npc.name.trim().toLowerCase();
    const index = NPC_PRIORITY_NAMES.findIndex(priority => name.includes(priority));

    return index < 0 ? NPC_PRIORITY_NAMES.length : index;
}

async function runNpcTest(): Promise<void> {
    const params = new URLSearchParams(location.search);
    const start = parseInt(params.get("start") ?? "0", 10) || 0;
    const only = params.get("only")?.split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
    const renderManager = await startCore(false);

    if (!renderManager) throw new Error("NPC test cannot run in sector precache mode.");

    let npcs = await renderManager.listNpcs();

    npcs = npcs.slice().sort((a, b) => getPriority(a) - getPriority(b) || a.id - b.id);

    const nameCounts = new Map<string, number>();

    for (const npc of npcs) {
        const name = npc.name.trim().toLowerCase();

        if (name) nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
    }

    if (only) npcs = npcs.filter(npc => only.includes(`${npc.id}`) || only.includes(npc.name.trim().toLowerCase()));

    if (start === 0) await report({ note: `sweep started: ${npcs.length} NPCs` });

    const errors: string[] = [];
    const warnings: string[] = [];
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    console.error = (...args: any[]) => {
        errors.push(args.map(value => value instanceof Error ? value.message : String(value)).join(" ").slice(0, 400));
        originalConsoleError.apply(console, args);
    };

    console.warn = (...args: any[]) => {
        warnings.push(args.map(value => value instanceof Error ? value.message : String(value)).join(" ").slice(0, 400));
        originalConsoleWarn.apply(console, args);
    };

    window.addEventListener("error", event => errors.push(event.error?.message || event.message));
    window.addEventListener("unhandledrejection", event => errors.push(event.reason?.message || String(event.reason)));

    tmpSpawnPosition.copy(renderManager.player.position);
    tmpSpawnPosition.x += 200;

    for (let i = start; i < npcs.length; i++) {
        const npc = npcs[i];
        const normalizedName = npc.name.trim().toLowerCase();
        const selector = normalizedName && nameCounts.get(normalizedName) === 1 ? npc.name : npc.id;
        const startTime = performance.now();
        let phase: NpcTestPhase_T = "spawn";
        let pawn: BaseActor = null;

        document.title = `npc-test: ${i + 1}/${npcs.length} ${npc.id} ${npc.name}`;
        console.log(`[npc-test] ${i + 1}/${npcs.length} '${npc.name}' (${npc.id})`);
        errors.length = 0;
        warnings.length = 0;

        try {
            pawn = await withTimeout(renderManager.spawnNpc(selector, tmpSpawnPosition), NPC_TIMEOUT_MS, `spawn '${npc.name}' (${npc.id})`);
            phase = "render";

            if (npc.enterEvent?.animation && npc.enterEvent.animation.toLowerCase() !== "none") await waitForEnterAnimation(pawn, npc.enterEvent.animation);
            else await waitForRenderFrames();

            phase = "remove";
            renderManager.removePawn(pawn);
            pawn = null;

            if (errors.length > 0)
                throw new Error(`console errors: ${errors.slice(0, 3).join(" | ")}`);

            await report({ id: npc.id, name: npc.name, className: npc.className, mesh: npc.mesh, selector, index: i, total: npcs.length, ok: true, enterEvent: npc.enterEvent, warnings: warnings.slice(0, 10), ms: Math.round(performance.now() - startTime) });
        } catch (e) {
            const error = e as Error;

            if (pawn) renderManager.removePawn(pawn);

            await report({
                id: npc.id, name: npc.name, className: npc.className, mesh: npc.mesh, selector, index: i, total: npcs.length, ok: false, phase, enterEvent: npc.enterEvent,
                error: error?.message ?? String(e), stack: error?.stack, errors: errors.slice(0, 10), warnings: warnings.slice(0, 10),
                ms: Math.round(performance.now() - startTime)
            });

            await report({ note: `failed at '${npc.name}' (${npc.id}), restarting sweep at index ${i + 1}` });
            continueFrom(i + 1);
            return;
        }
    }

    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;

    await report({ done: true, total: npcs.length });
    document.title = "npc-test: done";
    console.log("[npc-test] done");
}

export default runNpcTest;
export { runNpcTest };
