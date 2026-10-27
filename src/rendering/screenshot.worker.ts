import encodeScreenshot from "./screenshot-encoder";

self.onmessage = ({ data }) => {
    self.postMessage(encodeScreenshot(data.image, data.quality));
};
