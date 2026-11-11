import { AnimationMixer, AnimationAction, KeyframeTrack, Object3D, NormalAnimationBlendMode, AdditiveAnimationBlendMode, InterpolateLinear, LinearInterpolant, Quaternion, QuaternionLinearInterpolant } from "three";

type RootState_T = { object: Object3D, skeleton: ClipPosed_T, poseRequirements: PoseRequirements_T, frame: number, count: number, checkedFrame: number, deferredFrame: number, appliedFrame: number, activeBindings: number, constantState: ActionState_T, constantFrame: number, constantVersion: number, fastActions: any[], fastTimes: number[], slowActions: any[], bindingCount: number, bindingVersion: number, bindings: any[], bindingStates: BindingState_T[], lazyFrame: number, lazyActions: ActionState_T[], lazyTimes: number[], lazySlowActions: any[], lazySlowTimes: number[], lazySlowWeights: number[] };
type PoseRequirements_T = { version: number };
type BindingState_T = { root: RootState_T, target: Object3D, frame: number, wasFast: boolean, isLazyBone: boolean, lazyVersion: number };
type TrackResult_T = { frame: number, time: number, value: ArrayLike<number> };
type ChannelState_T = { binding: BindingState_T, property: any, track: KeyframeTrack, interpolant: any, constant: Float32Array, result: TrackResult_T, kind: number, index: number };
type ActionState_T = { root: RootState_T, channels: ChannelState_T[], activeChannels: ChannelState_T[], varyingChannels: ChannelState_T[], activeVersion: number, clipPose: ClipPose_T };

export type ClipPose_T = { tracks: { bone: Object3D, track: KeyframeTrack, isQuaternion: boolean }[], framerate: number, lastFrame: number };
type ClipPosed_T = { setClipPose(clipPose: ClipPose_T, clipTime: number): void, clearClipPose(): void };

const cacheDeferredRoots = new WeakMap<Object3D, SkeletalAnimationMixer>();
const cachePoseRequirements = new WeakMap<Object3D, PoseRequirements_T>();

function getPoseRequirements(object: Object3D): PoseRequirements_T {
    let requirements = cachePoseRequirements.get(object);
    if (!requirements) cachePoseRequirements.set(object, requirements = { version: 0 });
    return requirements;
}

export function invalidatePoseRequirements(object: Object3D): void { getPoseRequirements(object).version++; }

function isLazyBone(state: BindingState_T): boolean { // cached so the binding pass never touches the bones themselves
    const poseRequirementVersion = state.root.poseRequirements.version;
    if (state.lazyVersion !== poseRequirementVersion) {
        state.isLazyBone = (state.target as any).isPoseRequired === false;
        state.lazyVersion = poseRequirementVersion;
    }

    return state.isLazyBone;
}

function evaluateTrack(channel: ChannelState_T, t: number): ArrayLike<number> { // Interpolant.evaluate + LinearInterpolant/QuaternionLinearInterpolant.interpolate_ with the same arithmetic, minus the generic seek
    const interpolant = channel.interpolant;

    if (channel.kind === 0) return interpolant.evaluate(t);

    const times = interpolant.parameterPositions, values = interpolant.sampleValues, stride = interpolant.valueSize, result = interpolant.resultBuffer, last = times.length - 1;

    if (t < times[0] || t >= times[last]) {
        const offset = t < times[0] ? 0 : last * stride;

        for (let i = 0; i !== stride; ++i) result[i] = values[offset + i];
        return result;
    }

    let i1 = channel.index;

    if (i1 < 1 || i1 > last) i1 = 1;
    while (t >= times[i1]) i1++;
    while (t < times[i1 - 1]) i1--;
    channel.index = i1;

    const t0 = times[i1 - 1], t1 = times[i1];

    if (channel.kind === 1) {
        const offset1 = i1 * stride, offset0 = offset1 - stride, weight1 = (t - t0) / (t1 - t0), weight0 = 1 - weight1;

        for (let i = 0; i !== stride; ++i) result[i] = values[offset0 + i] * weight0 + values[offset1 + i] * weight1;
        return result;
    }

    const alpha = (t - t0) / (t1 - t0);

    for (let offset = i1 * stride, end = offset + stride; offset !== end; offset += 4) Quaternion.slerpFlat(result, 0, values, offset - stride, values, offset, alpha);
    return result;
}

