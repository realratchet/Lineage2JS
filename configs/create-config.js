const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const webpack = require("webpack");
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
    return function ({ bundleAnalyzer, mode, devtool, minimize, dirOutput, stats, httpAssets, defaultLoginServer, preloadSectors = [], characterCreationRaces = [0, 1, 2, 3, 4], loginExitUrl = "", clientDownloadUrl = "" }) {
        if (!characterCreationRaces.length || characterCreationRaces.some(race => !Number.isInteger(race) || race < 0 || race > 4) || new Set(characterCreationRaces).size !== characterCreationRaces.length)
            throw new Error(`Invalid character creation races: ${characterCreationRaces}`);
        if (preloadSectors.some(sector => !/^\d+_\d+$/.test(sector))) throw new Error(`Invalid preload sectors: ${preloadSectors}`);

        const pluginsSASS = (mode === "production"
            ? [{ loader: MiniCssExtractPlugin.loader }]
            : ["style-loader"])
            .concat([
                { loader: "css-loader", options: { url: false } },
                "sass-loader",
            ]);

        const dirAssets = path.resolve(__dirname, "../assets-c4") + path.sep;
        const plugins = [new webpack.DefinePlugin({ BITMAP_NAMEPLATES: JSON.stringify(process.env.BITMAP_NAMEPLATES !== "0"), DEFAULT_LOGIN_SERVER: JSON.stringify(defaultLoginServer || ""), PRELOAD_SECTORS: JSON.stringify(preloadSectors), CHARACTER_CREATION_RACES: JSON.stringify(characterCreationRaces), LOGIN_EXIT_URL: JSON.stringify(loginExitUrl), CLIENT_DOWNLOAD_URL: JSON.stringify(clientDownloadUrl) })];
        const servedAssets = { files: Object.create(null), version: "" };
        const dirThreeWasm = path.resolve(__dirname, "../node_modules/three-wasm/src");

        if (!isWorker) {
            const servedPath = path.resolve(__dirname, "../served.txt");
            const patterns = fs.existsSync(servedPath) ? fs.readFileSync(servedPath, "utf8").split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => new RegExp(line, "i")) : [];

            if (patterns.length && fs.existsSync(dirAssets)) {
                const hash = crypto.createHash("sha256");

                for (const fname of Array.from(walkSync(dirAssets)).sort()) {
                    const relPath = path.relative(dirAssets, fname).split(path.sep).join("/");

                    if (!patterns.some(pattern => pattern.test(relPath))) continue;

                    servedAssets.files[relPath.toLowerCase()] = relPath;
                    hash.update(JSON.stringify(relPath));
                    hash.update(fs.readFileSync(fname));
                }

                if (Object.keys(servedAssets.files).length) servedAssets.version = hash.digest("hex");
            }

            plugins.push({ apply(compiler) {
                compiler.hooks.thisCompilation.tap("served-assets", compilation => {
                    compilation.hooks.processAssets.tap({ name: "served-assets", stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL }, () => {
                        compilation.emitAsset("served-assets.json", new webpack.sources.RawSource(JSON.stringify(servedAssets)));
                    });
                });
            } });

            if (!fs.existsSync(dirThreeWasm)) throw new Error(`three-wasm is not linked at '${dirThreeWasm}', run 'npm link ../three-wasm'.`);

            for (const name of ["Matrix4", "Euler"])
                plugins.push(new webpack.NormalModuleReplacementPlugin(new RegExp(`three[\\\\/]src[\\\\/]math[\\\\/]${name}\\.js$`), data => {
                    if (!data.createData || !data.createData.resource) return;

                    data.createData.resource = path.join(dirThreeWasm, `${name}.js`);
                    data.createData.context = dirThreeWasm;
                }));
        }

        if (!isWorker && httpAssets) {
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
        }

        if (!isWorker) {
            plugins.push(new CopyWebpackPlugin({
                patterns: [
                    { from: "../html", to: "" },
                    ...(httpAssets ? [{ from: "../asset-list.json", to: "asset-list.json" }] : []),
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
            exclude: /(node_modules|submodules|three-wasm)/,
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
            resolve: !isWorker ? { ...resolve, alias: { ...resolve.alias, "three$": path.resolve(__dirname, "../node_modules/three/src/Three.js"), "three": path.resolve(__dirname, "../node_modules/three") } } : resolve,
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
                client: process.env.LIVE_RELOAD === "0" ? false : undefined,
                static: httpAssets ? {
                    directory: path.resolve(__dirname, "../", dirAssets),
                    publicPath: "/assets"
                } : false,
                setupMiddlewares: (middlewares, devServer) => {
                    // middlewares.unshift(initChunkerMiddleware(dirAssets));

                    middlewares.unshift({ name: "served-assets", path: "/assets", middleware: (req, res, next) => {
                        let assetPath;

                        try { assetPath = decodeURIComponent(req.url.split("?")[0]).slice(1).toLowerCase(); }
                        catch (e) { return res.sendStatus(400); }

                        const file = servedAssets.files[assetPath];

                        if (file) return res.sendFile(path.resolve(dirAssets, file));
                        if (httpAssets) return next();

                        res.sendStatus(404);
                    } });

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
        "@l2js/engine$": path.resolve(__dirname, "../src/assets/unreal/contracts/index.ts"),
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
