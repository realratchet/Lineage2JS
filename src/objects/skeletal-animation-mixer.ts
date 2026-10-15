import { AnimationMixer, AnimationAction, KeyframeTrack, Object3D, LoopRepeat, NormalAnimationBlendMode, InterpolateLinear } from "three";

type RootState_T = { frame: number, count: number };
type BindingState_T = { property: any, target: Object3D, frame: number, value: ArrayLike<number>, x: number, y: number, z: number, w: number, wasFast: boolean };
type ChannelState_T = { binding: BindingState_T, interpolant: any, constant: Float32Array, linearConstant: boolean };
type ActionState_T = { root: RootState_T, channels: ChannelState_T[] };

function copyPrevious(state: BindingState_T, target: Float64Array, offset: number, size: number): void {
    target[offset] = state.x; target[offset + 1] = state.y; target[offset + 2] = state.z;
    if (size === 4) target[offset + 3] = state.w;
}

export class SkeletalAnimationMixer extends AnimationMixer {
    protected readonly suspendedRoots = new WeakMap<Object3D, number>();
    protected readonly rootStates = new WeakMap<Object3D, RootState_T>();
    protected readonly actionStates = new WeakMap<AnimationAction, ActionState_T>();
    protected readonly bindingStates = new WeakMap<object, BindingState_T>();
    protected readonly constantTracks = new WeakMap<KeyframeTrack, Float32Array>();
    protected readonly arrBindingStates: BindingState_T[] = [];
    protected bindingVersion: number = 0;
    protected cachedBindingVersion: number = -1;
    protected frame: number = 0;

    public setRootEnabled(root: Object3D, enabled: boolean): void {
        const suspendedAt = this.suspendedRoots.get(root);

        if (!enabled) {
            if (suspendedAt === undefined) this.suspendedRoots.set(root, this.time);
            return;
        }
        if (suspendedAt === undefined) return;

        const elapsed = this.time - suspendedAt;

        for (const action of (this as any)._actions) {
            if (action.getRoot() !== root) continue;
            if (action._startTime !== null) action._startTime += elapsed;
            for (const interpolant of [action._weightInterpolant, action._timeScaleInterpolant]) {
                if (!interpolant) continue;
                interpolant.parameterPositions[0] += elapsed;
                interpolant.parameterPositions[1] += elapsed;
            }
        }
        this.suspendedRoots.delete(root);
    }

    protected _lendBinding(binding: any): void {
        (AnimationMixer.prototype as any)._lendBinding.call(this, binding);
        const state = this.bindingStates.get(binding);
        if (state) state.wasFast = false;
        this.bindingVersion++;
    }

    protected _takeBackBinding(binding: any): void {
        (AnimationMixer.prototype as any)._takeBackBinding.call(this, binding);
        const state = this.bindingStates.get(binding);
        if (state) state.wasFast = false;
        this.bindingVersion++;
        this.arrBindingStates.length = 0;
    }

    protected _bindAction(action: AnimationAction, prototypeAction: AnimationAction): void {
        (AnimationMixer.prototype as any)._bindAction.call(this, action, prototypeAction);
        this.actionStates.delete(action);
    }

    protected getActionState(action: AnimationAction): ActionState_T {
        let state = this.actionStates.get(action);
        if (state) return state;

        const root = action.getRoot() as Object3D;
        let rootState = this.rootStates.get(root);
        if (!rootState) this.rootStates.set(root, rootState = { frame: -1, count: 0 });
        const channels: ChannelState_T[] = [], tracks = action.getClip().tracks;

        for (let i = 0; i < tracks.length; i++) {
            const mixer = (action as any)._propertyBindings[i], binding = mixer.binding;
            const property = binding.resolvedProperty;
            if (!binding.node || !binding.node.isBone || !property || !(property.isVector3 || property.isQuaternion)) {
                state = { root: rootState, channels: null };
                this.actionStates.set(action, state);
                return state;
            }

            let target = this.bindingStates.get(mixer);
            if (!target) {
                this.bindingStates.set(mixer, target = { property, target: binding.targetObject, frame: -1, value: null, x: 0, y: 0, z: 0, w: 0, wasFast: false });
                this.bindingVersion++;
            }
            const track = tracks[i], size = track.getValueSize();
            let constant = this.constantTracks.get(track);
            if (constant === undefined) {
                constant = track.values as Float32Array;
                for (let j = size; j < track.values.length; j++)
                    if (track.values[j] !== track.values[j % size]) { constant = null; break; }
                this.constantTracks.set(track, constant);
            }
            const linearConstant = !!constant && size === 3 && track.times.length === 2 && track.times[0] === 0 && track.times[1] === action.getClip().duration;
            if (track.getInterpolation() !== InterpolateLinear || size === 3 && !linearConstant) constant = null;
            channels.push({ binding: target, interpolant: (action as any)._interpolants[i], constant, linearConstant });
        }

        state = { root: rootState, channels };
        this.actionStates.set(action, state);
        return state;
    }

