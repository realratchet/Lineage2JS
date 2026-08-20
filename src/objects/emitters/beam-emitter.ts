import ParticleMaterial from "@client/materials/particle-material/particle-material";
import { BufferAttribute, BufferGeometry, Mesh, Quaternion, Vector3 } from "three";
import BaseEmitter from "./base-emitter";

// BeamEmitter: every particle is a beam made of HighFrequencyPoints points along a
// low frequency noise path, rendered as RotatingSheets camera-facing ribbons
// (Up = normalize(Right x (prev - view)) * size.x).

type BeamRangeVec_T = { min: [number, number, number], max: [number, number, number] };
type BeamScale_T = { frequencyScale: [number, number, number], relativeLength: number };

type BeamSettings_T = {
    distanceRange: [number, number],
    endPoints: { offset: BeamRangeVec_T, weight: number }[],
    determineEndPointBy: number,
    textureUScale: number,
    textureVScale: number,
    rotatingSheets: number,
    lowFrequencyPoints: number,
    highFrequencyPoints: number,
    lowFrequencyNoiseRange?: BeamRangeVec_T,
    highFrequencyNoiseRange?: BeamRangeVec_T,
    lfScaleFactors: BeamScale_T[],
    hfScaleFactors: BeamScale_T[],
    lfScaleRepeats: number,
    hfScaleRepeats: number,
    useLowFrequencyScale: boolean,
    useHighFrequencyScale: boolean,
    noiseDeterminesEndPoint: boolean,
    dynamicHFNoiseRange?: BeamRangeVec_T,
    dynamicHFNoisePointsRange: [number, number],
    dynamicTimeBetweenNoiseRange: [number, number]
};

type BeamEmitterConfig_T = GD.EmitterConfig_T & { material: ParticleMaterialInitSettings_T, beam: BeamSettings_T };

// EBeamEndPointType values
const PTEP_Velocity = 0, PTEP_Distance = 1, PTEP_Offset = 2, PTEP_Actor = 3, PTEP_TraceOffset = 4, PTEP_OffsetAsAbsolute = 5;

const randRange = (min: number, max: number) => min + Math.random() * (max - min);

function randVec(range: BeamRangeVec_T | undefined, out: THREE.Vector3): THREE.Vector3 {
    if (!range) return out.set(0, 0, 0);

    return out.set(
        randRange(range.min[0], range.max[0]),
        randRange(range.min[1], range.max[1]),
        randRange(range.min[2], range.max[2]));
}

// LF/HFScaleFactors interpolation along the beam
function scaleNoise(factors: BeamScale_T[], repeats: number, i: number, count: number, noiseRange: BeamRangeVec_T | undefined, out: THREE.Vector3): THREE.Vector3 {
    const relativeLength = (i / count * (repeats + 1)) % 1;

    for (let n = 0; n < factors.length; n++) {
        if (factors[n].relativeLength < relativeLength) continue;

        const r2 = factors[n].relativeLength, v2 = factors[n].frequencyScale;
        const r1 = n ? factors[n - 1].relativeLength : 0;
        const v1 = n ? factors[n - 1].frequencyScale : [1, 1, 1];
        const a = r2 ? (relativeLength - r1) / (r2 - r1) : 1;

        randVec(noiseRange, out);
        out.x *= v1[0] + (v2[0] - v1[0]) * a;
        out.y *= v1[1] + (v2[1] - v1[1]) * a;
        out.z *= v1[2] + (v2[2] - v1[2]) * a;

        return out;
    }

    return out.set(0, 0, 0);
}

const tmpBeamDirection = new Vector3();
const tmpBeamEndPoint = new Vector3();
const tmpBeamNoise = new Vector3();
const tmpBeamOwnerOffset = new Vector3();
const tmpBeamOwnerPosition = new Vector3();
const tmpBeamOldOwnerPosition = new Vector3();
const tmpBeamWorldScale = new Vector3();
const tmpBeamWorldQuaternion = new Quaternion();

class BeamEmitter extends BaseEmitter {
    protected beam: BeamSettings_T;
    protected sheetsUsed: number;
    protected timeSinceLastDynamicNoise = 0;
    protected lastNoiseTime = -1;

    public constructor(config: BeamEmitterConfig_T) {
        super(config);
        this.finishConstruction(config);
    }

    protected initSettings(config: BeamEmitterConfig_T): void {
        this.material = config.material;
        this.beam = config.beam;
        this.sheetsUsed = config.beam.rotatingSheets || 1;
    }

