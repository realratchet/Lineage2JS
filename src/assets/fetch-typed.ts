interface IResponseTyped<T> extends Response {
    json(): Promise<T>;
}

function fetchTyped<T>(request: RequestInfo): Promise<IResponseTyped<T>> {
    return fetch(request);
}

export default fetchTyped;
export { fetchTyped };