import extensions from "./asset-extensions.json";

export const packageFile = new RegExp("\\.(" + extensions.packages.join("|") + ")$", "i");
export const supportedAssetExtensions = [...extensions.packages, ...extensions.audio];