function isRendered(object: Object3D): boolean {
    for (; object; object = object.parent) {
        if (!object.visible) return false;
        if ((object as any).isScene) return true;
    }

    return false;
}

function advanceAction(action: any, time: number, deltaTime: number, direction: number): void {
    if (!action.enabled) {
        action._updateWeight(time);
        return;
    }

    if (action._startTime !== null) {
        const timeRunning = (time - action._startTime) * direction;

        if (timeRunning < 0 || direction === 0) deltaTime = 0;
        else {
            action._startTime = null;
            deltaTime = direction * timeRunning;
        }
    }

    action._updateTime(deltaTime * action._updateTimeScale(time));
    action._updateWeight(time);
}

export function evaluateDeferredPose(object: Object3D, all: boolean = false): void {
    const mixer = cacheDeferredRoots.get(object);

    if (mixer) mixer.evaluateRoot(object, all);
}

function isLazy(binding: any, state: BindingState_T, frame: number): boolean { // anything accumulated this frame still has to be applied
    return !!state && state.frame !== frame && state.root.lazyFrame === frame && binding.cumulativeWeight === 0 && binding.cumulativeWeightAdditive === 0 && isLazyBone(state);
}

export class SkeletalAnimationMixer extends AnimationMixer {
    protected readonly suspendedRoots = new WeakMap<Object3D, number>();
    protected readonly rootStates = new WeakMap<Object3D, RootState_T>();
    protected readonly actionStates = new WeakMap<AnimationAction, ActionState_T>();
    protected readonly bindingStates = new WeakMap<object, BindingState_T>();
    protected readonly constantTracks = new WeakMap<KeyframeTrack, Float32Array>();
    protected readonly trackResults = new WeakMap<KeyframeTrack, TrackResult_T>();
    protected readonly arrBindingStates: BindingState_T[] = [];
    protected readonly arrBindingRootEnds: number[] = [];
    protected readonly arrDeferredRoots: RootState_T[] = [];
    protected readonly arrFastActions: AnimationAction[] = [];
    protected readonly arrFastTimes: number[] = [];
    protected bindingVersion: number = 0;
    protected cachedBindingVersion: number = -1;
    protected frame: number = 0;
    protected direction: number = 0;

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
        if (!rootState) this.rootStates.set(root, rootState = { object: root, skeleton: (root as any).skeleton && (root as any).skeleton.setClipPose ? (root as any).skeleton : null, poseRequirements: getPoseRequirements(root), frame: -1, count: 0, checkedFrame: -1, deferredFrame: -1, appliedFrame: -1, activeBindings: 0, constantState: null, constantFrame: -1, constantVersion: -1, fastActions: [], fastTimes: [], slowActions: [], bindingCount: 0, bindingVersion: -1, bindings: [], bindingStates: [], lazyFrame: -1, lazyActions: [], lazyTimes: [], lazySlowActions: [], lazySlowTimes: [], lazySlowWeights: [] });
        const channels: ChannelState_T[] = [], tracks = action.getClip().tracks;

        for (let i = 0; i < tracks.length; i++) {
            const mixer = (action as any)._propertyBindings[i], binding = mixer.binding;
            const property = binding.resolvedProperty;
            if (!binding.node || !binding.node.isBone || !property || !(property.isVector3 || property.isQuaternion)) {
                state = { root: rootState, channels: null, activeChannels: null, varyingChannels: null, activeVersion: -1, clipPose: null };
                this.actionStates.set(action, state);
                return state;
            }

            let target = this.bindingStates.get(mixer);
            if (!target) {
                this.bindingStates.set(mixer, target = { root: rootState, target: binding.targetObject, frame: -1, wasFast: false, isLazyBone: false, lazyVersion: -1 });
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
            if (track.getInterpolation() !== InterpolateLinear) constant = null;
            let result = this.trackResults.get(track);
            if (!result) this.trackResults.set(track, result = { frame: -1, time: 0, value: null });
            const interpolant = (action as any)._interpolants[i];
            const kind = interpolant.constructor === LinearInterpolant ? 1 : interpolant.constructor === QuaternionLinearInterpolant ? 2 : 0;
            channels.push({ binding: target, property, track, interpolant, constant, result, kind, index: 1 });
        }

        const clip = action.getClip() as any, lastFrame = Math.round(clip.duration * clip.framerate);
        const isSampled = clip.framerate > 0 && Math.abs(clip.duration * clip.framerate - lastFrame) < 1e-3 && channels.every(channel => channel.constant || channel.kind !== 0 && (channel.property === channel.binding.target.position || channel.property === channel.binding.target.quaternion) && channel.track.times.every(time => {
            const frame = time * clip.framerate;
            return frame >= 0 && frame <= lastFrame + 1e-3 && Math.abs(frame - Math.round(frame)) < 1e-3;
        }));

        state = { root: rootState, channels, activeChannels: null, varyingChannels: null, activeVersion: -1, clipPose: !isSampled ? null : { tracks: channels.filter(channel => !channel.constant).map(channel => ({ bone: channel.binding.target, track: channel.track, isQuaternion: channel.kind === 2 })), framerate: clip.framerate, lastFrame } };
        this.actionStates.set(action, state);
        return state;
    }

