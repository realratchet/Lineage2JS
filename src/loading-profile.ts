type LoadingProfile_T = { name: string, worker: string, queued: number, started: number, finished: number, active: string, packages: { kind: string, name: string }[], steps: Record<string, { ms: number, count: number }>, reported: boolean };

const active = new Map<number, LoadingProfile_T>();
const completed: LoadingProfile_T[] = [];
let nextId = 1;
let stepHandler: (id: number, kind: string, name: string, start: number, elapsed: number) => void = null;
let nextStepId = 1;

function now(): number { return performance.timeOrigin + performance.now(); }
function finishEmptyStep(): void { }

export function startLoadingStep(kind: string, name: string): () => void {
    if (!stepHandler) return finishEmptyStep;

    const handler = stepHandler, id = nextStepId++, start = now();

    handler(id, kind, name, start, -1);
    return function () { handler(id, kind, name, start, now() - start); };
}

export function setLoadingStepHandler(handler: typeof stepHandler): void { stepHandler = handler; }

export function beginLoadingProfile(name: string, worker: string): number {
    const id = nextId++;

    active.set(id, { name, worker, queued: now(), started: 0, finished: 0, active: "Queued", packages: [], steps: {}, reported: false });
    return id;
}

export function assignLoadingProfile(id: number, worker: string): void {
    const row = active.get(id);
    if (row) row.worker = worker;
}

export function updateLoadingProfile(id: number, started: number, detail: string, steps: LoadingProfile_T["steps"], packages: LoadingProfile_T["packages"] = []): void {
    const row = active.get(id);
    if (!row) return;

    row.started = started;
    row.active = detail;
    row.steps = steps;
    row.packages = packages;
}

export function finishLoadingProfile(id: number): void {
    const row = active.get(id);
    if (!row) return;

    row.finished = now();
    row.active = "Done";
    active.delete(id);
    completed.push(row);
    if (completed.length > 200) completed.shift();
}

export function getLoadingDetail(): string {
    const stages = ["read", "cache", "convert", "load", "dependencies", "queued"];
    const labels = ["Fetching", "Saving", "Building", "Loading", "Preparing", "Queued"];
    const packages = new Map<string, number>();
    const counts = stages.map(() => 0);

    for (const row of active.values()) {
        const path = row.name.match(/^precachePackage (.+)$/)?.[1];
        if (path) packages.set(path.replace(/^\/?assets\//i, "").toLowerCase(), 5);
    }
    for (const row of active.values()) for (const step of row.packages) {
        if (!/\.(u|unr|utx|ukx|uax|usx|usk)$/i.test(step.name)) continue;
        const stage = stages.indexOf(step.kind === "build" ? "convert" : step.kind), path = step.name.replace(/^\/?assets\//i, "").toLowerCase();

        if (stage >= 0 && (!packages.has(path) || stage < packages.get(path))) packages.set(path, stage);
    }
    for (const stage of packages.values()) counts[stage]++;

    return [0, 2, 1, 3, 4, 5].filter(stage => counts[stage]).map(stage => `${labels[stage]} ${counts[stage]}`).join(", ");
}

function getLoadingLock(row: LoadingProfile_T): string {
    const locks = Object.entries(row.steps).filter(([kind]) => kind.startsWith("lock:")).sort((a, b) => b[1].ms - a[1].ms);
    if (!locks.length) return "";
    return `${locks[0][0].slice(5).replace(/^(package-conversion:)[^:]+:/, "$1")} (${(locks[0][1].ms / 1000).toFixed(2)}s)`;
}

export function printLoadingProfile(sinceLast: boolean = false): LoadingProfile_T[] {
    const rows = [...completed, ...active.values()];
    const visible = rows.filter(row => !sinceLast || !row.reported).sort((a, b) => (b.finished || now()) - b.queued - ((a.finished || now()) - a.queued));

    console.groupCollapsed(`[loading] ${visible.length} tasks · queue, work and phase timings`);
    console.table(visible.slice(0, 30).map(row => ({ task: row.name, worker: row.worker, state: row.active, queue_s: row.started ? +((row.started - row.queued) / 1000).toFixed(2) : +((now() - row.queued) / 1000).toFixed(2), work_s: row.started ? +(((row.finished || now()) - row.started) / 1000).toFixed(2) : 0, dependencies_s: +((row.steps.dependencies?.ms || 0) / 1000).toFixed(2), read_s: +((row.steps.read?.ms || 0) / 1000).toFixed(2), convert_s: +((row.steps.convert?.ms || 0) / 1000).toFixed(2), cache_s: +((row.steps.cache?.ms || 0) / 1000).toFixed(2), lock_wait_s: +((row.steps.lock?.ms || 0) / 1000).toFixed(2), top_lock: getLoadingLock(row) })));
    console.log(`[loading] Phase times overlap; loadingProfile() returns the last 200 completed tasks and all pending tasks.`);
    console.groupEnd();

    for (const row of visible) if (row.finished) row.reported = true;
    return rows;
}

if (typeof document !== "undefined") (globalThis as any).loadingProfile = printLoadingProfile;