    protected initParticleMesh() {
        const { highFrequencyPoints: hf, textureVScale } = this.beam;
        const sheets = this.sheetsUsed;
        const vertexCount = 2 * hf * sheets;
        const geometry = new BufferGeometry();

        geometry.setAttribute("position", new BufferAttribute(new Float32Array(vertexCount * 3), 3));
        geometry.setAttribute("uv", new BufferAttribute(new Float32Array(vertexCount * 2), 2));

        // uvs never change: u = t * UScale (filled at spawn), v alternates 0 / VScale
        const uvs = geometry.getAttribute("uv").array as Float32Array;

        for (let i = 0; i < hf * sheets; i++)
            uvs[(2 * i + 1) * 2 + 1] = textureVScale;

        const indices = new Uint16Array(6 * (hf - 1) * sheets);
        let n = 0;

        for (let r = 0; r < sheets; r++) {
            for (let i = 0; i < hf - 1; i++) {
                const base = 2 * (i + r * hf);

                indices[n++] = base; indices[n++] = base + 1; indices[n++] = base + 2;
                indices[n++] = base + 1; indices[n++] = base + 3; indices[n++] = base + 2;
            }
        }

        geometry.setIndex(new BufferAttribute(indices, 1));
        geometry.boundingSphere = null;

        const mesh = new BeamMesh(geometry, new ParticleMaterial(this.material));

        mesh.emitter = this;
        mesh.frustumCulled = false;

        return mesh as any;
    }

    // spawn: base particle, endpoint determination, LF path, then HF points on top
    protected spawnParticle(index: number, spawnTime: number, flags: number = 0, spawnFlags: number = 0, localLocationOffset = new Vector3(0, 0, 0)) {
        super.spawnParticle(index, spawnTime, flags, spawnFlags, localLocationOffset);

        // base bailed out under the same conditions
        if (!this.maxParticles || (this.lifetimeRange?.max ?? 0) <= 0) return;

        const particle = this.particlePool?.[index];

        if (!particle || !this.beam) return;

        const beam = this.beam;
        const sim = this.particles[index];
        const location = sim.position;
        let setEndPoint = false;

        // pick a weighted endpoint entry
        let epIndex = -1;

        if (beam.endPoints.length) {
            const total = beam.endPoints.reduce((sum, p) => sum + p.weight, 0);

            if (total > 0) {
                let random = Math.random() * total, sum = 0;

                for (let i = 0; i < beam.endPoints.length; i++) {
                    if (sum < random && random <= sum + beam.endPoints[i].weight) { epIndex = i; break; }
                    sum += beam.endPoints[i].weight;
                }
            }

            if (epIndex === -1) epIndex = 0;
        }

        switch (beam.determineEndPointBy) {
            case PTEP_Velocity:
                tmpBeamDirection.copy(sim.velocity).multiplyScalar(sim.maxLifetime);
                break;
            case PTEP_Distance:
                sim.velocity.normalize();
                tmpBeamDirection.copy(sim.velocity).multiplyScalar(randRange(beam.distanceRange[0], beam.distanceRange[1]));
                break;
            case PTEP_Offset:
            case PTEP_TraceOffset: // no collision here, behaves like PTEP_Offset
                if (epIndex !== -1) {
                    randVec(beam.endPoints[epIndex].offset, tmpBeamDirection);
                    tmpBeamEndPoint.copy(tmpBeamDirection).add(location);
                }
                setEndPoint = true;
                break;
            case PTEP_OffsetAsAbsolute:
                if (epIndex !== -1) {
                    randVec(beam.endPoints[epIndex].offset, tmpBeamEndPoint);
                    tmpBeamDirection.copy(tmpBeamEndPoint).sub(location);
                }
                setEndPoint = true;
                break;
            case PTEP_Actor: // actor tags aren't resolved in the viewer
                setEndPoint = true;
                break;
        }

        if (beam.noiseDeterminesEndPoint) setEndPoint = false;

        // low frequency path
        const lf = beam.lowFrequencyPoints, hf = beam.highFrequencyPoints;
        const lfPoints: THREE.Vector3[] = [location.clone()];

        for (let i = 1; i < lf; i++) {
            if (beam.useLowFrequencyScale)
                scaleNoise(beam.lfScaleFactors, beam.lfScaleRepeats, i, lf, beam.highFrequencyNoiseRange, tmpBeamNoise);
            else
                randVec(beam.lowFrequencyNoiseRange, tmpBeamNoise);

            lfPoints.push(location.clone().addScaledVector(tmpBeamDirection, i / (lf - 1)).add(tmpBeamNoise));
        }

        if (setEndPoint) lfPoints[lf - 1].copy(tmpBeamEndPoint);

        // high frequency points modulated on top of the low frequency path
        const hfPoints: Float32Array = (particle as any).beamPoints ?? new Float32Array(hf * 3);
        const hfT: Float32Array = (particle as any).beamT ?? new Float32Array(hf);
        const rhf = 1 / (hf - 1), rlf = 1 / (lf - 1);
        let th = rhf, lfIndex = 0;

        hfPoints[0] = lfPoints[0].x; hfPoints[1] = lfPoints[0].y; hfPoints[2] = lfPoints[0].z;
        hfT[0] = 0;

        for (let i = 1; i < hf; i++) {
            if (beam.useHighFrequencyScale)
                scaleNoise(beam.hfScaleFactors, beam.hfScaleRepeats, i, hf, beam.highFrequencyNoiseRange, tmpBeamNoise);
            else
                randVec(beam.highFrequencyNoiseRange, tmpBeamNoise);

            const tl = th * (lf - 1);
            const a = lfPoints[lfIndex], b = lfPoints[Math.min(lfIndex + 1, lf - 1)];

            hfPoints[i * 3 + 0] = (1 - tl) * a.x + tl * b.x + tmpBeamNoise.x;
            hfPoints[i * 3 + 1] = (1 - tl) * a.y + tl * b.y + tmpBeamNoise.y;
            hfPoints[i * 3 + 2] = (1 - tl) * a.z + tl * b.z + tmpBeamNoise.z;
            hfT[i] = i * rhf;

            th += rhf;
            if (th >= rlf) { th -= rlf; lfIndex++; }
        }

        if (setEndPoint) {
            hfPoints[(hf - 1) * 3 + 0] = tmpBeamEndPoint.x;
            hfPoints[(hf - 1) * 3 + 1] = tmpBeamEndPoint.y;
            hfPoints[(hf - 1) * 3 + 2] = tmpBeamEndPoint.z;
        }

        (particle as any).beamPoints = hfPoints;
        (particle as any).beamT = hfT;
        (particle as any).beamDirty = true;
    }

