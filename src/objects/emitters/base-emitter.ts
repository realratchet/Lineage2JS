import { Box3, Object3D, Vector3, Vector4 } from "three";
import { clamp, lerp, mapLinear } from "three/src/math/MathUtils";

abstract class BaseEmitter extends Object3D {
    protected readonly isUpdatable = true;

    protected fadingSettings: FadeSettings_T;
    protected generalSettings: { colorMultiplierRange: Range3_T, opacity: number, maxParticles: number; acceleration: Vector3; lifetime: Range_T; particlesPerSecond: number };
    protected initialSettings: { particlesPerSecond: number, position: { min: Vector3; max: Vector3; }, scale: { min: Vector3; max: Vector3; }; velocity: { min: Vector3; max: Vector3; }; angularVelocity: { min: Vector3; max: Vector3; }; };
    protected changesOverLifetimeSettings: ChangesOverTime_T;

    protected particlePool: Array<Particle>;

    protected currentTime: number;
    protected lastSpawned: number;

    public getCurrentTime() { return this.currentTime; }

    constructor(config: EmitterConfig_T) {
        super();

        this.fadingSettings = {
            fadeIn: config.fadeIn ? { time: config.fadeIn.time * 1000, color: new Vector4().fromArray(config.fadeIn.color || [1, 1, 1, 1]) } : null,
            fadeOut: config.fadeOut ? { time: config.fadeOut.time * 1000, color: new Vector4().fromArray(config.fadeOut.color || [1, 1, 1, 1]) } : null
        };

        this.generalSettings = {
            colorMultiplierRange: { min: new Vector3().fromArray(config.colorMultiplierRange?.min || [1, 1, 1]), max: new Vector3().fromArray(config.colorMultiplierRange?.max || [1, 1, 1]) },
            opacity: config.opacity || 1,
            maxParticles: 2 || config.maxParticles,
            acceleration: new Vector3().fromArray(config.acceleration || [0, 0, 0]),
            lifetime: { min: config.lifetime[0] * 1000, max: config.lifetime[1] * 1000 },
            particlesPerSecond: config.particlesPerSecond || 0
        };

        this.changesOverLifetimeSettings = {
            scale: buildChangeRanges(config.changesOverLifetime.scale)
        };

        this.initialSettings = {
            particlesPerSecond: config.initial.particlesPerSecond || 0,
            scale: {
                min: new Vector3().fromArray(config.initial.scale?.min || [1, 1, 1]),
                max: new Vector3().fromArray(config.initial.scale?.max || [1, 1, 1])
            },
            velocity: {
                min: new Vector3().fromArray(config.initial.velocity?.min || [1, 1, 1]),
                max: new Vector3().fromArray(config.initial.velocity?.max || [1, 1, 1])
            },
            position: {
                min: new Vector3().fromArray(config.initial.position?.min || [0, 0, 0]),
                max: new Vector3().fromArray(config.initial.position?.max || [0, 0, 0])
            },
            angularVelocity: {
                min: new Vector3().fromArray(config.initial.angularVelocity?.min || [1, 1, 1]),
                max: new Vector3().fromArray(config.initial.angularVelocity?.max || [1, 1, 1])
            }
        };

        Object.assign(this, config.allSettings);

        this.activeParticles = 0;
        this.particleIndex = 0;
        this.allParticlesDead = false;
        this.warmedUp = false;

        this.maxActiveParticles = this.maxParticles;

        // debugger;

        this.initSettings(config);

        this.particlePool = new Array(config.maxParticles);

        // console.log(this.generalSettings.acceleration);
        console.log(config);

        for (let i = 0; i < config.maxParticles; i++) {
            const particle = this.particlePool[i] = Particle.init(this, this.initParticleMesh());

            this.add(particle);
        }
    }

    protected warmedUp: boolean;
    protected maxParticles: number;
    protected boundingBox = new Box3();
    protected addLocationFromOtherEmitter: number;
    protected addVelocityFromOtherEmitter: number;
    protected spawnFromOtherEmitter: number;
    protected rotateVelocityLossRange: boolean;
    protected realVelocityLossRange: Range3_T;
    protected velocityLossRange: Range3_T;
    protected UseRotationFrom: any;

    protected RVLMin: THREE.Vector3;
    protected RVLMax: THREE.Vector3;
    protected RotationOffset: any;
    protected RotationNormal: any;

    protected SkeletalMeshActor: any;
    protected UseSkeletalLocationAs: any;

    protected activeParticles: number = 0;
    protected maxActiveParticles: number;
    protected isAutomaticInitialSpawning: boolean;

    protected LifetimeRange: any;
    protected initialParticlesPerSecond: number;
    protected particlesPerSecond: number;

    protected currentSpawnOnTrigger: number;
    protected spawnOnTriggerPPS: number;

    protected killPending: boolean = false;

    protected ppsFraction: number;

    protected deferredParticles: number = 0;
    protected particleIndex: number;

    protected CoordinateSystem: any;
    protected Particles: THREE.Object3D[];

    protected RespawnDeadParticles: boolean;
    protected InitialTimeRange: Range_T;

    protected Acceleration: THREE.Vector3;
    protected SkeletalScale: THREE.Vector3;
    protected MeshVertsAndNormals: THREE.Vector3[];

    protected UseRevolution: boolean;
    protected UseCollision: boolean;
    protected RealExtentMultiplier: any;

    protected UseCollisionPlanes: boolean;
    protected CollisionPlanes: THREE.Vector4[];

    protected CollisionSound: any;
    protected CurrentCollisionSoundIndex: number;
    protected CollisionSoundIndex: Range_T;

    protected SpawnAmount: number;

    protected Sounds: any[];
    protected CollisionSoundProbability: Range3_T;

    protected UseSpawnedVelocityScale: boolean;
    protected SpawnedVelocityScaleRange: Range3_T;

    protected UseMaxCollisions: boolean;
    protected MaxCollisions: Range_T;

    protected DampingFactorRange: Range3_T;

    protected DampRotation: boolean;
    protected RotationDampingFactorRange: Range3_T;

    protected UseSizeScale: boolean;
    protected UseRegularSizeScale: boolean;
    protected UseAbsoluteTimeForSizeScale: boolean;
    protected SizeScaleRepeats: number;

    protected SizeScale: any[];

    protected UseVelocityScale: boolean;
    protected VelocityScaleRepeats: number;

    protected VelocityScale: any[];

    protected ScaleSizeXByVelocity: boolean;
    protected ScaleSizeYByVelocity: boolean;
    protected ScaleSizeZByVelocity: boolean;

    protected ScaleSizeByVelocityMultiplier: Vector3;

    protected DetermineVelocityByLocationDifference: boolean;

    protected UseRevolutionScale: boolean;
    protected RevolutionScaleRepeats: number;

    protected RevolutionScale: any[];

    protected UseColorScale: boolean;
    protected ColorScaleRepeats: number;

    protected ColorScale: any[];
    protected DrawStyle: any;