    protected getBindingStates(): BindingState_T[] {
        const mixer = this as any;
        if (this.cachedBindingVersion !== this.bindingVersion) {
            this.arrBindingStates.length = mixer._nActiveBindings;
            this.arrBindingRootEnds.length = mixer._nActiveBindings;
            for (let i = 0; i < mixer._nActiveBindings; i++) {
                const root = this.rootStates.get(mixer._bindings[i].binding.rootNode);
                if (root) root.activeBindings = 0;
            }
            for (let i = mixer._nActiveBindings - 1, end = mixer._nActiveBindings; i >= 0; i--) {
                const root = this.rootStates.get(mixer._bindings[i].binding.rootNode);
                if (root) root.activeBindings++;
                this.arrBindingStates[i] = this.bindingStates.get(mixer._bindings[i]);
                this.arrBindingRootEnds[i] = end;
                if (i > 0 && mixer._bindings[i - 1].binding.rootNode !== mixer._bindings[i].binding.rootNode) end = i;
            }
            this.cachedBindingVersion = this.bindingVersion;
        }
        return this.arrBindingStates;
    }

    protected resetBindings(): void {
        const mixer = this as any, states = this.getBindingStates();
        for (let i = 0; i < mixer._nActiveBindings; i++) {
            const binding = mixer._bindings[i], state = states[i];
            if (!state || !state.wasFast) continue;
            binding.binding.getValue(binding.buffer, binding.valueSize);
            binding.binding.getValue(binding.buffer, binding.valueSize * 2);
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
            if (!fast) break;
            const state = this.getActionState(action), root = state.root;
            if (root.frame !== frame) { root.frame = frame; root.count = 0; }
            root.count++;
            if (action.weight !== 1 || action._startTime !== null || action._weightInterpolant !== null || action._timeScaleInterpolant !== null || action.blendMode !== NormalAnimationBlendMode) root.count++;
        }

        if (!fast) {
            this.resetBindings();
        }

        this.getBindingStates();
        deltaTime *= this.timeScale;
        const bindingVersion = this.bindingVersion;
        const time = this.time += deltaTime, direction = this.direction = Math.sign(deltaTime), accuIndex = mixer._accuIndex ^= 1;

        for (let i = 0; i < count; i++) {
            const action = actions[i], object = action.getRoot(), state = action.enabled ? this.getActionState(action) : null;
            if (this.suspendedRoots.has(object)) continue;
            const isFast = fast && state && state.channels && state.root.count === 1;

            if (state && state.root.checkedFrame !== frame) {
                const root = state.root;
                root.checkedFrame = frame;
                if (!isRendered(object)) { // UE2 poses a skeletal mesh in GetFrame when it is drawn or a bone is asked for, animation time still ticks
                    root.deferredFrame = frame;
                    this.arrDeferredRoots.push(root);
                    root.fastActions.length = 0; root.fastTimes.length = 0; root.slowActions.length = 0; root.bindingCount = 0;
                    cacheDeferredRoots.set(object, this);
                }
            }

            if (!isFast) {
                if (state && state.root.skeleton) state.root.skeleton.clearClipPose();
                if (state && state.root.deferredFrame === frame) {
                    advanceAction(action, time, deltaTime, direction);
                    state.root.slowActions.push(action);
                } else if (state && state.channels) this.updateSlowAction(action, state, time, deltaTime, direction, accuIndex, frame);
                else action._update(time, deltaTime, direction, accuIndex);
                continue;
            }

            const clipTime = action._updateTime(deltaTime * action._updateTimeScale(time));
            if (action._updateWeight(time) === 0) continue; // a non-looping action that finished this frame disables itself before accumulating
            if (state.root.deferredFrame === frame) {
                state.root.fastActions.push(action);
                state.root.fastTimes.push(clipTime);
            } else {
                this.arrFastActions.push(action);
                this.arrFastTimes.push(clipTime);
            }
        }

        for (let i = 0; i < this.arrFastActions.length; i++) {
            const action = this.arrFastActions[i];

            if (action.isScheduled()) this.evaluateChannels(this.getActionState(action), this.arrFastTimes[i], frame);
        }
        this.arrFastActions.length = 0;
        this.arrFastTimes.length = 0;

        const states = this.getBindingStates(), canSkip = bindingVersion === this.bindingVersion; // a listener may have lent bindings mid-loop
        for (let i = 0; i < mixer._nActiveBindings; i++) {
            const binding = mixer._bindings[i], state = states[i], root = state ? state.root : this.rootStates.get(binding.binding.rootNode);
            if (root && root.deferredFrame === frame) {
                if (root.bindingVersion === this.bindingVersion) {
                    i = this.arrBindingRootEnds[i] - 1;
                    continue;
                }
                const index = root.bindingCount++;
                root.bindings[index] = binding;
                root.bindingStates[index] = state;
            } else if (canSkip && root && root.appliedFrame === frame) i = this.arrBindingRootEnds[i] - 1;
            else if (!isLazy(binding, state, frame)) this.applyBinding(binding, state, frame, accuIndex);
        }

        for (const root of this.arrDeferredRoots) {
            if (root.bindingVersion === this.bindingVersion) continue;
            root.bindingVersion = this.bindingVersion;
            root.bindings.length = root.bindingCount;
            root.bindingStates.length = root.bindingCount;
        }
        this.arrDeferredRoots.length = 0;

        return this;
    }

