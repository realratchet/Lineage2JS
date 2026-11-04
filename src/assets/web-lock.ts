import { startLoadingStep } from "../loading-profile";

type WebLockState_T<T> = { callback: (lock: Lock) => Promise<T>, result: T, error: any, failed: boolean, finishWait(): void };

function createLockCallback<T>(state: WebLockState_T<T>): (lock: Lock) => Promise<void> {
    return async function (lock: Lock) {
        state.finishWait();
        state.finishWait = null;
        try {
            state.result = await state.callback(lock);
        } catch (error) {
            state.failed = true;
            state.error = error;
        }
    };
}

async function requestWebLock<T>(name: string, callback: (lock: Lock) => Promise<T>, options: LockOptions = {}): Promise<T> {
    const state: WebLockState_T<T> = { callback, result: undefined, error: undefined, failed: false, finishWait: startLoadingStep("lock", name) };

    try {
        // Firefox 159 retains completed worker lock callbacks and their results.
        await navigator.locks.request(name, options, createLockCallback(state));
        if (state.failed) throw state.error;
        return state.result;
    } finally {
        if (state.finishWait) state.finishWait();
        state.finishWait = null;
        state.callback = null;
        state.result = undefined;
        state.error = undefined;
    }
}

export default requestWebLock;