    protected FadeOut: boolean;
    protected FadeOutStartTime: number;
    protected FadeOutFactor: number;

    protected FadeIn: boolean;
    protected FadeInEndTime: number;
    protected FadeInFactor: number;

    protected FadeFactor: number;
    protected Opacity: number;

    protected MaxAbsVelocity: THREE.Vector3;
    protected MinSquaredVelocity: number;
    protected MaxSizeScale: number;

    protected allParticlesDead: boolean;

    protected spawnParticles(oldLeftover: number, rate: number, deltaTime: number) {
        const Owner = this.parent;

        if (rate <= 0 || !Owner)
            return 0;

        let newLeftover = oldLeftover + deltaTime * rate;
        let spawnCount = Math.trunc(newLeftover);

        newLeftover = newLeftover - spawnCount;

        const increment = 1 / rate;
        const startTime = deltaTime + oldLeftover * increment - increment;

        spawnCount = clamp(spawnCount, 0, this.maxActiveParticles);
        if (this.currentSpawnOnTrigger) {
            spawnCount = clamp(spawnCount, 0, this.currentSpawnOnTrigger);
            this.currentSpawnOnTrigger -= spawnCount;
        }

        const oldLocation = () => Owner.position;

        let percent;
        const shouldInterpolate = oldLocation().distanceTo(Owner.position) > 1;

        for (let i = 0; i < spawnCount; i++) {
            __break__();
            this.spawnParticle(this.particleIndex, startTime - i * increment, PTF_InitialSpawn);

            // Laurent -- location interpolation
            if (shouldInterpolate && this.CoordinateSystem === PTCS_Independent) {
                percent = 1 - (i + 1) / spawnCount;
                //debugf(TEXT("OwnerLocation - PI: %i P:%f LT:%f"), i, Percent, Owner->Level->TimeSeconds);
                this.Particles[this.particleIndex].position.add((oldLocation().clone().sub(Owner.position)).multiplyScalar(percent));
            }

            this.activeParticles = Math.max(this.activeParticles, this.particleIndex + 1);
            throw new Error("++ParticleIndex %= MaxActiveParticles;");
        }

        return newLeftover;
    }

