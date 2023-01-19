type EmitterConfig_T = {
    blendingMode: ParticleBlendModes_T,
    maxParticles: number,
    opacity: number,
    lifetime: [number, number],
    acceleration: Vector3Arr,
    particlesPerSecond: number,
    fadeIn?: Fade_T
    fadeOut?: Fade_T,
    initial: {
        particlesPerSecond: number,
        angularVelocity?: { min: Vector3Arr, max: Vector3Arr }
        velocity?: { min: Vector3Arr, max: Vector3Arr }
        scale?: { min: Vector3Arr, max: Vector3Arr }
    }
};

type Fade_T = {
    time: number,
    color: ColorArr
};