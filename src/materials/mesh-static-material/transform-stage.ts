import { Matrix3, Vector2 } from "three";

// must match MAX_TRANSFORM_STAGES in shader-mesh-static.vs/.fs
const MAX_TRANSFORM_STAGES = 2;

const TRANSFORM_TYPE_CODE: Record<"pan" | "rotate" | "oscillate", number> = { pan: 0, rotate: 1, oscillate: 2 };

// superset of every kind's fields - a GLSL struct can't be a union
function emptyTransformStage() {
    return {
        type: 0,
        matrix: new Matrix3(),
        rate: new Vector2(),
        rotation: [0, 0, 0],
        rotationType: 0,
        oscillationRate: [0, 0, 0],
        oscillationAmplitude: [0, 0, 0],
        oscillationPhase: [0, 0, 0],
        rateU: 0, rateV: 0,
        phaseU: 0, phaseV: 0,
        amplitudeU: 0, amplitudeV: 0,
        typeU: 0, typeV: 0,
        offsetU: 0, offsetV: 0
    };
}

export function buildTransformStage(kind: "pan" | "rotate" | "oscillate", transform: any): any {
    const stage = emptyTransformStage();
    stage.type = TRANSFORM_TYPE_CODE[kind];
    stage.matrix = transform.matrix;

    switch (kind) {
        case "pan":
            stage.rate = transform.rate;
            break;
        case "rotate":
            stage.rotation = transform.rotation;
            stage.rotationType = transform.type; // TR_Fixed/Rotating/Oscillating (0/1/2)
            stage.oscillationRate = transform.oscillationRate;
            stage.oscillationAmplitude = transform.oscillationAmplitude;
            stage.oscillationPhase = transform.oscillationPhase;
            stage.offsetU = transform.offsetU;
            stage.offsetV = transform.offsetV;
            break;
        case "oscillate":
            stage.rateU = transform.rateU;
            stage.rateV = transform.rateV;
            stage.phaseU = transform.phaseU;
            stage.phaseV = transform.phaseV;
            stage.amplitudeU = transform.amplitudeU;
            stage.amplitudeV = transform.amplitudeV;
            stage.typeU = transform.typeU;
            stage.typeV = transform.typeV;
            stage.offsetU = transform.offsetU;
            stage.offsetV = transform.offsetV;
            break;
        default: throw new Error(`Unknown transform stage kind: ${kind}`);
    }

    return stage;
}

// three's uniform-array setter throws on an array shorter than the GLSL-declared length
export function padTransformStages(stages: any[]): any[] {
    if (stages.length > MAX_TRANSFORM_STAGES)
        throw new Error(`Transform chain depth ${stages.length} exceeds MAX_TRANSFORM_STAGES (${MAX_TRANSFORM_STAGES})`);

    const padded = stages.slice();
    while (padded.length < MAX_TRANSFORM_STAGES) padded.push(emptyTransformStage());
    return padded;
}