    protected spawnParticle( Index: number, SpawnTime: number, Flags: number = 0, SpawnFlags: number = 0, LocalLocationOffset = new Vector3(0,0,0) ) {
        if( !MaxParticles || !Owner || KillPending || (LifetimeRange.Max <= 0) )
		return;

	FParticle& Particle = Particles(Index);

	Particle.Location	= StartLocationOffset;
	Particle.Velocity	= StartVelocityRange.GetRand();

	// Handle Shape.
	UBOOL ApplyAll = StartLocationShape == PTLS_All;
	if( ApplyAll || StartLocationShape == PTLS_Box )
		Particle.Location += StartLocationRange.GetRand();
	if( ApplyAll || StartLocationShape == PTLS_Sphere )
		Particle.Location += SphereRadiusRange.GetRand() * RandomNormal();
	if( ApplyAll || StartLocationShape == PTLS_Polar )	
	{
		FVector Polar = StartLocationPolarRange.GetRand();
		FLOAT X,Y,Z;
		X = Polar.Z * GMath.CosFloat(Polar.X * PI/32768.f)*GMath.SinFloat(Polar.Y * PI/32768.f);
		Y = Polar.Z * GMath.SinFloat(Polar.X * PI/32768.f)*GMath.SinFloat(Polar.Y * PI/32768.f);
		Z = Polar.Z * GMath.CosFloat(Polar.Y * PI/32768.f);
		Particle.Location += FVector(X,Y,Z);
	}

	// Handle spawning from mesh.
	Particle.ColorMultiplier = FVector(1.f,1.f,1.f);
	if( (MeshSpawning != PTMS_None) && MeshSpawningStaticMesh )
	{
		guard(MeshSpawning);
		INT MaxIndex = MeshSpawningStaticMesh->VertexStream.Vertices.Num();
		if( MaxIndex > 0 )
		{
			INT VertexIndex = (MeshSpawning == PTMS_Linear) ? CurrentMeshSpawningIndex++ : (appTrunc(appSRand() * MaxIndex));
			VertexIndex %= MaxIndex;
			VertexIndex = Clamp<INT>( VertexIndex, 0, MaxIndex );

			if( SpawnOnlyInDirectionOfNormal )
			{
				FVector Normal = MeshSpawningStaticMesh->VertexStream.Vertices(VertexIndex).Normal;	
				if( (Normal | RealMeshNormal) < (1.f - 2.f * MeshNormalThresholdRange.GetRand()) ) 
				{	
					Particle.Flags &= ~PTF_Active;
					return;
				}
			}

			FVector LocationScale = MeshScaleRange.GetRand();
			FVector Location = MeshSpawningStaticMesh->VertexStream.Vertices(VertexIndex).Position;	
			Particle.Location += UniformMeshScale ? Location * LocationScale.X : Location * LocationScale;

			if( VelocityFromMesh )
			{
				FVector VelocityScale = VelocityScaleRange.GetRand();
				FVector Velocity = MeshSpawningStaticMesh->VertexStream.Vertices(VertexIndex).Normal;	
				Particle.Velocity += UniformVelocityScale ? Velocity * VelocityScale.X : Velocity * VelocityScale;
			}

			if( UseColorFromMesh )
			{
				FColor Color = MeshSpawningStaticMesh->ColorStream.Colors(VertexIndex);
				Particle.ColorMultiplier.X = Color.R / 255.f;
				Particle.ColorMultiplier.Y = Color.G / 255.f;
				Particle.ColorMultiplier.Z = Color.B / 255.f;
			}
		}
		unguard;
	}

	// Handle Skeletal mesh spawning.
	INT NumBones = MeshVertsAndNormals.Num() / 2;
	if( UseSkeletalLocationAs != PTSU_None && NumBones )
	{		
		Particle.BoneIndex = Clamp<INT>(appTrunc(RelativeBoneIndexRange.GetRand() * NumBones), 0.f, NumBones - 1);	
		Particle.OldMeshLocation = MeshVertsAndNormals( Particle.BoneIndex * 2 ) * SkeletalScale;
		Particle.Location += Particle.OldMeshLocation;
	}


	OtherIndex++;
	if ( AddLocationFromOtherEmitter >= 0 )
	{
		UParticleEmitter* OtherEmitter = Owner->Emitters(AddLocationFromOtherEmitter);
		if (OtherEmitter->ActiveParticles > 0)
			Particle.Location += OtherEmitter->Particles(OtherIndex % OtherEmitter->ActiveParticles).Location - Owner->Location;
	}
		
	// Handle Rotation.
	switch ( UseRotationFrom )
	{
	case PTRS_Actor:
		Particle.Location = Particle.Location.TransformVectorBy(GMath.UnitCoords*Owner->Rotation*RotationOffset);
		break;
	case PTRS_Offset:
		Particle.Location = Particle.Location.TransformVectorBy(GMath.UnitCoords*RotationOffset);
		break;
	case PTRS_Normal:
		{
		FRotator Rotator  = RotationNormal.Rotation();
		// Map Z to -X if effect was created along the Z axis instead of negative X
		if ( EffectAxis == PTEA_PositiveZ )
			Rotator.Pitch -= 16384;
		Particle.Location = Particle.Location.TransformVectorBy(GMath.UnitCoords*Rotator);
		}
	default:
		break;
	}
	
	Particle.RevolutionCenter		= RevolutionCenterOffsetRange.GetRand();
	Particle.RevolutionsPerSecond	= RevolutionsPerSecondRange.GetRand();

	if( CoordinateSystem == PTCS_Independent )
	{
		if ( !(SpawnFlags & PSF_NoOwnerLocation) )
			Particle.Location += Owner->Location;// + SpawnTime * Owner->AbsoluteVelocity;	
		Particle.RevolutionCenter += Owner->Location;
	}

	if( !(SpawnFlags & PSF_NoGlobalOffset) )
		Particle.Location += GlobalOffset;

	Particle.Location	   += LocalLocationOffset;

	Particle.OldLocation	= Particle.Location;
	Particle.StartLocation	= Particle.Location;
	Particle.ColorMultiplier *= ColorMultiplierRange.GetRand();
	Particle.MaxLifetime	= LifetimeRange.GetRand();
	Particle.Time			= SpawnTime + InitialTimeRange.GetRand();
	Particle.HitCount		= 0;
	Particle.Flags			= PTF_Active | Flags;
	Particle.Mass			= StartMassRange.GetRand();
	Particle.StartSize		= StartSizeRange.GetRand();
	if ( UniformSize )
	{
		Particle.StartSize.Y = Particle.StartSize.X;
		Particle.StartSize.Z = Particle.StartSize.X;
	}
	Particle.Size			= Particle.StartSize;
	Particle.Velocity		+= Acceleration * SpawnTime;
	Particle.VelocityMultiplier		= FVector(1.f,1.f,1.f);
	Particle.RevolutionsMultiplier	= FVector(1.f,1.f,1.f);
	
	// Adjust velocity.
	switch ( UseRotationFrom )
	{
	case PTRS_Actor:
		Particle.Velocity	= Particle.Velocity.TransformVectorBy(GMath.UnitCoords*Owner->Rotation*RotationOffset);
		break;
	case PTRS_Offset:
		Particle.Velocity	= Particle.Velocity.TransformVectorBy(GMath.UnitCoords*RotationOffset);
		break;
	case PTRS_Normal:
		Particle.Velocity	= Particle.Velocity.TransformVectorBy(GMath.UnitCoords*RotationNormal.Rotation());
	default:
		break;
	}

	if( GetVelocityDirectionFrom != PTVD_None )
	{
		FVector Direction;

		if( CoordinateSystem == PTCS_Relative )
			Direction = Particle.Location.SafeNormal();
		else
			Direction = (Owner->Location - Particle.Location).SafeNormal();

		switch( GetVelocityDirectionFrom )
		{
		case PTVD_StartPositionAndOwner:
			Particle.Velocity = -Particle.Velocity * Direction;
			break;
		case PTVD_OwnerAndStartPosition:
			Particle.Velocity = Particle.Velocity * Direction;
			break;
		case PTVD_AddRadial:
			Particle.Velocity += StartVelocityRadialRange.GetRand() * Direction;
		default:
			break;
		}
	}

	if( AddVelocityFromOwner && CoordinateSystem != PTCS_Relative )
		Particle.Velocity += AddVelocityMultiplierRange.GetRand() * Owner->AbsoluteVelocity;

	if ( AddVelocityFromOtherEmitter >= 0 )
	{
		UParticleEmitter* OtherEmitter = Owner->Emitters(AddVelocityFromOtherEmitter);
		if (OtherEmitter->ActiveParticles > 0)
			Particle.Velocity += AddVelocityMultiplierRange.GetRand() * OtherEmitter->Particles(OtherIndex % OtherEmitter->ActiveParticles).Velocity;
	}

	// Location.
	Particle.Location += SpawnTime * Particle.Velocity;

	// Scale size by velocity.
	if( ScaleSizeXByVelocity || ScaleSizeYByVelocity || ScaleSizeZByVelocity )
	{
		FLOAT VelocitySize = Min( Particle.Velocity.Size(), ScaleSizeByVelocityMax );
		if( ScaleSizeXByVelocity )
			Particle.Size.X *= VelocitySize * ScaleSizeByVelocityMultiplier.X;
		if( ScaleSizeYByVelocity )
			Particle.Size.Y *= VelocitySize * ScaleSizeByVelocityMultiplier.Y;
		if( ScaleSizeZByVelocity )
			Particle.Size.Z *= VelocitySize * ScaleSizeByVelocityMultiplier.Z;
	}

	// Mass is stored as one over mass internally.
	if ( Particle.Mass )
		Particle.Mass = 1.f / Particle.Mass;
	
	Particle.StartSpin		= StartSpinRange.GetRand();
	Particle.SpinsPerSecond = SpinsPerSecondRange.GetRand();

	// Determine spin.
	if ( SpinCCWorCW.X > appFrand() )
		Particle.SpinsPerSecond.X *= -1;
	if ( SpinCCWorCW.Y > appFrand() )
		Particle.SpinsPerSecond.Y *= -1;
	if ( SpinCCWorCW.Z > appFrand() )
		Particle.SpinsPerSecond.Z *= -1;

	Particle.StartSpin		*= 0xFFFF;
	Particle.SpinsPerSecond *= 0xFFFF;

	if ( UseRandomSubdivision )
	{
		if ( SubdivisionEnd )
			Particle.Subdivision = appTrunc((SubdivisionEnd - SubdivisionStart) * appFrand() + SubdivisionStart);
		else
			Particle.Subdivision = appTrunc(appFrand() * TextureUSubdivisions * TextureVSubdivisions); 
	}
	else
		Particle.Subdivision = -1;

	if ( (Particle.Time > Particle.MaxLifetime) && Particle.MaxLifetime )
		SpawnParticle( Index, fmod(Particle.Time,Particle.MaxLifetime) );

	// Play sound on spawning.
	if( (SpawningSound != PTSC_None) && Owner->GetLevel()->Engine->Audio && Sounds.Num() )
	{
		INT SoundIndex = 0;
		switch ( SpawningSound )
		{
		case PTSC_LinearGlobal:
		case PTSC_LinearLocal:		
			SoundIndex = CurrentSpawningSoundIndex++;
			break;
		case PTSC_Random:
			SoundIndex = appTrunc(1000 * appSRand());
			break;
		}
			
		SoundIndex %= appTrunc(SpawningSoundIndex.Size() ? SpawningSoundIndex.Size() + 1 : Sounds.Num());
		SoundIndex += appTrunc(SpawningSoundIndex.GetMin());
		SoundIndex = Clamp( SoundIndex, 0, Sounds.Num() - 1); 

		if( appSRand() <= (Sounds(SoundIndex).Probability.GetRand() * SpawningSoundProbability.GetRand()) )
				Owner->GetLevel()->Engine->Audio->PlaySound( Owner, SLOT_None, Sounds(SoundIndex).Sound, Particle.Location, Owner->TransientSoundVolume*Sounds(SoundIndex).Volume.GetRand(), Sounds(SoundIndex).Radius.GetRand(), Sounds(SoundIndex).Pitch.GetRand(), SF_NoUpdates, 0.f );
	}

	// Make sure we get ticked.
	AllParticlesDead = false;
    }

