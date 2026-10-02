interface IResponseTyped<T> extends Response {
    json(): Promise<T>;
}

export function fetchTyped<T>(request: RequestInfo): Promise<IResponseTyped<T>> {
    return fetch(request);
}

export default fetchTyped;