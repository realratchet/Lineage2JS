import { AnimationClip, Object3D, Vector3 } from "three";
import RenderManager, { type HTMLViewportElement_T } from "../rendering/render-manager";
import GLOBAL_UNIFORMS from "../materials/global-uniforms";
import { ColorByte } from "../utils/color-byte";
import type { NPawnLightComponent } from "../rendering/components/pawn-light-component";
import type BaseActor from "../base-actor";
import type LitSkinnedMesh from "../objects/lit-skinned-mesh";

// 127 = 1.0 in the Modulate2X domain, same as unlit meshes in LitSkinnedMesh
const viewerZone = { ambient: [127, 127, 127], isSunAffected: false };
const tmpSunAmbient = new ColorByte();
const tmpBillboardUp = new Vector3();
const tmpBillboardFront = new Vector3();
const tmpBillboardRight = new Vector3();
const tmpListenerForward = new Vector3();
const tmpListenerUp = new Vector3();
const arrLightingObjects: Object3D[] = [];

export class SkillViewerRenderManager extends RenderManager {
    public constructor(viewport: HTMLViewportElement_T) {
        super(viewport);

        this.player.removeFromParent();

        GLOBAL_UNIFORMS.fogNear.value = 1e7;
        GLOBAL_UNIFORMS.fogFar.value = 2e7;
        (GLOBAL_UNIFORMS.staticMeshSunAmbient.value as Vector3).set(0.5, 0.5, 0.5);
    }

    public onBeforeEngineTick(currentTime: number, deltaTime: number): void {
        this.isRenderingFrame = this.isRendering;

        if (!this.isRenderingFrame) return;

        this.updateScreenFade(currentTime);
        this.processShaderDiagnostics();
        this.viewShakeDelta = deltaTime / 1000;

        for (const simulation of this.hairSimulations) simulation.restorePose();

        this.isUpdatingMixer = true;
        try {
            this.mixer.update(deltaTime / 1000);
        } finally {
            this.isUpdatingMixer = false;
            this.runDeferredMixerOperations();
        }

        for (const simulation of this.hairSimulations) simulation.update(deltaTime / 1000);

        this.camera.updateMatrixWorld();
        this.lastProjectionScreenMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
        this.frustum.setFromProjectionMatrix(this.lastProjectionScreenMatrix);

        this.updatePawnPresentation(currentTime, deltaTime);
        this.audioManager.update(currentTime);
        this.updateViewerObjects(currentTime);

        const camPos = this.camera.position;

        this.camera.getWorldDirection(tmpListenerForward);
        tmpListenerUp.set(0, 1, 0).applyQuaternion(this.camera.quaternion);
        this.audioManager.updateListenerPosition(camPos.x, camPos.y, camPos.z, tmpListenerForward.x, tmpListenerForward.y, tmpListenerForward.z, tmpListenerUp.x, tmpListenerUp.y, tmpListenerUp.z);

        this.renderer.clear();
    }

    protected updateViewerObjects(currentTime: number): void {
        this.visibleWorldBatchEmitters.length = 0;

        GLOBAL_UNIFORMS.globalTimeSeconds.value = currentTime / 1000;

        const projUp = tmpBillboardUp.copy(this.camera.up).normalize();
        const projFront = tmpBillboardFront.set(0, 0, 1).applyQuaternion(this.camera.quaternion).normalize();
        const projRight = tmpBillboardRight.crossVectors(projFront, projUp).normalize();

        projUp.crossVectors(projRight, projFront).normalize();
        (GLOBAL_UNIFORMS.cameraBillboardRight.value as Vector3).copy(projRight);
        (GLOBAL_UNIFORMS.cameraBillboardUp.value as Vector3).copy(projUp);

        this.physicsManager.setTriggerPosition(this.camera.position);
        this.updatePawnVisibility();

        for (const component of this.pawnRenderables) this.updateViewerLighting(component.getParent());
        for (const component of this.actorMeshes) this.updateViewerLighting(component.getParent());

        this.scene.traverseVisible(child => {
            if ((child as any).isUpdatable) {
                if ((child as any).particlePool) {
                    if (!(child as any).isActorAttachedEmitter) return;

                    const mesh = (child as any).instancedMesh;

                    if (mesh?.visible && mesh.isWorldBatchCandidate) this.visibleWorldBatchEmitters.push(child);

                    const pendingSounds = (child as any).pendingSounds;

                    if (pendingSounds.length) {
                        for (const snd of pendingSounds)
                            if (snd.dataUri) this.audioManager.playOneShotSound(snd.dataUri, snd.position, snd.volume, snd.pitch, snd.refDistance, snd.maxDistance);
                        pendingSounds.length = 0;
                    }
                } else (child as any).update(currentTime);
            }

            if ((child as any).isMesh) {
                const mat = (child as any).material;

                if (mat) {
                    const materials = mat.isMaterial ? [mat] : mat;

                    for (const m of materials)
                        if (m && m.isUpdatable) m.update(currentTime);
                }
            }

            if ((child as any).isSkinnedMesh && !(child as any).hasStartedAnimation) {
                const meshAnimations = (child as any).meshAnimations as Record<string, AnimationClip>;
                const clip = meshAnimations?.["Wait"] ?? Object.values(meshAnimations ?? {})[0];

                if (clip) this.mixer.clipAction(clip, child).play();

                (child as any).hasStartedAnimation = true;
            }
        });

        this.particleBatcher.update(this.visibleWorldBatchEmitters, this.camera);
    }

