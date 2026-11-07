const crypto = require("crypto");

module.exports = function(source) {
    const signature = "\tfunction needsUpdate( object, geometry, program, index ) {";
    const start = source.indexOf(signature), end = source.indexOf("\n\tfunction saveCache(", start);
    if (start < 0 || end < start) throw new Error(`Unsupported three.js vertex binding update function.`);

    const hash = crypto.createHash("sha256").update(source.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n")).digest("hex");
    if (hash !== "4c58a7194f54a14186ad6a5bb474ebc73d95854edcc184d2ce5ac471b347c365") throw new Error(`Unsupported three.js vertex binding update function.`);

    const marker = "currentState.attributes = cache;";
    if (source.split(marker).length !== 2) throw new Error(`Unsupported three.js vertex binding cache.`);

    return (source.slice(0, start) + `function needsUpdate( object, geometry, program, index ) {
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
` + source.slice(end)).replace(marker, marker + "\n\t\tcurrentState.attributeNames = Object.keys( cache );");
};