    protected updateParticle(deltaTime: number, index: number): void {
        const points = (this.particlePool[index] as any)?.beamPoints as Float32Array | undefined;
        if (!points) return;

        for (let i = 0; i < points.length; i += 3)
            this.boundingBox.expandByPoint(this.tmpVec.set(points[i], points[i + 1], points[i + 2]));
    }

    protected updateParticles(deltaTime: number): number {
        if (this.coordinateSystem === "independent" && this.parent) {
            this.parent.getWorldPosition(tmpBeamOwnerPosition);
            tmpBeamOldOwnerPosition.copy(this.oldOwnerLocation);

            if (this.parent.parent) this.parent.parent.localToWorld(tmpBeamOldOwnerPosition);

            tmpBeamOwnerOffset.subVectors(tmpBeamOwnerPosition, tmpBeamOldOwnerPosition);

            if (tmpBeamOwnerOffset.lengthSq() > 0) {
                // UBeamEmitter::UpdateParticles treats non-relative HFPoints as world-space.
                this.getWorldQuaternion(tmpBeamWorldQuaternion).invert();
                this.getWorldScale(tmpBeamWorldScale);
                tmpBeamOwnerOffset.applyQuaternion(tmpBeamWorldQuaternion).divide(tmpBeamWorldScale);

                for (const particle of this.particlePool) {
                    const points = (particle as any).beamPoints as Float32Array | undefined;

                    if (!points) continue;

                    for (let i = 0; i < points.length; i += 3) {
                        points[i] -= tmpBeamOwnerOffset.x;
                        points[i + 1] -= tmpBeamOwnerOffset.y;
                        points[i + 2] -= tmpBeamOwnerOffset.z;
                    }
                }
            }
        }

        return super.updateParticles(deltaTime);
    }

