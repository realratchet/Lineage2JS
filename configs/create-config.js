const fs = require("fs");
const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const { SourceMapDevToolPlugin } = require("webpack");

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

const SUPPORTED_EXTENSIONS = ["UNR", "UTX", "USX", "UAX", "U", "UKX", "USK", "U"];

function createModuleConfig({ name, resolve, entry: _entry, library }) {
    return function ({ bundleAnalyzer, mode, devtool, minimize, dirOutput, stats }) {
        const pluginsSASS = (mode === "production"
            ? [{ loader: MiniCssExtractPlugin.loader }]
            : ["style-loader"])
            .concat([
                { loader: "css-loader", options: { url: false } },
                "sass-loader",
            ]);

        const dirAssets = "assets-c4/";
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


        const plugins = [
            new CopyWebpackPlugin({
                patterns: [
                    { from: "../html", to: "" },
                    { from: "../asset-list.json", to: "asset-list.json" },
                    // ...copyFiles
                ],
            })
        ];

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
            chunkFilename: "[name].chunk.js"
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
                    "@babel/plugin-proposal-class-properties"
                ]
            }
        }, {
            test: /\.(js|jsx|ts|tsx)$/,
            exclude: /(node_modules|submodules)/,
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
                    "@babel/plugin-proposal-class-properties"
                ]
            }
        });

        return {
            entry,
            mode,
            stats,
            resolve,
            optimization: {
                minimize
            },
            module: { rules },
            plugins,
            output,
            devServer: {
                port: 8080,
                allowedHosts: "all",
                hot: false,
                static: {
                    directory: path.resolve(__dirname, "../", dirAssets),
                    publicPath: "/assets"
                }
            },
            devtool,
            context: __dirname,
            experiments: {
                asyncWebAssembly: true
            }
        };
    }
}

module.exports.createConfigBundle = createModuleConfig({
    name: "client",
    resolve: {
        fallback: {
            "buffer": false,
            "path": require.resolve("path-browserify")
        },
        extensions: [".tsx", ".ts", ".js"],
        alias: {
            "@client": path.resolve(__dirname, "../src"),
            "@unreal": path.resolve(__dirname, "../src/assets/unreal"),
            "@l2js/core": "@l2js/core/src"
        }
    },
    entry: "../src/index.ts"
});