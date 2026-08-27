const fs = require("fs");
const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const { initChunkerMiddleware } = require("./chunker-middleware");
// const { SourceMapDevToolPlugin } = require("webpack");

function* walkSync(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
        if (file.isDirectory()) {
            yield* walkSync(path.join(dir, file.name));
        } else {
            yield path.join(dir, file.name);
        }
    }
}

const SUPPORTED_EXTENSIONS = ["UNR", "UTX", "USX", "UAX", "U", "UKX", "USK", "U", "OGG"];

function createModuleConfig({ name, resolve, entry: _entry, library, isWorker }) {
    return function ({ bundleAnalyzer, mode, devtool, minimize, dirOutput, stats }) {
        const pluginsSASS = (mode === "production"
            ? [{ loader: MiniCssExtractPlugin.loader }]
            : ["style-loader"])
            .concat([
                { loader: "css-loader", options: { url: false } },
                "sass-loader",
            ]);

        const dirAssets = "assets-c4/";
        const plugins = [];

        if (!isWorker) {
            const fileList = {
                comment: "This file is auto-generated, any changes will be lost.",
                supported: {},
                unsupported: []
            };

            for (const fname of walkSync(dirAssets)) {

                const ext = path.extname(fname).slice(1).toUpperCase();
                const relPath = fname.replace(dirAssets, "");

                if (!SUPPORTED_EXTENSIONS.includes(ext)) {
                    fileList.unsupported.push(relPath);
                    continue;
                }

                fileList.supported[relPath.toLowerCase()] = relPath;
            }

            fs.writeFileSync(path.join(__dirname, "../asset-list.json"), JSON.stringify(fileList, undefined, 4));

            plugins.push(new CopyWebpackPlugin({
                patterns: [
                    { from: "../html", to: "" },
                    { from: "../asset-list.json", to: "asset-list.json" },
                    // ...copyFiles
                ],
            }));
        }

        if (devtool) {
            // plugins.unshift(new SourceMapDevToolPlugin({
            //     filename: "[name].chunk.js.map[query]",
            //     sourceRoot: "/",
            //     exclude: ["libs/", /\.(sa|sc|c)ss$/]
            // }));
        }

        if (bundleAnalyzer) plugins.push(new BundleAnalyzerPlugin());

        const entry = {};
        entry[name] = typeof _entry === "string" ? [_entry] : _entry;

        const output = {
            filename: "[name].bundle.js",
            path: dirOutput ? dirOutput : path.resolve(__dirname, "../bin"),
            // Client and worker compilers share bin/.
            chunkFilename: isWorker ? "worker.[name].chunk.js" : "[name].chunk.js"
        };

        if (library) {
            output["library"] = library ? `Module_${name}` : undefined;
            output["libraryTarget"] = "var";
            output["libraryExport"] = "default";
        }

        const rules = [{
            test: /\.(sa|sc|c)ss$/,
            use: pluginsSASS,
            exclude: /(node_modules|submodules)/,
        }, {
            test: /\.(vs|fs|glsl)$/,
            loader: "raw-loader"
        }];


        rules.unshift({
            test: /\.vue$/,
            exclude: /(node_modules|submodules)/,
            loader: "vue-loader",
            options: {
                presets: [
                    ["@babel/preset-env", {
                        targets: { browsers: ["chrome >= 80"] }
                    }],
                    [
                        "@babel/preset-typescript", {
                            allowNamespaces: true,
                            targets: {
                                browsers: ["chrome >= 80"]
                            }
                        }
                    ]
                ],
                plugins: [
                    ["@babel/plugin-transform-typescript", { allowDeclareFields: true }],
                    "@babel/transform-runtime",
                    // "@babel/plugin-transform-explicit-resource-management",
                    ["@babel/plugin-proposal-class-properties", { "loose": true }],
                    ["@babel/plugin-proposal-private-methods", { "loose": true }],
                    ["@babel/plugin-proposal-private-property-in-object", { "loose": true }]
                ]
            }
        }, {
            test: /\.(js|jsx|ts|tsx)$/,
            exclude: /(node_modules|submodules)/,
            use: [
                {
                    loader: "babel-loader",
                    options: {
                        presets: [
                            ["@babel/preset-env", {
                                targets: { browsers: ["chrome >= 80"] }
                            }],
                            [
                                "@babel/preset-typescript", {
                                    allowNamespaces: true,
                                    targets: {
                                        browsers: ["chrome >= 80"]
                                    }
                                }
                            ]
                        ],
                        plugins: [
                            ["@babel/plugin-transform-typescript", { allowDeclareFields: true }],
                            "@babel/transform-runtime",
                            // "@babel/plugin-transform-explicit-resource-management",
                            ["@babel/plugin-proposal-class-properties", { "loose": true }],
                            ["@babel/plugin-proposal-private-methods", { "loose": true }],
                            ["@babel/plugin-proposal-private-property-in-object", { "loose": true }]
                        ]
                    }
                }]
        });

        const config = {
            entry,
            mode,
            stats,
            target: isWorker ? "webworker" : "web",
            resolve,
            optimization: {
                minimize
            },
            module: { rules },
            plugins,
            output,
            devtool,
            context: __dirname,
            experiments: {
                asyncWebAssembly: true
            }
        };

        if (!isWorker) {
            config.devServer = {
                port: 8080,
                allowedHosts: "all",
                hot: false,
                liveReload: process.env.LIVE_RELOAD !== "0",
                static: {
                    directory: path.resolve(__dirname, "../", dirAssets),
                    publicPath: "/assets"
                },
                setupMiddlewares: (middlewares, devServer) => {
                    // middlewares.unshift(initChunkerMiddleware(dirAssets));

                    const reportFile = path.join(__dirname, "../sector-test-report.jsonl");

                    devServer.app.post("/sector-test/report", require("express").json({ limit: "4mb" }), (req, res) => {
                        fs.appendFileSync(reportFile, JSON.stringify({ t: new Date().toISOString(), ...req.body }) + "\n");
                        res.sendStatus(204);
                    });

                    const npcReportFile = path.join(__dirname, "../npc-test-report.jsonl");

                    devServer.app.post("/npc-test/report", require("express").json({ limit: "4mb" }), (req, res) => {
                        fs.appendFileSync(npcReportFile, JSON.stringify({ t: new Date().toISOString(), ...req.body }) + "\n");
                        res.sendStatus(204);
                    });

                    return middlewares;
                }
            };
        }

        return config;
    }
}

const resolve = {
    fallback: {
        "buffer": false,
        "path": require.resolve("path-browserify")
    },
    extensions: [".tsx", ".ts", ".js"],
    alias: {
        "@l2js/engine": path.resolve(__dirname, "../src/assets/unreal"),
        "@l2js/core": "@l2js/core/src"
    }
};

module.exports.createConfigBundle = createModuleConfig({
    name: "client",
    resolve,
    entry: "../src/index.ts"
});

module.exports.createConfigWorker = createModuleConfig({
    name: "decode-worker",
    resolve,
    entry: "../src/assets/decode-worker/decode.worker.ts",
    isWorker: true
});