    protected updatedParticles(deltaTime: number) {
        // debugger;

        const Owner = this.parent;

        const GMath = { UnitCoords: null as any };

        this.boundingBox.makeEmpty();
        let DeadParticles = 0;



        // Verify range of critical variables.
        if (Owner) {
            if (this.addLocationFromOtherEmitter >= 0)
                this.addLocationFromOtherEmitter = __break__() && clamp(this.addLocationFromOtherEmitter, 0, Owner.Emitters.Num() - 1);
            if (this.addVelocityFromOtherEmitter >= 0)
                this.addVelocityFromOtherEmitter = __break__() && clamp(this.addVelocityFromOtherEmitter, 0, Owner.Emitters.Num() - 1);
            if (this.spawnFromOtherEmitter >= 0)
                this.spawnFromOtherEmitter = __break__() && clamp(this.spawnFromOtherEmitter, 0, Owner.Emitters.Num() - 1);
        }
        else
            return 0;

        // Update velocity loss range.
        if (!this.rotateVelocityLossRange) {
            this.realVelocityLossRange = this.velocityLossRange;
        } else {
            __break__();
            const RVLMin = new Vector3(this.velocityLossRange.min.x, this.velocityLossRange.min.y, this.velocityLossRange.min.z);
            const RVLMax = new Vector3(this.velocityLossRange.max.x, this.velocityLossRange.max.y, this.velocityLossRange.max.z);

            switch (this.UseRotationFrom) {
                case PTRS_Actor:
                    this.RVLMin = RVLMin.TransformVectorBy(GMath.UnitCoords * Owner.Rotation * this.RotationOffset);
                    this.RVLMax = RVLMax.TransformVectorBy(GMath.UnitCoords * Owner.Rotation * this.RotationOffset);
                    break;
                case PTRS_Offset:
                    this.RVLMin = RVLMin.TransformVectorBy(GMath.UnitCoords * this.RotationOffset);
                    this.RVLMax = RVLMax.TransformVectorBy(GMath.UnitCoords * this.RotationOffset);
                    break;
                case PTRS_Normal:
                    this.RVLMin = RVLMin.TransformVectorBy(GMath.UnitCoords * this.RotationNormal.Rotation());
                    this.RVLMax = RVLMax.TransformVectorBy(GMath.UnitCoords * this.RotationNormal.Rotation());
                default:
                    break;
            }

            this.realVelocityLossRange = { min: new Vector3(), max: new Vector3() }
            this.realVelocityLossRange.min.x = RVLMin.x;
            this.realVelocityLossRange.min.y = RVLMin.y;
            this.realVelocityLossRange.min.z = RVLMin.z;

            this.realVelocityLossRange.max.x = RVLMax.x;
            this.realVelocityLossRange.max.y = RVLMax.y;
            this.realVelocityLossRange.max.z = RVLMax.z;
        }

        // Skeletal mesh stuff.
        let numBones = 0;
        if (this.SkeletalMeshActor && __break__() && this.UseSkeletalLocationAs !== PTSU_None) {
            if (!this.SkeletalMeshActor.bDeleteMe && this.SkeletalMeshActor.Mesh && this.SkeletalMeshActor.Mesh.IsA("USkeletalMesh")) {
                const SkeletalMeshInstance = this.SkeletalMeshActor.Mesh.MeshGetInstance(this.SkeletalMeshActor);
                if (SkeletalMeshInstance)
                    numBones = SkeletalMeshInstance.GetMeshJointsAndNormals(this.SkeletalMeshActor, this.MeshVertsAndNormals);
            }
        }

        // Spawning.
        let rate;
        if (this.activeParticles < this.maxActiveParticles) {
            // Either spawn them continously...
            if (this.isAutomaticInitialSpawning) {
                rate = this.maxActiveParticles / this.lifetimeRange.mid();
            }
            // ... or at a fixed rate.
            else {
                __break__();
                rate = this.initialParticlesPerSecond;
            }
        }
        else {
            __break__();
            rate = this.particlesPerSecond; //!! TODO: PPSLightFactor
            //Rate = ParticlesPerSecond * PPSLightFactor * LightBrightness / 255.f;
        }

        // Spawning on trigger.
        if (this.currentSpawnOnTrigger)
            rate += this.spawnOnTriggerPPS;

       

        // Actually spawn them.
        if (rate > 0 && !this.killPending)
            this.ppsFraction = this.spawnParticles(this.ppsFraction, rate, deltaTime);

        const oldLocation = () => Owner.position;

        let Percent = 0;
        let bInterpolate = oldLocation().distanceTo(Owner.position) > 1;

        debugger;

        // Deferred spawning.
        if (!this.killPending) {
            let Amount = clamp(this.deferredParticles, 0, this.maxActiveParticles);
            for (let i = 0; i < Amount; i++) {
                this.spawnParticle(this.particleIndex, 0);

                // Laurent -- Location interpolation
                if (bInterpolate && this.CoordinateSystem == PTCS_Independent) {
                    Percent = 1 - (i + 1) / Amount;

                    this.Particles[this.particleIndex].Location += Percent * (Owner.OldLocation - Owner.Location);
                }

                this.activeParticles = Math.max(this.activeParticles, this.particleIndex + 1);
                throw new Error("++this.ParticleIndex %= this.MaxActiveParticles;");
            }
            this.deferredParticles = 0;
        }

        // Laurent -- Count particles to respawn for interpolation
        let PtclRespawnCount = 0;
        let PtclRespawnIndex = 0;
        //Percent					= 0.f;
        for (let Index = 0; Index < Math.min(this.maxActiveParticles, this.activeParticles); Index++) {
            let Particle = this.Particles[Index];

            if (!(Particle.Flags & PTF_Active))
                continue;

            // Don't tick particle if it just got spawned via initial spawning.
            if (!(Particle.Flags & PTF_InitialSpawn))
                Particle.Time += deltaTime;

            if (Particle.Time > Particle.MaxLifetime) {
                if (!this.RespawnDeadParticles)
                    continue;

                PtclRespawnCount++;
            }
        }

        let MaxVelocityScale = 1;
        let OneOverDeltaTime = 1 / clamp(deltaTime, 0.001, 0.15);

        // Only particles 0..Min(MaxActiveParticles, ActiveParticles) are active.
        for (let Index = 0; Index < Math.min(this.maxActiveParticles, this.activeParticles); Index++) {
            let Particle = this.Particles[Index];

            if (!(Particle.Flags & PTF_Active)) {
                DeadParticles++;
                continue;
            }
            // Don't tick particles with PTF_NoTick
            let TickParticle = !(Particle.Flags & PTF_NoTick) || (this.CoordinateSystem == PTCS_Relative);
            // Don't tick particle if it just got spawned via initial spawning.
            if (Particle.Flags & PTF_InitialSpawn) {
                TickParticle = false;
                Particle.Flags &= ~PTF_InitialSpawn;
            }
            //else
            //	Particle.Time += DeltaTime;

            if (Particle.Time > Particle.MaxLifetime) {
                if (!this.RespawnDeadParticles) {
                    Particle.Flags &= ~PTF_Active;
                    DeadParticles++;
                    continue;
                }
                let NewTime = Particle.Time - Particle.MaxLifetime + this.InitialTimeRange.GetRand();
                if (Particle.MaxLifetime)
                    NewTime = NewTime % Particle.MaxLifetime;
                else
                    NewTime = 0;

                this.spawnParticle(Index, NewTime);

                // Laurent -- Location interpolation
                if (bInterpolate && this.CoordinateSystem == PTCS_Independent) {
                    Percent = 1 - (PtclRespawnIndex + 1) / PtclRespawnCount;

                    this.Particles[Index].Location += Percent * (Owner.OldLocation - Owner.Location);
                }
                PtclRespawnIndex++;
            }
            else if (TickParticle) {
                Particle.Velocity += this.Acceleration * deltaTime;
                Particle.OldLocation = Particle.Location;
                Particle.Location += deltaTime * (Particle.Velocity * Particle.VelocityMultiplier);

                if (numBones && this.UseSkeletalLocationAs == PTSU_Location) {
                    const NewMeshLocation = this.MeshVertsAndNormals[Particle.BoneIndex * 2] * this.SkeletalScale;
                    Particle.Location += NewMeshLocation - Particle.OldMeshLocation;
                    Particle.OldMeshLocation = NewMeshLocation;
                }

                if (this.UseRevolution) {
                    let RevolutionCenter = Particle.RevolutionCenter;
                    let Location = Particle.Location - RevolutionCenter;
                    Location = Location.RotateAngleAxis(Math.trunc(Particle.RevolutionsPerSecond.X * Particle.RevolutionsMultiplier.X * deltaTime * 0xFFFF), new Vector3(1, 0, 0));
                    Location = Location.RotateAngleAxis(Math.trunc(Particle.RevolutionsPerSecond.Y * Particle.RevolutionsMultiplier.Y * deltaTime * 0xFFFF), new Vector3(0, 1, 0));
                    Location = Location.RotateAngleAxis(Math.trunc(Particle.RevolutionsPerSecond.Z * Particle.RevolutionsMultiplier.Z * deltaTime * 0xFFFF), new Vector3(0, 0, 1));
                    Particle.Location = Location + RevolutionCenter;
                }
            }

            // Colission detection.
            let Collided = false;
            let HitNormal = new Vector3(0, 0, 0);
            let HitLocation = new Vector3(0, 0, 0);
            if (TickParticle && (this.CoordinateSystem != PTCS_Relative)) {
                if (this.UseCollision) {
                    let Hit: any;
                    let Direction = (Particle.Location - Particle.OldLocation).SafeNormal() * this.RealExtentMultiplier * Particle.Size;
                    // JG: This was TRACE_AllBlocking, but this seems a better default... 
                    // Should pass in flags for this.
                    if (!Owner.GetLevel().SingleLineCheck(
                        Hit,
                        Owner,
                        Particle.Location + Direction,
                        Particle.OldLocation,
                        TRACE_LevelGeometry | TRACE_Level
                    )
                    ) {
                        HitNormal = Hit.Normal;
                        HitLocation = Hit.Location - Direction;
                        Collided = true;
                    }
                }
                if (this.UseCollisionPlanes && !Collided) {
                    for (let i = 0; i < this.CollisionPlanes.length; i++) {
                        let Plane = this.CollisionPlanes[i];
                        if (Math.sign(Plane.PlaneDot(Particle.Location)) != Math.sign(Plane.PlaneDot(Particle.OldLocation))) {
                            HitLocation = FLinePlaneIntersection(Particle.Location, Particle.OldLocation, Plane);
                            HitNormal = Plane;
                            Collided = true;
                            break;
                        }
                    }
                }
            }

            // Handle collided particle.
            if (Collided) {
                // Play sound on collision
                if ((this.CollisionSound != PTSC_None) && Owner.GetLevel().Engine.Audio) {
                    let SoundIndex = 0;
                    switch (this.CollisionSound) {
                        case PTSC_LinearGlobal:
                            SoundIndex = this.CurrentCollisionSoundIndex++;
                            break;
                        case PTSC_LinearLocal:
                            SoundIndex = Particle.HitCount;
                            break;
                        case PTSC_Random:
                            SoundIndex = Math.trunc(1000 * Math.random());
                            break;
                    }

                    SoundIndex %= Math.trunc(this.CollisionSoundIndex.Size() ? this.CollisionSoundIndex.Size() + 1 : this.Sounds.length);
                    SoundIndex += Math.trunc(this.CollisionSoundIndex.min);
                    SoundIndex = clamp(SoundIndex, 0, this.Sounds.length - 1);

                    if (Math.random() <= (this.Sounds[SoundIndex].Probability.GetRand() * this.CollisionSoundProbability.GetRand()))
                        Owner.GetLevel().Engine.Audio.PlaySound(Owner, SLOT_None, this.Sounds[SoundIndex].Sound, HitLocation, Owner.TransientSoundVolume * Sounds(SoundIndex).Volume.GetRand(), this.Sounds[SoundIndex].Radius.GetRand(), this.Sounds[SoundIndex].Pitch.GetRand(), SF_NoUpdates, 0);
                }

                // Spawn particle in another emitter on collision.
                if (this.spawnFromOtherEmitter >= 0) {
                    let OtherEmitter = Owner.Emitters[this.spawnFromOtherEmitter];
                    if (OtherEmitter.Initialized && OtherEmitter.Owner && deltaTime) {
                        for (let i = 0; i < this.SpawnAmount; i++) {
                            OtherEmitter.SpawnParticle(OtherEmitter.ParticleIndex, deltaTime, 0, PSF_NoGlobalOffset | PSF_NoOwnerLocation, HitLocation + HitNormal * 0.01);
                            if (this.UseSpawnedVelocityScale) {
                                let OtherParticle = OtherEmitter.Particles[OtherEmitter.ParticleIndex];
                                OtherParticle.Velocity += HitNormal * this.SpawnedVelocityScaleRange.GetRand();
                            }
                            OtherEmitter.ActiveParticles = Math.max(OtherEmitter.ActiveParticles, OtherEmitter.ParticleIndex + 1);
                            throw new Error("++OtherEmitter.ParticleIndex %= OtherEmitter.MaxActiveParticles;");
                        }
                    }
                }

                // Update.
                if (this.UseMaxCollisions && (Particle.HitCount + 1 >= Math.trunc(this.MaxCollisions.GetRand()))) {
                    if (this.RespawnDeadParticles)
                        this.SpawnParticle(Index, 0.5 * deltaTime); //!! HACK
                    else {
                        Particle.Flags &= ~PTF_Active;
                        DeadParticles++;
                        continue;
                    }
                }
                else {
                    Particle.Velocity -= this.Acceleration * deltaTime * 0.5; //!! HACK
                    Particle.Velocity = Particle.Velocity.MirrorByVector(HitNormal);
                    Particle.Velocity *= this.DampingFactorRange.GetRand();
                    if (this.DampRotation)
                        Particle.SpinsPerSecond *= this.RotationDampingFactorRange.GetRand();
                    Particle.Location = HitLocation + HitNormal * 0.01;
                    Particle.OldLocation = Particle.Location;
                    ++Particle.HitCount;
                }
            }

            // Scaling over time.
            let RelativeTime;
            let TimeFactor = 1.0;
            let Time = Particle.Time;
            let Color = new Vector4(1, 1, 1, 1);

            if (Particle.MaxLifetime)
                RelativeTime = clamp(Time / Particle.MaxLifetime, 0, 1);
            else
                RelativeTime = 0;

            // Size scale.
            if (this.UseSizeScale) {
                if (this.UseRegularSizeScale)
                    TimeFactor = TimeFactor / (1 + Particle.Time);
                else {
                    let SizeRelativeTime = ((this.UseAbsoluteTimeForSizeScale ? Time : RelativeTime) * (this.SizeScaleRepeats + 1)) % 1;
                    for (let n = 0; n < this.SizeScale.length; n++) {
                        if (this.SizeScale[n].RelativeTime >= SizeRelativeTime) {
                            let S1, R1;
                            let S2 = this.SizeScale[n].RelativeSize;
                            let R2 = this.SizeScale[n].RelativeTime;
                            if (n) {
                                S1 = this.SizeScale[n - 1].RelativeSize;
                                R1 = this.SizeScale[n - 1].RelativeTime;
                            }
                            else {
                                S1 = 1;
                                R1 = 0;
                            }
                            let A;
                            if (R2)
                                A = (SizeRelativeTime - R1) / (R2 - R1);
                            else
                                A = 1;

                            // Interpolate between two scales.
                            TimeFactor = lerp(S1, S2, A);
                            break;
                        }
                    }
                }
            }
            Particle.Size = TimeFactor * Particle.StartSize;

            // Velocity scale.
            if (this.UseVelocityScale) {
                if (Particle.MaxLifetime) {
                    let VelocityRelativeTime = (RelativeTime * (this.VelocityScaleRepeats + 1)) % 1;
                    for (let n = 0; n < this.VelocityScale.length; n++) {
                        if (this.VelocityScale[n].RelativeTime >= VelocityRelativeTime) {
                            let V1,
                                V2 = this.VelocityScale[n].RelativeVelocity;
                            let R1,
                                R2 = this.VelocityScale[n].RelativeTime;
                            if (n) {
                                V1 = this.VelocityScale[n - 1].RelativeVelocity;
                                R1 = this.VelocityScale[n - 1].RelativeTime;
                            }
                            else {
                                V1 = new Vector3(1, 1, 1);
                                R1 = 0;
                            }
                            let A;
                            if (R2)
                                A = (VelocityRelativeTime - R1) / (R2 - R1);
                            else
                                A = 1;

                            // Interpolate between two scales.
                            let Multiplier = lerp(V1, V2, A);
                            Particle.VelocityMultiplier = Multiplier;
                            break;
                        }
                    }
                }
            }

            // Scale size by velocity.
            if (this.ScaleSizeXByVelocity || this.ScaleSizeYByVelocity || this.ScaleSizeZByVelocity) {
                let VelocitySize = this.DetermineVelocityByLocationDifference ? (Particle.Location - Particle.OldLocation).Size() * OneOverDeltaTime : (Particle.Velocity * Particle.VelocityMultiplier).Size();
                MaxVelocityScale = Math.max(MaxVelocityScale, VelocitySize);
                if (this.ScaleSizeXByVelocity)
                    Particle.Size.X *= VelocitySize * this.ScaleSizeByVelocityMultiplier.X;
                if (this.ScaleSizeYByVelocity)
                    Particle.Size.Y *= VelocitySize * this.ScaleSizeByVelocityMultiplier.Y;
                if (this.ScaleSizeZByVelocity)
                    Particle.Size.Z *= VelocitySize * this.ScaleSizeByVelocityMultiplier.Z;
            }

            // Revolution scale.
            if (this.UseRevolutionScale) {
                if (Particle.MaxLifetime) {
                    let RevolutionRelativeTime = (RelativeTime * (this.RevolutionScaleRepeats + 1)) % 1;
                    for (let n = 0; n < this.RevolutionScale.length; n++) {
                        if (this.RevolutionScale[n].RelativeTime >= RevolutionRelativeTime) {
                            let V1,
                                V2 = this.RevolutionScale[n].RelativeRevolution;
                            let R1,
                                R2 = this.RevolutionScale[n].RelativeTime;
                            if (n) {
                                V1 = this.RevolutionScale[n - 1].RelativeRevolution;
                                R1 = this.RevolutionScale[n - 1].RelativeTime;
                            }
                            else {
                                V1 = new Vector3(1, 1, 1);
                                R1 = 0;
                            }
                            let A;
                            if (R2)
                                A = (RevolutionRelativeTime - R1) / (R2 - R1);
                            else
                                A = 1;

                            // Interpolate between two scales.
                            let Multiplier = lerp(V1, V2, A);
                            Particle.RevolutionsMultiplier = Multiplier;
                            break;
                        }
                    }
                }
            }

            // Color scaling.
            if (this.UseColorScale && Particle.MaxLifetime) {
                let ColorRelativeTime = (RelativeTime * (this.ColorScaleRepeats + 1)) % 1;
                for (let n = 0; n < this.ColorScale.length; n++) {
                    if (this.ColorScale[n].RelativeTime >= ColorRelativeTime) {
                        let R1;
                        let R2 = this.ColorScale[n].RelativeTime;
                        let C1;
                        let C2 = this.ColorScale[n].Color;
                        if (n) {
                            C1 = this.ColorScale[n - 1].Color;
                            R1 = this.ColorScale[n - 1].RelativeTime;
                        }
                        else {
                            C1 = new Vector4(1, 1, 1, 1);
                            R1 = 0;
                        }
                        let A;
                        if (R2)
                            A = (ColorRelativeTime - R1) / (R2 - R1);
                        else
                            A = 1;

                        // Interpolate between two colors.
                        Color.x = lerp(C1.X, C2.X, A);
                        Color.y = lerp(C1.Y, C2.Y, A);
                        Color.z = lerp(C1.Z, C2.Z, A);
                        if (this.DrawStyle == PTDS_AlphaBlend)
                            Color.w = lerp(C1.W, C2.W, A);
                        else
                            Color.w = 1;

                        break;
                    }
                }
            }

            Color.x *= Particle.ColorMultiplier.x;
            Color.y *= Particle.ColorMultiplier.y;
            Color.z *= Particle.ColorMultiplier.z;

            // Fade In/ Out.
            if ((this.FadeOut && (Time > this.FadeOutStartTime) && (Particle.MaxLifetime != this.FadeOutStartTime))
                || (this.FadeIn && (Time < this.FadeInEndTime) && this.FadeInEndTime)
            ) {
                let FadeFactor;
                let MaxFade: any;

                if (this.FadeOut && (Time > this.FadeOutStartTime)) {
                    FadeFactor = Time - this.FadeOutStartTime;
                    FadeFactor /= (Particle.MaxLifetime - this.FadeOutStartTime);
                    MaxFade = this.FadeOutFactor;
                }
                else {

                    FadeFactor = this.FadeInEndTime - Time;
                    FadeFactor /= this.FadeInEndTime;
                    MaxFade = this.FadeInFactor;

                }

                if (this.DrawStyle == PTDS_Modulated) {
                    Color = new Vector4(
                        0.5,
                        0.5,
                        0.5,
                        1 - this.FadeFactor * MaxFade.w
                    );
                }
                else if (this.DrawStyle == PTDS_AlphaBlend) {
                    Color.w -= FadeFactor * MaxFade.w;
                }
                else {
                    Color -= FadeFactor * MaxFade;
                }
            }

            // Laurent -- Global Opacity
            if (this.Opacity < 1 && this.DrawStyle != PTDS_Regular) //don't do Opacity for Regular blend mode
            {
                if (this.CollisionSoundDrawStyle == PTDS_AlphaBlend ||
                    this.CollisionSoundDrawStyle == PTDS_Modulated ||
                    this.CollisionSoundDrawStyle == PTDS_AlphaModulate_MightNotFogCorrectly) {
                    Color.w *= this.Opacity;
                }
                else {
                    Color.x *= this.Opacity;
                    Color.y *= this.Opacity;
                    Color.z *= this.Opacity;
                }
            }

            Particle.Color = Color;

            // Bounding box creation.
            this.boundingBox += Particle.Location;

            // Clamping velocity.
            if (this.MaxAbsVelocity.x)
                Particle.Velocity.X = clamp(Particle.Velocity.X, -this.MaxAbsVelocity.x, this.MaxAbsVelocity.x);
            if (this.MaxAbsVelocity.y)
                Particle.Velocity.Y = clamp(Particle.Velocity.Y, -this.MaxAbsVelocity.y, this.MaxAbsVelocity.y);
            if (this.MaxAbsVelocity.z)
                Particle.Velocity.Z = clamp(Particle.Velocity.Z, -this.MaxAbsVelocity.z, this.MaxAbsVelocity.z);

            // Friction.
            Particle.Velocity -= Particle.Velocity * this.realVelocityLossRange.GetRand() * deltaTime;

            // Don't tick if particle is no longer moving.
            if (Collided && (Particle.Velocity.SizeSquared() < this.MinSquaredVelocity))
                Particle.Flags |= PTF_NoTick;

            // Used by trail emitter e.g.
            this.UpdateParticle(deltaTime, Index);
        }

        // Account for SizeScale when expanding bounding box.
        let MaxScale = 1;
        if (this.UseSizeScale && !this.UseRegularSizeScale) {
            for (let i = 0; i < this.SizeScale.length; i++)
                MaxScale = Math.max(this.SizeScale[i].RelativeSize, MaxScale);
        }

        // Take ScaleSizeByVelocityMultiplier into account.
        let MaxScaleSizeByVelocityMultiplier = 1;
        if (this.ScaleSizeXByVelocity || this.ScaleSizeXByVelocity || this.ScaleSizeXByVelocity) {
            MaxScaleSizeByVelocityMultiplier = 0;
            if (this.ScaleSizeXByVelocity)
                MaxScaleSizeByVelocityMultiplier = Math.max(MaxScaleSizeByVelocityMultiplier, this.ScaleSizeByVelocityMultiplier.x);
            if (this.ScaleSizeYByVelocity)
                MaxScaleSizeByVelocityMultiplier = Math.max(MaxScaleSizeByVelocityMultiplier, this.ScaleSizeByVelocityMultiplier.y);
            if (this.ScaleSizeZByVelocity)
                MaxScaleSizeByVelocityMultiplier = Math.max(MaxScaleSizeByVelocityMultiplier, this.ScaleSizeByVelocityMultiplier.z);
        }

        // Subclasses use this to expand bounding box accordingly.
        this.MaxSizeScale = MaxScale * MaxVelocityScale * MaxScaleSizeByVelocityMultiplier;

        // Ugh, this is getting ugly. Subtle assumptions because of indirect spawning.
        if ((DeadParticles >= this.maxActiveParticles || this.activeParticles == DeadParticles) && rate == 0 && !this.RespawnDeadParticles)
            this.allParticlesDead = true;
        else
            this.allParticlesDead = false;

        return this.activeParticles - DeadParticles;
    }