    // dynamic noise timing, whole steps of the sampled interval
    public beamDynamicNoiseSteps(currentTime: number): number {
        if (this.lastNoiseTime < 0) this.lastNoiseTime = currentTime;

        this.timeSinceLastDynamicNoise += (currentTime - this.lastNoiseTime) / 1000;
        this.lastNoiseTime = currentTime;

        const divisor = randRange(this.beam.dynamicTimeBetweenNoiseRange[0], this.beam.dynamicTimeBetweenNoiseRange[1]);

        if (!divisor) return 1;

        const steps = Math.floor(this.timeSinceLastDynamicNoise / divisor);

        this.timeSinceLastDynamicNoise %= divisor;

        return steps;
    }
}

const tmpRight = new Vector3(), tmpUp = new Vector3(), tmpPrev = new Vector3(), tmpPoint = new Vector3(), tmpNoise = new Vector3(), tmpView = new Vector3();

class BeamMesh extends Mesh<BufferGeometry, ParticleMaterial> {
    public emitter: BeamEmitter = null;

    onBeforeRender = (_renderer: THREE.WebGLRenderer, _scene: THREE.Scene, camera: THREE.Camera) => {
        const emitter = this.emitter as any;
        const particle = (this.parent as any); // Particle wrapper owns beamPoints
        const beam: BeamSettings_T = emitter?.beam;
        const points: Float32Array = particle?.beamPoints;
        const ts: Float32Array = particle?.beamT;

        if (!beam || !points) return;

        // beams render from their points only - cancel the particle wrapper's
        // transform so the geometry lives in emitter space
        const ws = particle.scale;

        this.scale.set(1 / (ws.x || 1), 1 / (ws.y || 1), 1 / (ws.z || 1));
        this.position.copy(particle.position).negate().multiply(this.scale);
        this.updateMatrix();
        this.updateMatrixWorld(true);

        const hf = beam.highFrequencyPoints;
        const sheets = emitter.sheetsUsed as number;
        const positions = this.geometry.getAttribute("position");
        const uvs = this.geometry.getAttribute("uv");
        const posArray = positions.array as Float32Array;
        const uvArray = uvs.array as Float32Array;
        const size = ws.x || 1; // particle size.x is the ribbon half width

        // dynamic hf noise jitters the stored points in place
        const noiseSteps = emitter.beamDynamicNoiseSteps(performance.now());

        if (noiseSteps > 0 && beam.dynamicHFNoiseRange) {
            const [min, max] = beam.dynamicHFNoisePointsRange;

            for (let n = 0; n < hf; n++) {
                if (n <= min || n >= max) continue;

                randVec(beam.dynamicHFNoiseRange, tmpNoise);
                points[n * 3 + 0] += noiseSteps * tmpNoise.x;
                points[n * 3 + 1] += noiseSteps * tmpNoise.y;
                points[n * 3 + 2] += noiseSteps * tmpNoise.z;
            }
        }

        // view position in emitter space
        const view = camera.getWorldPosition(tmpView);

        (emitter as THREE.Object3D).worldToLocal(view);

        for (let r = 0; r < sheets; r++) {
            // previous-point seed for the first segment: 2 * P0 - P1
            tmpPrev.set(
                2 * points[0] - points[3],
                2 * points[1] - points[4],
                2 * points[2] - points[5]);

            for (let n = 0; n < hf; n++) {
                tmpPoint.set(points[n * 3], points[n * 3 + 1], points[n * 3 + 2]);
                tmpRight.copy(tmpPoint).sub(tmpPrev);
                tmpUp.copy(tmpPrev).sub(view).cross(tmpRight).negate().normalize(); // Right ^ (prev - view)

                if (r) {
                    tmpRight.normalize();
                    tmpUp.applyAxisAngle(tmpRight, Math.PI * r / sheets);
                }

                tmpUp.multiplyScalar(size);

                const v = 2 * (n + r * hf);

                posArray[(v + 0) * 3 + 0] = tmpPoint.x + tmpUp.x;
                posArray[(v + 0) * 3 + 1] = tmpPoint.y + tmpUp.y;
                posArray[(v + 0) * 3 + 2] = tmpPoint.z + tmpUp.z;
                posArray[(v + 1) * 3 + 0] = tmpPoint.x - tmpUp.x;
                posArray[(v + 1) * 3 + 1] = tmpPoint.y - tmpUp.y;
                posArray[(v + 1) * 3 + 2] = tmpPoint.z - tmpUp.z;

                uvArray[(v + 0) * 2] = uvArray[(v + 1) * 2] = ts[n] * beam.textureUScale;

                tmpPrev.copy(tmpPoint);
            }
        }

        positions.needsUpdate = true;
        uvs.needsUpdate = true;
    };
}

export default BeamEmitter;
export { BeamEmitter };