    public evaluateRoot(object: Object3D, all: boolean): void {
        const root = this.rootStates.get(object), frame = this.frame, accuIndex = (this as any)._accuIndex;

        if (!root) return;

        if (root.deferredFrame === frame) {
            root.deferredFrame = -1;

            for (let i = 0; i < root.fastActions.length; i++) {
                const action = root.fastActions[i];
                this.evaluateChannels(this.getActionState(action), root.fastTimes[i], frame);
            }
            for (let i = 0; i < root.slowActions.length; i++) root.slowActions[i]._update(this.time, 0, this.direction, accuIndex);
            for (let i = 0; i < root.bindings.length; i++)
                if (!isLazy(root.bindings[i], root.bindingStates[i], frame)) this.applyBinding(root.bindings[i], root.bindingStates[i], frame, accuIndex);
        }

        if (all && root.lazyFrame === frame) {
            const mixer = this as any, states = this.getBindingStates();

            for (let i = 0; i < root.lazyActions.length; i++) {
                const channels = root.lazyActions[i].channels, clipTime = root.lazyTimes[i];

                for (let j = 0; j < channels.length; j++)
                    if (isLazyBone(channels[j].binding)) this.evaluateChannel(channels[j], clipTime, frame);
            }
            for (let i = 0; i < root.lazySlowActions.length; i++) {
                const action = root.lazySlowActions[i], channels = this.getActionState(action).channels, clipTime = root.lazySlowTimes[i], weight = root.lazySlowWeights[i];

                for (let j = 0; j < channels.length; j++) {
                    if (!isLazyBone(channels[j].binding)) continue;
                    action._interpolants[j].evaluate(clipTime);
                    if (action.blendMode === AdditiveAnimationBlendMode) action._propertyBindings[j].accumulateAdditive(weight);
                    else action._propertyBindings[j].accumulate(accuIndex, weight);
                }
            }

            root.lazyFrame = -1;
            for (let i = 0; i < mixer._nActiveBindings; i++) {
                if (mixer._bindings[i].binding.rootNode !== object) {
                    i = this.arrBindingRootEnds[i] - 1;
                    continue;
                }
                const state = states[i];
                if (state && state.root === root && isLazyBone(state)) this.applyBinding(mixer._bindings[i], state, frame, accuIndex);
            }
        }

        if (root.deferredFrame !== frame && root.lazyFrame !== frame) cacheDeferredRoots.delete(object);
    }