    public update(currentTime: number) {
        if (currentTime === 0) return;

        if (this.currentTime === undefined)
            this.currentTime = currentTime;

        this.updatedParticles(currentTime - this.currentTime);

        this.currentTime = currentTime;
    }

    // public update(currentTime: number) {
    //     if (currentTime === 0) return;

    //     this.currentTime = currentTime;

    //     let deadParticlesCount = 0;
    //     const deadParticlePool = new Array<Particle>(this.particlePool.length);

    //     for (const particle of this.particlePool) {
    //         if (!particle.isAlive) {
    //             deadParticlePool[deadParticlesCount++] = particle;
    //             continue;
    //         }

    //         particle.update(currentTime);

    //         if (!particle.isAlive) // particle has died after update
    //             deadParticlePool[deadParticlesCount++] = particle;
    //     }

    //     const needsToSpawn = !isFinite(this.lastSpawned) || ((currentTime - this.lastSpawned) > this.initialSettings.particlesPerSecond * 1000);

    //     if (!needsToSpawn)
    //         return;

    //     const timePassed = isFinite(this.lastSpawned) ? currentTime - this.lastSpawned : 1000;
    //     const particlesToSpawn = Math.min((timePassed / 1000) * this.initialSettings.particlesPerSecond, deadParticlesCount);

