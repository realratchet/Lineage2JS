declare module "*.vs" {
    const value: string;
    export default value;
}

declare module "*.fs" {
    const value: string;
    export default value;
}

type ParticleMaterialInitSettings_T = { map: IDecodedParameter, blendingMode: ParticleBlendModes_T, opacity: number }
type ParticleMaterial = import("./particle-material").ParticleMaterial;