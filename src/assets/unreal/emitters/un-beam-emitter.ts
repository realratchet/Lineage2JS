import UParticleEmitter from "./un-particle-emitter";
import type { FRange, FRangeVector } from "../un-range";
import type { DecodeLibraryBuilder } from "../decode-library-builder";

// BeamEmitter: the worker only carries the beam parameters across, the point
// generation and ribbon rendering live client side (objects/emitters/beam-emitter.ts).

abstract class UBeamEmitter extends UParticleEmitter {
    declare protected beamDistanceRange: FRange;
    declare protected beamEndPoints: any[];
    declare protected determineEndPointBy: number;
    declare protected beamTextureUScale: number;
    declare protected beamTextureVScale: number;
    declare protected rotatingSheets: number;
    declare protected triggerEndpoint: boolean;
    declare protected lowFrequencyNoiseRange: FRangeVector;
    declare protected lowFrequencyPoints: number;
    declare protected highFrequencyNoiseRange: FRangeVector;
    declare protected highFrequencyPoints: number;
    declare protected lfScaleFactors: any[];
    declare protected hfScaleFactors: any[];
    declare protected lfScaleRepeats: number;
    declare protected hfScaleRepeats: number;
    declare protected isUsingHighFrequencyScale: boolean;
    declare protected isUsingLowFrequencyScale: boolean;
    declare protected noiseDeterminesEndPoint: boolean;
    declare protected dynamicHFNoiseRange: FRangeVector;
    declare protected dynamicHFNoisePointsRange: FRange;
    declare protected dynamicTimeBetweenNoiseRange: FRange;
    declare protected isUsingBranching: boolean;

    public getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "BeamDistanceRange": "beamDistanceRange",
            "BeamEndPoints": "beamEndPoints",
            "DetermineEndPointBy": "determineEndPointBy",
            "BeamTextureUScale": "beamTextureUScale",
            "BeamTextureVScale": "beamTextureVScale",
            "RotatingSheets": "rotatingSheets",
            "TriggerEndpoint": "triggerEndpoint",
            "LowFrequencyNoiseRange": "lowFrequencyNoiseRange",
            "LowFrequencyPoints": "lowFrequencyPoints",
            "HighFrequencyNoiseRange": "highFrequencyNoiseRange",
            "HighFrequencyPoints": "highFrequencyPoints",
            "LFScaleFactors": "lfScaleFactors",
            "HFScaleFactors": "hfScaleFactors",
            "LFScaleRepeats": "lfScaleRepeats",
            "HFScaleRepeats": "hfScaleRepeats",
            "UseHighFrequencyScale": "isUsingHighFrequencyScale",
            "UseLowFrequencyScale": "isUsingLowFrequencyScale",
            "NoiseDeterminesEndPoint": "noiseDeterminesEndPoint",
            "DynamicHFNoiseRange": "dynamicHFNoiseRange",
            "DynamicHFNoisePointsRange": "dynamicHFNoisePointsRange",
            "DynamicTimeBetweenNoiseRange": "dynamicTimeBetweenNoiseRange",
            "UseBranching": "isUsingBranching",
            "BranchProbability": "_branchProbability",
            "BranchHFPointsRange": "_branchHFPointsRange",
            "BranchEmitter": "_branchEmitter",
            "BranchSpawnAmountRange": "_branchSpawnAmountRange",
            "LinkupLifetime": "_linkupLifetime",
            "SheetsUsed": "_sheetsUsed",
            "VerticesPerParticle": "_verticesPerParticle",
            "IndicesPerParticle": "_indicesPerParticle",
            "PrimitivesPerParticle": "_primitivesPerParticle",
            "BeamValueSum": "_beamValueSum",
            "HFPoints": "_hfPoints",
            "LFPoints": "_lfPoints",
            "HitActors": "_hitActors",
            "TimeSinceLastDynamicNoise": "_timeSinceLastDynamicNoise"
        });
    }

    public getDecodeInfo(builder: DecodeLibraryBuilder) {
        const library = builder.library;

        if (this.isUsingBranching)
            console.warn(`BeamEmitter '${this.objectName}': branching is not implemented`);

        const scales = (factors: any[]) => (factors ?? []).filter(f => f).map(f => ({
            frequencyScale: f.frequencyScale?.getElements() ?? [1, 1, 1],
            relativeLength: f.relativeLength ?? 0
        }));

        return Object.assign(super.getDecodeInfo(builder), {
            type: "BeamEmitter",
            texture: builder.pullMaterial(this.texture),
            beam: {
                distanceRange: this.beamDistanceRange?.loadSelf().getDecodeInfo(library) ?? [0, 0],
                endPoints: (this.beamEndPoints ?? []).filter(p => p).map(p => ({
                    offset: p.offset?.loadSelf().getDecodeInfo(library) ?? { min: [0, 0, 0], max: [0, 0, 0] },
                    weight: p.weight ?? 0
                })),
                determineEndPointBy: this.determineEndPointBy?.valueOf() ?? 0,
                textureUScale: this.beamTextureUScale ?? 1,
                textureVScale: this.beamTextureVScale ?? 1,
                rotatingSheets: this.rotatingSheets ?? 0,
                lowFrequencyPoints: Math.max(2, this.lowFrequencyPoints ?? 3),
                highFrequencyPoints: Math.max(2, this.highFrequencyPoints ?? 10),
                lowFrequencyNoiseRange: this.lowFrequencyNoiseRange?.loadSelf().getDecodeInfo(library),
                highFrequencyNoiseRange: this.highFrequencyNoiseRange?.loadSelf().getDecodeInfo(library),
                lfScaleFactors: scales(this.lfScaleFactors),
                hfScaleFactors: scales(this.hfScaleFactors),
                lfScaleRepeats: this.lfScaleRepeats ?? 0,
                hfScaleRepeats: this.hfScaleRepeats ?? 0,
                useLowFrequencyScale: !!this.isUsingLowFrequencyScale,
                useHighFrequencyScale: !!this.isUsingHighFrequencyScale,
                noiseDeterminesEndPoint: !!this.noiseDeterminesEndPoint,
                dynamicHFNoiseRange: this.dynamicHFNoiseRange?.loadSelf().getDecodeInfo(library),
                dynamicHFNoisePointsRange: this.dynamicHFNoisePointsRange?.loadSelf().getDecodeInfo(library) ?? [0, 0],
                dynamicTimeBetweenNoiseRange: this.dynamicTimeBetweenNoiseRange?.loadSelf().getDecodeInfo(library) ?? [0, 0]
            }
        });
    }
}

export default UBeamEmitter;
export { UBeamEmitter };