    //     for (let i = 0; i < particlesToSpawn; i++)
    //         deadParticlePool[i].spawn({
    //             lifetime: this.generalSettings.lifetime,
    //             fading: this.fadingSettings,
    //             acceleration: this.generalSettings.acceleration,
    //             velocity: this.initialSettings.velocity,
    //             scale: this.initialSettings.scale,
    //             position: this.initialSettings.position,
    //             changesOverLifetime: this.changesOverLifetimeSettings,
    //             opacity: this.generalSettings.opacity,
    //             colorMultiplierRange: this.generalSettings.colorMultiplierRange
    //         });

    //     this.lastSpawned = currentTime;
    // }

    protected abstract initSettings(info: EmitterConfig_T): void;
    protected abstract initParticleMesh(): THREE.Mesh<THREE.BufferGeometry, ParticleMaterial>;
}

export default BaseEmitter;
export { BaseEmitter };

class Particle extends Object3D {
    protected readonly particleSystem: BaseEmitter;
    protected readonly visualizer: THREE.Mesh<THREE.BufferGeometry, ParticleMaterial>;

    public isAlive: boolean = false;
    public visible: boolean = false;

    public bornTime: number;
    public deathTime: number;

    protected fadeIn: Fade_T;
    protected fadeOut: Fade_T;