    protected getBindingStates(): BindingState_T[] {
        const mixer = this as any;
        if (this.cachedBindingVersion !== this.bindingVersion) {
            this.arrBindingStates.length = mixer._nActiveBindings;
            for (let i = 0; i < mixer._nActiveBindings; i++) this.arrBindingStates[i] = this.bindingStates.get(mixer._bindings[i]);
            this.cachedBindingVersion = this.bindingVersion;
        }
        return this.arrBindingStates;
    }

    protected resetBindings(): void {
        const mixer = this as any, states = this.getBindingStates();
        for (let i = 0; i < mixer._nActiveBindings; i++) {
            const binding = mixer._bindings[i], state = states[i];
            if (!state || !state.wasFast) continue;
            copyPrevious(state, binding.buffer, binding.valueSize, binding.valueSize);
            copyPrevious(state, binding.buffer, binding.valueSize * 2, binding.valueSize);
            state.wasFast = false;
        }
    }

    public update(deltaTime: number): this {
        const mixer = this as any, actions = mixer._actions, count = mixer._nActiveActions;
        const frame = ++this.frame;
        let fast = !mixer._listeners?.loop?.length;

        for (let i = 0; i < count; i++) {
            const action = actions[i];
            if (!action.enabled || this.suspendedRoots.has(action.getRoot())) continue;
            if (!fast || action.loop !== LoopRepeat || action.repetitions !== Infinity) { fast = false; break; }
            const state = this.getActionState(action), root = state.root;
            if (root.frame !== frame) { root.frame = frame; root.count = 0; }
            root.count++;
            if (action.weight !== 1 || action._startTime !== null || action._weightInterpolant !== null || action._timeScaleInterpolant !== null || action.blendMode !== NormalAnimationBlendMode) root.count++;
        }

        if (!fast) {
            this.resetBindings();
        }

        deltaTime *= this.timeScale;
        const time = this.time += deltaTime, direction = Math.sign(deltaTime), accuIndex = mixer._accuIndex ^= 1;

        for (let i = 0; i < count; i++) {
            const action = actions[i], state = action.enabled ? this.getActionState(action) : null;
            if (this.suspendedRoots.has(action.getRoot())) continue;
            if (!fast || !state || !state.channels || state.root.count !== 1) { action._update(time, deltaTime, direction, accuIndex); continue; }
            const clipTime = action._updateTime(deltaTime * action._updateTimeScale(time));
            action._updateWeight(time);
            const weight1 = clipTime / action.getClip().duration, weight0 = 1 - weight1;
            for (let j = 0; j < state.channels.length; j++) {
                const channel = state.channels[j];
                if (channel.linearConstant && weight1 > 0 && weight1 < 1) {
                    const value = channel.constant, target = channel.interpolant.resultBuffer;
                    target[0] = value[0] * weight0 + value[0] * weight1;
                    target[1] = value[1] * weight0 + value[1] * weight1;
                    target[2] = value[2] * weight0 + value[2] * weight1;
                    channel.binding.value = target;
                } else channel.binding.value = channel.constant || channel.interpolant.evaluate(clipTime);
                channel.binding.frame = frame;
            }
        }

        const states = this.getBindingStates();
        for (let i = 0; i < mixer._nActiveBindings; i++) {
            const binding = mixer._bindings[i], state = states[i];
            if (this.suspendedRoots.has(binding.binding.rootNode)) continue;
            if (!state || state.frame !== frame) {
                if (state && state.wasFast) {
                    copyPrevious(state, binding.buffer, (2 - accuIndex) * binding.valueSize, binding.valueSize);
                    state.wasFast = false;
                }
                binding.apply(accuIndex);
                continue;
            }

            const property = state.property, value = state.value, size = binding.valueSize;
            if (!state.wasFast) {
                const offset = (2 - accuIndex) * size;
                state.x = binding.buffer[offset]; state.y = binding.buffer[offset + 1]; state.z = binding.buffer[offset + 2];
                if (size === 4) state.w = binding.buffer[offset + 3];
            }
            if (state.x !== value[0] || state.y !== value[1] || state.z !== value[2] || size === 4 && state.w !== value[3]) {
                property.fromArray(value);
                state.target.matrixWorldNeedsUpdate = true;
                state.x = value[0]; state.y = value[1]; state.z = value[2];
                if (size === 4) state.w = value[3];
            }
            state.wasFast = true;
        }

        return this;
    }
}

export default SkeletalAnimationMixer;
