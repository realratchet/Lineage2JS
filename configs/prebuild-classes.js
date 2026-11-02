const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const webpack = require("webpack");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "build/prebuilt-classes.js");
let pending;
let dependencies = [];

function walk(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
}

async function generate() {
    const dirAssets = path.join(root, "assets-c4");
    const files = Object.fromEntries(walk(dirAssets).filter(file => /\.(u|unr|utx|usx|uax|ukx|usk)$/i.test(file)).map(file => [path.relative(dirAssets, file), file]));
    const core = fs.realpathSync(path.join(root, "node_modules/@l2js/core"));
    const sources = [...walk(path.join(root, "src/assets/unreal")), ...walk(path.join(core, "src")), ...walk(path.join(__dirname, "templates")), __filename, path.join(__dirname, "generate-classes.js")];
    dependencies = [...Object.values(files).filter(file => /\.u$/i.test(file)), ...sources];
    const hash = crypto.createHash("sha256");

    for (const file of dependencies) {
        hash.update(file);
        hash.update(fs.readFileSync(file));
    }
    const version = hash.digest("hex");
    if (fs.existsSync(output) && fs.existsSync(output + ".stats.json") && fs.existsSync(output + ".hash") && fs.readFileSync(output + ".hash", "utf8") === version)
        return { ...JSON.parse(fs.readFileSync(output + ".stats.json", "utf8")), cached: true };

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "task_prebuilt_classes_artifacts_"));
    try {
        fs.mkdirSync(path.dirname(output), { recursive: true });
        const temporary = path.join(dir, "classes.js");
        const manifest = path.join(dir, "manifest.json");
        fs.writeFileSync(manifest, JSON.stringify({ files, output: temporary }));
        const compiler = webpack({
            mode: "development", target: "node", devtool: false,
            entry: path.join(__dirname, "generate-classes.js"),
            output: { path: dir, filename: "scanner.cjs" },
            optimization: { minimize: false },
            resolve: { extensions: [".ts", ".js"], alias: { "@l2js/core": path.join(core, "src"), "@l2js/engine": path.join(root, "src/assets/unreal"), "@generated/classes": path.join(__dirname, "prebuilt-classes-empty.js") } },
            module: { rules: [{ test: /\.ts$/, use: { loader: require.resolve("babel-loader"), options: { babelrc: false, configFile: false, presets: [[require.resolve("@babel/preset-typescript"), { allowDeclareFields: true }]] } } }] },
            externals: { "gmp-wasm": "commonjs " + require.resolve("gmp-wasm") }
        });
        try {
            await new Promise((resolve, reject) => compiler.run((error, stats) => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : resolve()));
        } finally {
            await new Promise((resolve, reject) => compiler.close(error => error ? reject(error) : resolve()));
        }
        execFileSync(process.execPath, [path.join(dir, "scanner.cjs"), manifest], { cwd: root, stdio: "inherit", maxBuffer: 16 * 1024 * 1024 });
        const stats = JSON.parse(fs.readFileSync(temporary + ".stats.json", "utf8"));
        fs.copyFileSync(temporary, output);
        fs.copyFileSync(temporary + ".stats.json", output + ".stats.json");
        fs.writeFileSync(output + ".hash", version);
        return { ...stats, cached: false };
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

class PrebuiltClassesPlugin {
    apply(compiler) {
        let stats;
        async function run() {
            if (!pending) pending = generate();
            try { stats = await pending; }
            finally { pending = null; }
        }
        compiler.hooks.afterCompile.tap("prebuilt-classes", compilation => {
            for (const file of dependencies) compilation.fileDependencies.add(file);
            compilation.contextDependencies.add(path.join(root, "assets-c4/system"));
            console.log(`[prebuilt-classes] ${stats.classes} classes/structs prebuilt, ${stats.skipped} skipped because constructor lookup is unavailable (${stats.cached ? "cached" : "generated"}).`);
        });
        compiler.hooks.beforeRun.tapPromise("prebuilt-classes", run);
        compiler.hooks.watchRun.tapPromise("prebuilt-classes", run);
    }
}

module.exports = { PrebuiltClassesPlugin, output };