    protected lastUpdate: number;

    protected velocity = new Vector3();
    protected acceleration = new Vector3();
    protected changesOverLifetime: ChangesOverTime_T;



    protected initial = {
        scale: new Vector3(),
        color: new Vector4(),
    };


    private constructor(particleSystem: BaseEmitter, visualizer: THREE.Mesh<THREE.BufferGeometry, ParticleMaterial>) {
        super();

        this.particleSystem = particleSystem;
        this.visualizer = visualizer;

        this.add(visualizer);
    }

    static init(particleSystem: BaseEmitter, visualizer: THREE.Mesh<THREE.BufferGeometry, ParticleMaterial>): Particle {
        return new Particle(particleSystem, visualizer);
    }

    public update(currentTime: number) {
        if (!this.isAlive) return;

        if (currentTime >= this.deathTime) {
            this.kill();
            return;
        }

        const dtSeconds = (currentTime - this.lastUpdate) / 1000;
        const tmp = new Vector3();

        tmp.copy(this.acceleration).multiplyScalar(0.5).multiplyScalar(dtSeconds ** 2);
        this.position.add(tmp);

        tmp.copy(this.velocity).multiplyScalar(dtSeconds);
        this.position.add(tmp);

        const timeAlive = currentTime - this.bornTime;
        const lifespan = this.deathTime - this.bornTime;


        const mats = this.visualizer.material instanceof Array ? this.visualizer.material : [this.visualizer.material];

        for (const mat of mats) {
            if (this.fadeIn && this.fadeIn.time > timeAlive) {
                const fade = mapLinear(timeAlive, 0, this.fadeIn.time, 0, 1);
                const [r, g, b, a] = this.fadeIn.color.toArray().map(v => v * fade);

                mat.color.setRGB(this.initial.color.x * r, this.initial.color.y * g, this.initial.color.z * b);
                mat.opacity = this.initial.color.w * a;
            } else if (this.fadeOut && this.fadeOut.time < timeAlive) {
                const fade = mapLinear(timeAlive, this.fadeOut.time, lifespan, 0, 1);
                const [r, g, b, a] = this.fadeOut.color.toArray().map(v => 1 - v * fade);

                mat.color.setRGB(this.initial.color.x * r, this.initial.color.y * g, this.initial.color.z * b);
                mat.opacity = this.initial.color.w * a;
            } else if (this.fadeIn || this.fadeOut) {
                mat.color.setRGB(this.initial.color.x, this.initial.color.y, this.initial.color.z);
                mat.opacity = this.initial.color.w;
            }
        }

        if (this.changesOverLifetime.scale) {
            const { times, values } = this.changesOverLifetime.scale;
            const timePassed = timeAlive / lifespan;

            let idxStart: number = -1;

            for (let i = 0; i < times.length - 1; i++) {
                if (times[i] > timePassed) break;

                idxStart = i;
            }

            const idxFinish = idxStart + 1;

            if (idxStart < 0)
                debugger;

            const startValue = values[idxStart];
            const finishValue = values[idxFinish];

            const size = mapLinear(timePassed, 0, 1, startValue, finishValue);

            this.scale.copy(this.initial.scale).multiplyScalar(size);

            // debugger;
        }

        this.lastUpdate = currentTime;
    }