    protected evaluateChannels(state: ActionState_T, clipTime: number, frame: number): void {
        const root = state.root, poseRequirements = root.poseRequirements;
        const isComplete = this.cachedBindingVersion === this.bindingVersion && state.channels.length === root.activeBindings;
        const isSteady = isComplete && state.activeVersion === poseRequirements.version && root.constantState === state && root.constantFrame === frame - 1 && root.constantVersion === this.bindingVersion;

        if (root.skeleton) {
            if (isSteady && state.clipPose) root.skeleton.setClipPose(state.clipPose, clipTime);
            else root.skeleton.clearClipPose();
        }
        if (state.activeVersion !== poseRequirements.version) {
            state.activeChannels = state.channels.filter(channel => !isLazyBone(channel.binding)); // bones that skin nothing are posed only when something asks for them
            state.varyingChannels = state.activeChannels.filter(channel => !channel.constant);
            state.activeVersion = poseRequirements.version;
        }

        if (isSteady) {
            const channels = state.varyingChannels;

            for (let j = 0; j < channels.length; j++) channels[j].property.fromArray(this.getChannelValue(channels[j], clipTime, frame));
        } else {
            const channels = state.activeChannels;

            for (let j = 0; j < channels.length; j++) this.evaluateChannel(channels[j], clipTime, frame);
        }

        if (isComplete) {
            root.appliedFrame = frame;
            root.constantState = state;
            root.constantFrame = frame;
            root.constantVersion = this.bindingVersion;
        }
        if (state.activeChannels.length === state.channels.length) return;
        this.markLazy(root, frame);
        root.lazyActions.push(state);
        root.lazyTimes.push(clipTime);
    }

    protected updateSlowAction(action: any, state: ActionState_T, time: number, deltaTime: number, direction: number, accuIndex: number, frame: number): void { // AnimationAction._update without the lazy bones
        if (action._startTime !== null) {
            const timeRunning = (time - action._startTime) * direction;

            if (timeRunning < 0 || direction === 0) deltaTime = 0;
            else {
                action._startTime = null;
                deltaTime = direction * timeRunning;
            }
        }

        const clipTime = action._updateTime(deltaTime * action._updateTimeScale(time));
        const weight = action._updateWeight(time);

        if (weight <= 0) return;

        const channels = state.channels, interpolants = action._interpolants, bindings = action._propertyBindings, isAdditive = action.blendMode === AdditiveAnimationBlendMode;
        let hasLazy = false;

        for (let j = 0; j < channels.length; j++) {
            if (isLazyBone(channels[j].binding)) { hasLazy = true; continue; }
            interpolants[j].evaluate(clipTime);
            if (isAdditive) bindings[j].accumulateAdditive(weight);
            else bindings[j].accumulate(accuIndex, weight);
        }

        if (!hasLazy) return;
        this.markLazy(state.root, frame);
        state.root.lazySlowActions.push(action);
        state.root.lazySlowTimes.push(clipTime);
        state.root.lazySlowWeights.push(weight);
    }

    protected markLazy(root: RootState_T, frame: number): void {
        if (root.lazyFrame === frame) return;

        root.lazyFrame = frame;
        root.lazyActions.length = 0; root.lazyTimes.length = 0;
        root.lazySlowActions.length = 0; root.lazySlowTimes.length = 0; root.lazySlowWeights.length = 0;
        cacheDeferredRoots.set(root.object, this);
    }

    protected getChannelValue(channel: ChannelState_T, clipTime: number, frame: number): ArrayLike<number> {
        if (channel.constant) return channel.constant;

        const result = channel.result; // parts of one pawn and synced idles share clips, so most tracks repeat a (track, time) pair
        if (result.frame !== frame || result.time !== clipTime) { result.frame = frame; result.time = clipTime; result.value = evaluateTrack(channel, clipTime); }
        return result.value;
    }

    protected evaluateChannel(channel: ChannelState_T, clipTime: number, frame: number): void {
        const state = channel.binding;

        state.frame = frame;
        state.wasFast = true;
        channel.property.fromArray(this.getChannelValue(channel, clipTime, frame));
    }

    protected applyBinding(binding: any, state: BindingState_T, frame: number, accuIndex: number): void {
        if (state && (state.frame === frame || state.wasFast && state.root.appliedFrame === frame)) return;
        if (this.suspendedRoots.has(binding.binding.rootNode)) return;
        if (state && state.wasFast) {
            binding.binding.getValue(binding.buffer, (2 - accuIndex) * binding.valueSize); // the mixer compares against the last applied value, which the fast path never stored
            state.wasFast = false;
        }
        binding.apply(accuIndex);
    }
}

export default SkeletalAnimationMixer;
