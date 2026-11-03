type WebLockState_T<T> = { callback: (lock: Lock) => Promise<T>, result: T, error: any, failed: boolean };

function createLockCallback<T>(state: WebLockState_T<T>): (lock: Lock) => Promise<void> {
    return async function (lock: Lock) {
        try {
            state.result = await state.callback(lock);
        } catch (error) {
            state.failed = true;
            state.error = error;
        }
    };
}

async function requestWebLock<T>(name: string, callback: (lock: Lock) => Promise<T>, options: LockOptions = {}): Promise<T> {
    const state: WebLockState_T<T> = { callback, result: undefined, error: undefined, failed: false };

    try {
        // Firefox 159 retains completed worker lock callbacks and their results.
        await navigator.locks.request(name, options, createLockCallback(state));
        if (state.failed) throw state.error;
        return state.result;
    } finally {
        state.callback = null;
        state.result = undefined;
        state.error = undefined;
    }
}

export default requestWebLock;
