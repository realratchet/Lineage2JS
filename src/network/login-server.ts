declare const DEFAULT_LOGIN_SERVER: string;

const params = new URLSearchParams(location.search);
const loginServer = params.has("login") ? params.get("login") || `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:3106/` : DEFAULT_LOGIN_SERVER;

export default loginServer;
