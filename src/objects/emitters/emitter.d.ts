type EmitterConfig_T = {
    blendingMode: ParticleBlendModes_T,
    maxParticles: number,
    opacity: number,
    lifetime: [number, number],
    acceleration: Vector3Arr,
    particlesPerSecond: number,
    fadeIn: Fade_T
    fadeOut: Fade_T,
    colorMultiplierRange: { min: Vector3Arr, max: Vector3Arr },
    initial: {
        particlesPerSecond: number,
        angularVelocity: { min: Vector3Arr, max: Vector3Arr }
        velocity: { min: Vector3Arr, max: Vector3Arr }
        position: { min: Vector3Arr, max: Vector3Arr }
        scale: { min: Vector3Arr, max: Vector3Arr }
    },
    changesOverLifetime: {
        scale: {
            values: [number, number][],
            repeats: number
        }
    }
};

type Fade_T = {
    time: number,
    color: ColorArr
};