    protected updateViewerLighting(actor: Object3D): void {
        const pawnLights = (actor as BaseActor).isActor ? (actor as BaseActor).findComponent<NPawnLightComponent>("nPawnLight") : null;

        if (pawnLights) pawnLights.updateLighting((actor as BaseActor).getRenderSphere());

        arrLightingObjects.length = 0;
        arrLightingObjects.push(actor);

        while (arrLightingObjects.length > 0) {
            const object = arrLightingObjects.pop()!;

            for (const child of object.children) arrLightingObjects.push(child);

            if ((object as LitSkinnedMesh).isLitSkinnedMesh)
                (object as LitSkinnedMesh).updateActorLighting(viewerZone, [], tmpSunAmbient, pawnLights ? pawnLights.getLights() : undefined);
        }
    }

    // every viewer pawn and effect owns a freshly decoded library, nothing will render these resources again
    public removePawn(pawn: BaseActor): void {
        const resources = collectResources(pawn, new Set());

        super.removePawn(pawn);

        for (const resource of resources) resource.dispose();
    }

    public removeTransientEffect(effect: Object3D): void {
        const resources = collectResources(effect, new Set());

        super.removeTransientEffect(effect);

        for (const resource of resources) resource.dispose();
    }

    public onEngineTick(currentTime: number, _deltaTime: number): void {
        if (!this.isRenderingFrame) return;

        const viewShakeActive = this.applyViewShake(currentTime);

        this.renderer.autoClear = false;
        this.renderer.clear();
        this.scene.traverseVisible(object => { if ((object as any).particlePool) (object as any).onRender(); });
        this.renderer.render(this.scene, this.camera);

        if (viewShakeActive) this.restoreViewShake();
    }

    public onAfterEngineTick(_currentTime: number, _deltaTime: number): void {
        this.isRenderingFrame = false;
    }

    public startTicking(_currentTime: number): void {
        this.scene.updateMatrixWorld(true);
        this.physicsManager.registerSimulationObjects(this.scene);
        this.isRendering = true;
        this.needsUpdate = true;
    }
}

function collectResources(root: Object3D, resources: Set<{ dispose(): void }>): Set<{ dispose(): void }> {
    root.traverse(object => {
        const mesh = object as any;

        if (!mesh.isMesh) return;

        if (mesh.isSkinnedMesh && mesh.skeleton) resources.add(mesh.skeleton);

        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
            if (!material) continue;

            resources.add(material);

            for (const value of Object.values(material))
                if (value && (value as any).isTexture) resources.add(value as any);

            if (material.uniforms) collectTextures(material.uniforms, resources, new WeakSet());
            if (material.sprites) collectTextures(material.sprites, resources, new WeakSet());
        }
    });

    return resources;
}

// procedural maps nest several levels deep, same walk as the sector resource release in RenderManager
function collectTextures(value: any, resources: Set<{ dispose(): void }>, seen: WeakSet<object>): void {
    if (!value || typeof value !== "object") return;
    if (value.isTexture) { resources.add(value); return; }
    if (seen.has(value)) return;

    seen.add(value);

    for (const nested of Object.values(value)) collectTextures(nested, resources, seen);
}

export default SkillViewerRenderManager;
