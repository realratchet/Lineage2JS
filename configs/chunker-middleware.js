const fs = require("fs");
const path = require("path");

module.exports.initChunkerMiddleware = function (dirAssets) {
    return {
        name: "assets-chunker",
        path: "/assets",
        middleware: (req, res, next) => {
            if (req.method !== "GET" && req.method !== "HEAD") {
                return next();
            }
            const relPath = decodeURIComponent(req.path);
            const filePath = path.join(path.resolve(__dirname, "../", dirAssets), relPath);

            fs.stat(filePath, (err, stats) => {
                if (err || !stats.isFile()) {
                    return next();
                }

                const fileSize = stats.size;
                const range = req.headers.range;
                let start = 0;
                let end = fileSize - 1;
                let isRange = false;

                if (range) {
                    const parts = range.replace(/bytes=/, "").split("-");
                    const startPart = parts[0];
                    const endPart = parts[1];

                    if (startPart !== "") {
                        start = parseInt(startPart, 10);
                        if (endPart !== "") {
                            end = parseInt(endPart, 10);
                        }
                    } else if (endPart !== "") {
                        start = fileSize - parseInt(endPart, 10);
                    }

                    isRange = true;
                }

                if (start < 0) start = 0;
                if (end >= fileSize) end = fileSize - 1;

                if (start > end) {
                    res.statusCode = 416;
                    res.setHeader("Content-Range", `bytes */${fileSize}`);
                    res.end();
                    return;
                }

                const contentLength = end - start + 1;
                const ext = path.extname(filePath).toLowerCase();
                let contentType = "application/octet-stream";
                if (ext === ".html" || ext === ".htm") contentType = "text/html";
                else if (ext === ".js") contentType = "application/javascript";
                else if (ext === ".css") contentType = "text/css";
                else if (ext === ".json") contentType = "application/json";
                else if (ext === ".png") contentType = "image/png";
                else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
                else if (ext === ".gif") contentType = "image/gif";
                else if (ext === ".svg") contentType = "image/svg+xml";

                res.setHeader("Accept-Ranges", "bytes");
                res.setHeader("Content-Type", contentType);
                res.setHeader("Cache-Control", "public, max-age=0");

                if (isRange) {
                    res.statusCode = 206;
                    res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
                    res.setHeader("Content-Length", contentLength);
                } else {
                    res.statusCode = 200;
                    res.setHeader("Content-Length", fileSize);
                }

                if (req.method === "HEAD") {
                    res.end();
                    return;
                }

                fs.open(filePath, "r", (openErr, fd) => {
                    if (openErr) {
                        res.statusCode = 500;
                        res.end("Internal Server Error");
                        return;
                    }

                    const CHUNK_SIZE = 4096;
                    let offset = start;
                    let isClosed = false;
                    let fdClosed = false;

                    const closeFd = () => {
                        if (!fdClosed) {
                            fdClosed = true;
                            fs.close(fd, () => { });
                        }
                    };

                    res.on("close", () => {
                        isClosed = true;
                        closeFd();
                    });

                    const sendNextChunk = () => {
                        if (isClosed) {
                            closeFd();
                            return;
                        }

                        if (offset > end) {
                            closeFd();
                            res.end();
                            return;
                        }

                        const currentChunkSize = Math.min(CHUNK_SIZE, end - offset + 1);
                        const buffer = Buffer.alloc(currentChunkSize);

                        fs.read(fd, buffer, 0, currentChunkSize, offset, (readErr, bytesRead, buf) => {
                            if (isClosed) {
                                closeFd();
                                return;
                            }

                            if (readErr) {
                                closeFd();
                                res.destroy();
                                return;
                            }

                            if (bytesRead === 0) {
                                closeFd();
                                res.end();
                                return;
                            }

                            res.write(buf.slice(0, bytesRead), (writeErr) => {
                                if (isClosed) {
                                    closeFd();
                                    return;
                                }

                                if (writeErr) {
                                    closeFd();
                                    res.destroy();
                                    return;
                                }

                                offset += bytesRead;
                                setTimeout(sendNextChunk, 1);
                            });
                        });
                    };

                    sendNextChunk();
                });
            });
        }
    }
};