    public kill() {
        this.isAlive = false;
        this.visible = false;
    }

    public spawn({ lifetime, fading: { fadeIn, fadeOut }, acceleration, velocity, scale, position, changesOverLifetime, opacity, colorMultiplierRange }: {
        lifetime: Range_T, fading: FadeSettings_T,
        acceleration: THREE.Vector3,
        velocity: Range3_T,
        position: Range3_T,
        scale: Range3_T,
        changesOverLifetime: ChangesOverTime_T,
        opacity: number,
        colorMultiplierRange: Range3_T
    }) {

        const now = this.bornTime = this.particleSystem.getCurrentTime();
        const lifespan = randRange(lifetime.min, lifetime.max);

        this.fadeIn = fadeIn;
        this.fadeOut = fadeOut;

        this.deathTime = now + lifespan;
        this.changesOverLifetime = changesOverLifetime;

        randVector(this.scale, scale.min, scale.max);
        randVector(this.velocity, velocity.min, velocity.max);
        randVector(this.position, position.min, position.max);
        randVector(this.initial.color as any as Vector3, colorMultiplierRange.min, colorMultiplierRange.max);

        const mats = this.visualizer.material instanceof Array ? this.visualizer.material : [this.visualizer.material];

        for (const mat of mats)
            mat.color.setRGB(this.initial.color.x, this.initial.color.y, this.initial.color.z);

        this.acceleration.copy(acceleration);
        this.initial.scale.copy(this.scale);
        this.initial.color.w = opacity;

        this.lastUpdate = now;
        this.isAlive = true;

        this.update(now);

        this.visible = true;
    }
}

function randRange(min: number, max: number) { return Math.random() * (max - min) + min; }

function randVector(dst: THREE.Vector3, min: THREE.Vector3, max: THREE.Vector3) {
    dst.x = randRange(min.x, max.x);
    dst.y = randRange(min.y, max.y);
    dst.z = randRange(min.z, max.z);

    return dst;
}

function buildChangeRanges(ranges: { values: [number, number][], repeats: number }): { times: number[], values: number[] } {
    if (!ranges) return null;

    const repeats = ranges.repeats || 1;
    const totalSegments = ranges.values.length * repeats;

    const times = new Array<number>(totalSegments);
    const values = new Array<number>(totalSegments);

    let i = 0;
    for (let mul = 1; mul <= repeats; mul++) {
        for (const [it, v] of ranges.values) {
            const t = it / repeats * mul;

            times[i] = t;
            values[i] = v;

            i++;
        }
    }

    return { values, times };
}

type Range_T = { min: number; max: number; };
type Fade_T = { time: number; color: Vector4; };
type FadeSettings_T = { fadeIn: Fade_T; fadeOut: Fade_T; };
type Range3_T = { min: THREE.Vector3, max: THREE.Vector3 };
type ChangesOverTime_T = { scale?: { times: number[], values: number[] }; };

const __break__ = () => { debugger; throw new Error("dunno") };