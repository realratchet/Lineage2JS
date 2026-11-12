const crypto = require("crypto");
const path = require("path");

const hashes = {
    "WebGLBindingStates.js": "4c58a7194f54a14186ad6a5bb474ebc73d95854edcc184d2ce5ac471b347c365",
    "WebGLRenderer.js": "9e8740aad691246b31b3704014e8f3bbd38a8e7bf4b1b4d23868541b023cc63a",
    "WebGLPrograms.js": "a682663382b1437ab261f74a52f62686b0160605108f1db05639e68f062a945d",
    "WebGLShaderCache.js": "0327a8f797105550545e276545428b9600db627a61c66943e8511cc104cc9503"
};

function replaceOnce(source, name, from, to) {
    if (source.split(from).length !== 2) throw new Error(`Unsupported three.js ${name}.`);

    return source.replace(from, to);
}

module.exports = function(source) {
    const name = path.basename(this.resourcePath);

    source = source.replace(/^﻿/, "").replace(/\r\n/g, "\n");

    if (crypto.createHash("sha256").update(source).digest("hex") !== hashes[name]) throw new Error(`Unsupported three.js ${name}.`);

    switch (name) {
        case "WebGLBindingStates.js": {
            const start = source.indexOf("\tfunction needsUpdate( object, geometry, program, index ) {"), end = source.indexOf("\n\tfunction saveCache(", start);
            const marker = "currentState.attributes = cache;";

            if (start < 0 || end < start) throw new Error(`Unsupported three.js ${name}.`);

            return replaceOnce(source.slice(0, start) + `function needsUpdate( object, geometry, program, index ) {
    const cachedAttributes = currentState.attributes, geometryAttributes = geometry.attributes, names = currentState.attributeNames;
    if ( names === undefined ) return true;
    for ( let i = 0; i < names.length; i ++ ) {
        const name = names[ i ], cachedAttribute = cachedAttributes[ name ];
        let geometryAttribute = geometryAttributes[ name ];
        if ( geometryAttribute === undefined ) {
            if ( name === 'instanceMatrix' && object.instanceMatrix ) geometryAttribute = object.instanceMatrix;
            if ( name === 'instanceColor' && object.instanceColor ) geometryAttribute = object.instanceColor;
        }
        if ( cachedAttribute.attribute !== geometryAttribute ) return true;
        if ( geometryAttribute && cachedAttribute.data !== geometryAttribute.data ) return true;
    }
    return currentState.index !== index;
}
` + source.slice(end), name, marker, marker + "\n\t\tcurrentState.attributeNames = Object.keys( cache );");
        }
        case "WebGLRenderer.js": // a draw whose program is still linking is skipped, getUniforms would block on the link
            source = replaceOnce(source, name, "\t\t\tconst program = setProgram( camera, scene, geometry, material, object );\n", "\t\t\tconst program = setProgram( camera, scene, geometry, material, object );\n\n\t\t\tif ( program === null ) return;\n");
            source = replaceOnce(source, name, "\t\t\tlet refreshProgram = false;\n", "\t\t\tif ( program.isReady() === false ) return null;\n\n\t\t\tlet refreshProgram = false;\n");
            return replaceOnce(source, name, "\t\t\tinfo.programs = programCache.programs;\n", "\t\t\tinfo.programs = programCache.programs;\n\t\t\t_this.programCache = programCache;\n");
        case "WebGLPrograms.js": { // programs are kept for the session, every relink stalls the GPU process
            const start = source.indexOf("\tfunction releaseProgram( program ) {"), end = source.indexOf("\n\tfunction releaseShaderCache(", start);

            if (start < 0 || end < start) throw new Error(`Unsupported three.js ${name}.`);

            source = source.slice(0, start) + "\tfunction releaseProgram( program ) {\n\n\t\tprogram.usedTimes --;\n\n\t}\n" + source.slice(end);
            source = replaceOnce(source, name, "\t\t\tprograms.push( program );\n", "\t\t\tprograms.push( program );\n\t\t\tprogram.parameters = { ...parameters, uniforms: undefined };\n");
            source = replaceOnce(source, name, "\n\treturn {\n\t\tgetParameters: getParameters,\n", "\n\tfunction restoreProgram( parameters ) {\n\n\t\tparameters.customVertexShaderID = _customShaders.getVertexShaderStage( parameters ).id;\n\t\tparameters.customFragmentShaderID = _customShaders.getFragmentShaderStage( parameters ).id;\n\n\t\treturn acquireProgram( parameters, getProgramCacheKey( parameters ) );\n\n\t}\n\n\tfunction hasShaderStage( code ) {\n\n\t\treturn _customShaders.shaderCache.has( code );\n\n\t}\n\n\treturn {\n\t\tgetParameters: getParameters,\n");
            return replaceOnce(source, name, "\t\tacquireProgram: acquireProgram,\n", "\t\tacquireProgram: acquireProgram,\n\t\trestoreProgram: restoreProgram,\n\t\thasShaderStage: hasShaderStage,\n");
        }
        case "WebGLShaderCache.js": // a dropped stage gets a new id, which changes the program cache key
            return replaceOnce(source, name, "\t\t\tif ( shaderStage.usedTimes === 0 ) this.shaderCache.delete( shaderStage.code );\n", "");
        default: throw new Error(`Unsupported three.js ${name}.`);
    }
};
