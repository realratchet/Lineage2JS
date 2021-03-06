const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
// const { SourceMapDevToolPlugin } = require("webpack");

function createModuleConfig({ name, resolve, entry: _entry, library }) {
    return function ({ bundleAnalyzer, mode, devtool, minimize, dirOutput, stats }) {
        const pluginsSASS = (mode === "production"
            ? [{ loader: MiniCssExtractPlugin.loader }]
            : ["style-loader"])
            .concat([
                { loader: "css-loader", options: { url: false } },
                "sass-loader",
            ]);

        const plugins = [
            new CopyWebpackPlugin({
                patterns: [
                    { from: "../html", to: "" },
                    // { from: "../assets-c4", to: "assets/" }
                    { from: "../assets", to: "assets/" }
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
            devServer: { port: 8080, allowedHosts: "all", hot: false },
            devtool,
            context: __dirname
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
            "@unreal": path.resolve(__dirname, "../src/assets/unreal")
        }
    },
    entry: "../src/index.ts"
});