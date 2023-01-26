int __thiscall UParticleEmitter::UpdateParticles(UParticleEmitter *this, float deltaTime)
{
  AEmitter *owner; // ecx
  int v4; // eax
  int v5; // eax
  int v6; // eax
  int v7; // ecx
  bool hasSkeletalMeshActor; // zf
  AActor *skeletalMeshActor; // eax
  char v10; // cl
  UObject *v11; // eax
  int maxActiveParticles; // eax
  bool canStillSpawn; // cc
  double lifetimeMidpoint; // st7
  int maxParticles; // eax
  int v16; // edi
  int v17; // edx
  int activeParticles; // ecx
  int v19; // eax
  int v20; // edx
  int v21; // edi
  int v22; // eax
  int v23; // ecx
  int v24; // edx
  int v25; // edi
  int v26; // eax
  int v27; // edi
  BOOL v28; // ebx
  int v29; // eax
  int v30; // edx
  double v31; // st7
  double v32; // st6
  int v33; // edx
  double v34; // st7
  double v35; // st6
  double v36; // st7
  float *v37; // eax
  double v38; // st7
  float v39; // eax
  float v40; // ecx
  double v41; // st7
  double v42; // st6
  double v43; // st5
  double v44; // st7
  float v45; // ecx
  float v46; // edx
  double v47; // st7
  float *v48; // eax
  double v49; // st7
  float *v50; // eax
  double v51; // st7
  float *v52; // eax
  double v53; // st7
  double v54; // st7
  float *v55; // eax
  double v56; // st7
  double y; // st6
  double v58; // st6
  double v59; // st5
  int v60; // edx
  float *v61; // ebx
  double v62; // st7
  double v63; // st7
  float *v64; // eax
  float v65; // ecx
  float v66; // edx
  float v67; // eax
  float v68; // edx
  unsigned __int8 v69; // al
  int v70; // ebx
  int v71; // eax
  int v72; // eax
  double v73; // st7
  int v74; // ebx
  int v75; // ebx
  double v76; // st7
  int *v77; // eax
  float v78; // ecx
  AEmitter *v79; // edx
  int v80; // ebx
  double v81; // st7
  int v82; // edx
  double v83; // st7
  double v84; // st6
  double v85; // st7
  double v86; // st6
  _DWORD *v87; // eax
  int v88; // eax
  int v89; // eax
  double v90; // st7
  float v91; // eax
  float v92; // ecx
  double v93; // st7
  float v94; // edx
  int v95; // eax
  int v96; // eax
  int *v97; // ebx
  int v98; // eax
  int v99; // edx
  int v100; // eax
  float *v101; // eax
  double v102; // st7
  double v103; // st6
  double v104; // st5
  FRange *v105; // eax
  int v106; // ecx
  int v107; // eax
  int v108; // edx
  float v109; // eax
  double v110; // st7
  float v111; // edx
  double v112; // st7
  int v113; // eax
  double v114; // st7
  int v115; // eax
  int v116; // ecx
  float *v117; // ebx
  float *v118; // edx
  double v119; // st7
  double v120; // st6
  double v121; // st5
  double v122; // st5
  float v123; // edx
  double v124; // st7
  double v125; // st7
  int v126; // eax
  int v127; // ecx
  float *v128; // ebx
  float *v129; // edx
  double v130; // st7
  int *v131; // eax
  float v132; // edx
  double v133; // st6
  int v134; // ecx
  double v135; // st7
  double v136; // st5
  double v137; // st7
  double v138; // st7
  int v139; // eax
  int v140; // ecx
  float *v141; // ebx
  float *v142; // edx
  double v143; // st7
  int *v144; // eax
  float v145; // edx
  double v146; // st6
  int v147; // ecx
  double v148; // st7
  double v149; // st5
  double v150; // st7
  double v151; // st7
  int v152; // eax
  int v153; // ecx
  float *v154; // edx
  float *v155; // ebx
  double v156; // st7
  float v157; // ebx
  double v158; // st6
  double v159; // st7
  unsigned __int64 v160; // rax
  unsigned __int64 v161; // rax
  unsigned __int8 v162; // bl
  int v163; // ecx
  int *v164; // eax
  double v165; // st7
  float v166; // edx
  float v167; // ecx
  float v168; // edx
  char v169; // al
  double v170; // st7
  double v171; // st6
  double v172; // st7
  double v173; // st6
  double v174; // st6
  char v175; // bl
  double v176; // st6
  char v177; // cl
  double v178; // st6
  double v179; // st7
  char v180; // al
  unsigned __int64 v181; // rax
  unsigned __int64 v182; // rax
  float *v183; // ebx
  int v184; // eax
  float *v185; // eax
  double v186; // st7
  double v187; // st6
  float *v188; // ebx
  int v189; // eax
  float *v190; // eax
  double v191; // st7
  double v192; // st6
  double v193; // st7
  double v194; // st6
  double v195; // st7
  double v196; // st6
  double v197; // st7
  double v198; // st6
  FVector *v199; // ebx
  int v200; // eax
  float *v201; // eax
  double v202; // st7
  double v203; // st6
  int v204; // eax
  float *v205; // eax
  float *v206; // eax
  double v207; // st7
  double v208; // st6
  double v209; // st7
  double v210; // st6
  int v211; // eax
  double v212; // st7
  float *v213; // ecx
  int v214; // edx
  int v215; // ecx
  int particleIndex; // [esp+C8h] [ebp-48Ch]
  float v218; // [esp+CCh] [ebp-488h]
  float v219; // [esp+D8h] [ebp-47Ch]
  float v220; // [esp+D8h] [ebp-47Ch]
  float v221; // [esp+D8h] [ebp-47Ch]
  float v222; // [esp+D8h] [ebp-47Ch]
  float v223; // [esp+D8h] [ebp-47Ch]
  float v224; // [esp+D8h] [ebp-47Ch]
  int v225; // [esp+DCh] [ebp-478h] BYREF
  char v226[48]; // [esp+E8h] [ebp-46Ch] BYREF
  char v227[48]; // [esp+118h] [ebp-43Ch] BYREF
  char v228[48]; // [esp+148h] [ebp-40Ch] BYREF
  char v229[48]; // [esp+178h] [ebp-3DCh] BYREF
  char v230[12]; // [esp+1A8h] [ebp-3ACh] BYREF
  char v231[12]; // [esp+1B4h] [ebp-3A0h] BYREF
  char v232[12]; // [esp+1C0h] [ebp-394h] BYREF
  char v233[12]; // [esp+1CCh] [ebp-388h] BYREF
  char v234[12]; // [esp+1D8h] [ebp-37Ch] BYREF
  char v235[12]; // [esp+1E4h] [ebp-370h] BYREF
  char v236[12]; // [esp+1F0h] [ebp-364h] BYREF
  char v237[12]; // [esp+1FCh] [ebp-358h] BYREF
  char v238[12]; // [esp+208h] [ebp-34Ch] BYREF
  char v239[12]; // [esp+214h] [ebp-340h] BYREF
  char v240[12]; // [esp+220h] [ebp-334h] BYREF
  char v241[12]; // [esp+22Ch] [ebp-328h] BYREF
  char v242[12]; // [esp+238h] [ebp-31Ch] BYREF
  char v243[12]; // [esp+244h] [ebp-310h] BYREF
  char v244[12]; // [esp+250h] [ebp-304h] BYREF
  char v245[12]; // [esp+25Ch] [ebp-2F8h] BYREF
  char v246[12]; // [esp+268h] [ebp-2ECh] BYREF
  char v247[20]; // [esp+274h] [ebp-2E0h] BYREF
  float v248; // [esp+288h] [ebp-2CCh]
  float v249; // [esp+294h] [ebp-2C0h]
  float v250; // [esp+298h] [ebp-2BCh]
  float v251; // [esp+2ACh] [ebp-2A8h]
  float v252; // [esp+2B0h] [ebp-2A4h]
  float v253; // [esp+2C4h] [ebp-290h]
  float v254; // [esp+2D0h] [ebp-284h]
  float v255; // [esp+2DCh] [ebp-278h]
  float v256; // [esp+2E8h] [ebp-26Ch]
  float v257; // [esp+2ECh] [ebp-268h]
  float v258; // [esp+300h] [ebp-254h]
  float v259; // [esp+30Ch] [ebp-248h]
  float v260; // [esp+318h] [ebp-23Ch]
  char v261[8]; // [esp+31Ch] [ebp-238h] BYREF
  float v262; // [esp+324h] [ebp-230h]
  float v263; // [esp+328h] [ebp-22Ch]
  float v264; // [esp+32Ch] [ebp-228h]
  float v265; // [esp+330h] [ebp-224h]
  float v266; // [esp+334h] [ebp-220h]
  float v267; // [esp+338h] [ebp-21Ch]
  int v268; // [esp+348h] [ebp-20Ch]
  float v269; // [esp+354h] [ebp-200h]
  float v270; // [esp+360h] [ebp-1F4h]
  int v271[3]; // [esp+364h] [ebp-1F0h] BYREF
  float v272[3]; // [esp+370h] [ebp-1E4h] BYREF
  float v273[3]; // [esp+37Ch] [ebp-1D8h] BYREF
  int v274[3]; // [esp+388h] [ebp-1CCh] BYREF
  float v275[3]; // [esp+394h] [ebp-1C0h] BYREF
  int v276[3]; // [esp+3A0h] [ebp-1B4h] BYREF
  float v277[3]; // [esp+3ACh] [ebp-1A8h] BYREF
  float v278[3]; // [esp+3B8h] [ebp-19Ch] BYREF
  float v279; // [esp+3C4h] [ebp-190h]
  float v280; // [esp+3CCh] [ebp-188h]
  int v281[3]; // [esp+3D0h] [ebp-184h] BYREF
  float v282; // [esp+3DCh] [ebp-178h]
  float v283; // [esp+3E4h] [ebp-170h]
  float v284[3]; // [esp+3E8h] [ebp-16Ch] BYREF
  int v285[6]; // [esp+3F4h] [ebp-160h] BYREF
  float v286; // [esp+40Ch] [ebp-148h]
  float v287; // [esp+410h] [ebp-144h]
  float v288; // [esp+414h] [ebp-140h]
  float v289; // [esp+41Ch] [ebp-138h]
  float v290; // [esp+420h] [ebp-134h]
  float v291; // [esp+424h] [ebp-130h]
  float v292; // [esp+428h] [ebp-12Ch]
  float v293; // [esp+42Ch] [ebp-128h]
  float v294; // [esp+430h] [ebp-124h]
  int v295; // [esp+434h] [ebp-120h]
  int v296; // [esp+438h] [ebp-11Ch]
  int v297; // [esp+43Ch] [ebp-118h]
  int v298; // [esp+440h] [ebp-114h]
  int v299; // [esp+444h] [ebp-110h]
  int v300; // [esp+448h] [ebp-10Ch]
  float v301; // [esp+44Ch] [ebp-108h]
  float v302; // [esp+450h] [ebp-104h]
  float v303; // [esp+454h] [ebp-100h]
  float v304; // [esp+458h] [ebp-FCh]
  float v305; // [esp+45Ch] [ebp-F8h]
  float v306; // [esp+460h] [ebp-F4h]
  float v307; // [esp+464h] [ebp-F0h]
  float v308; // [esp+468h] [ebp-ECh]
  float v309; // [esp+46Ch] [ebp-E8h]
  float v310; // [esp+470h] [ebp-E4h]
  float v311; // [esp+474h] [ebp-E0h]
  float v312; // [esp+478h] [ebp-DCh]
  float v313; // [esp+47Ch] [ebp-D8h]
  int numBones; // [esp+480h] [ebp-D4h]
  float v315; // [esp+484h] [ebp-D0h]
  float v316; // [esp+488h] [ebp-CCh]
  float v317; // [esp+48Ch] [ebp-C8h]
  float v318; // [esp+490h] [ebp-C4h]
  float v319; // [esp+494h] [ebp-C0h]
  float v320; // [esp+498h] [ebp-BCh]
  float v321; // [esp+49Ch] [ebp-B8h]
  float v322; // [esp+4A0h] [ebp-B4h]
  float v323; // [esp+4A4h] [ebp-B0h]
  float v324; // [esp+4A8h] [ebp-ACh]
  float v325; // [esp+4ACh] [ebp-A8h] BYREF
  float v326; // [esp+4B0h] [ebp-A4h]
  float v327; // [esp+4B4h] [ebp-A0h]
  float v328; // [esp+4B8h] [ebp-9Ch]
  float v329; // [esp+4BCh] [ebp-98h]
  float v330; // [esp+4C0h] [ebp-94h]
  float v331; // [esp+4C4h] [ebp-90h]
  float v332; // [esp+4C8h] [ebp-8Ch]
  float v333; // [esp+4CCh] [ebp-88h]
  float v334; // [esp+4D0h] [ebp-84h]
  float v335; // [esp+4D4h] [ebp-80h]
  float v336; // [esp+4D8h] [ebp-7Ch]
  float v337; // [esp+4DCh] [ebp-78h]
  int v338; // [esp+4E0h] [ebp-74h]
  unsigned int v339; // [esp+4E4h] [ebp-70h]
  unsigned int v340; // [esp+4E8h] [ebp-6Ch]
  float v341; // [esp+4ECh] [ebp-68h]
  float v342; // [esp+4F0h] [ebp-64h]
  float v343; // [esp+4F4h] [ebp-60h]
  int v344; // [esp+4F8h] [ebp-5Ch]
  float v345; // [esp+4FCh] [ebp-58h]
  float v346; // [esp+500h] [ebp-54h] BYREF
  float v347; // [esp+504h] [ebp-50h]
  float v348; // [esp+508h] [ebp-4Ch]
  float v349; // [esp+50Ch] [ebp-48h] BYREF
  float v350; // [esp+510h] [ebp-44h]
  float v351; // [esp+514h] [ebp-40h]
  float v352; // [esp+518h] [ebp-3Ch]
  float _maxActiveParticles; // [esp+51Ch] [ebp-38h]
  float v354; // [esp+520h] [ebp-34h]
  int rate; // [esp+524h] [ebp-30h]
  int deadParticles; // [esp+528h] [ebp-2Ch]
  int v357; // [esp+52Ch] [ebp-28h]
  float v358; // [esp+530h] [ebp-24h]
  unsigned int v359; // [esp+534h] [ebp-20h]
  float v360; // [esp+538h] [ebp-1Ch]
  int v361; // [esp+53Ch] [ebp-18h]
  unsigned int Rand; // [esp+540h] [ebp-14h]
  int *v363; // [esp+544h] [ebp-10h]
  int v364; // [esp+550h] [ebp-4h]

  v363 = &v225;
  FBox::Init(&this->boundingBox);
  owner = this->owner;
  this->currentTime = deltaTime + this->currentTime;
  deadParticles = 0;
  if ( !owner )
    return 0;
  v4 = *(_DWORD *)&this->gap120[0x30];
  if ( v4 >= 0 )
  {
    if ( v4 >= *(_DWORD *)&owner[940] - 1 )
      v4 = *(_DWORD *)&owner[940] - 1;
    *(_DWORD *)&this->gap120[48] = v4;
  }
  v5 = *(_DWORD *)&this->gap36C[88];
  if ( v5 >= 0 )
  {
    if ( v5 >= *(_DWORD *)&owner[940] - 1 )
      v5 = *(_DWORD *)&owner[940] - 1;
    *(_DWORD *)&this->gap36C[88] = v5;
  }
  v6 = *(_DWORD *)&this->gap50[52];
  if ( v6 >= 0 )
  {
    v7 = *(_DWORD *)&owner[940] - 1;
    if ( v6 >= v7 )
      v6 = v7;
    *(_DWORD *)&this->gap50[52] = v6;
  }
  hasSkeletalMeshActor = this->skeletalMeshActor == 0;
  numBones = 0;
  if ( !hasSkeletalMeshActor )
  {
    if ( this->useSkeletalLocationAs )
    {
      skeletalMeshActor = this->skeletalMeshActor;
      v10 = (char)skeletalMeshActor[100];
      v364 = 0;
      if ( v10 >= 0 )
      {
        v11 = *(UObject **)&skeletalMeshActor[260];
        if ( v11 )
        {
          if ( UObject::IsA(v11, (struct UClass *)&USkeletalMesh::PrivateStaticClass) )
          {
            (*(void (__thiscall **)(_DWORD, AActor *))(**(_DWORD **)&this->skeletalMeshActor[260] + 148))(
              *(_DWORD *)&this->skeletalMeshActor[260],
              this->skeletalMeshActor);
            numBones = USkeletalMeshInstance::GetMeshJointsAndNormals(this->skeletalMeshActor, this->gap494, 0);
          }
        }
      }
    }
  }
  maxActiveParticles = this->maxParticles;
  canStillSpawn = this->activeParticles < maxActiveParticles;
  v364 = -1;
  _maxActiveParticles = *(float *)&maxActiveParticles;
  if ( canStillSpawn )
  {
    if ( (this->automaticInitialSpawning & 1) != 0 )
    {
      _maxActiveParticles = (float)SLODWORD(_maxActiveParticles);
      lifetimeMidpoint = FRange::GetCenter(&this->lifetimeRange);
      *(float *)&rate = _maxActiveParticles / lifetimeMidpoint;
    }
    else
    {
      rate = SLODWORD(this->initialParticlesPerSecond);
    }
  }
  else
  {
    rate = this->particlesPerSecond;
  }
  if ( *(_DWORD *)&this->gap494[12] )
    *(float *)&rate = *(float *)&rate + *(float *)&this->gap36C[16];
  if ( *(float *)&rate <= 0.0 )
    goto LABEL_30;
  if ( !*(_DWORD *)&this->gap470[16] )
  {
    *(float *)this->gap420 = ((double (__thiscall *)(UParticleEmitter *, _DWORD, int, _DWORD))*(_DWORD *)(*(_DWORD *)this->gap0 + 120))(
                               this,
                               *(_DWORD *)this->gap420,
                               rate,
                               LODWORD(deltaTime));
LABEL_30:
    if ( !*(_DWORD *)&this->gap470[16] )
    {
      maxParticles = *(_DWORD *)&this->gap470[20];
      if ( maxParticles >= 0 )
      {
        if ( maxParticles >= this->maxParticles )
          maxParticles = this->maxParticles;
      }
      else
      {
        maxParticles = 0;
      }
      if ( maxParticles > 0 )
      {
        v16 = maxParticles;
        do
        {
          v17 = *(_DWORD *)this->gap0;
          particleIndex = this->particleIndex;
          v325 = 0.0;
          v326 = 0.0;
          v327 = 0.0;
          (*(void (__thiscall **)(UParticleEmitter *, int, _DWORD, _DWORD, _DWORD, float *))(v17 + 124))(
            this,
            particleIndex,
            0,
            0,
            0,
            &v325);
          activeParticles = this->activeParticles;
          v19 = this->particleIndex + 1;
          if ( activeParticles < v19 )
            activeParticles = this->particleIndex + 1;
          v20 = v19 % this->maxParticles;
          --v16;
          this->activeParticles = activeParticles;
          this->particleIndex = v20;
        }
        while ( v16 );
      }
      *(_DWORD *)&this->gap470[20] = 0;
    }
  }
  v21 = 0;
  while ( 1 )
  {
    v22 = this->activeParticles;
    v23 = this->maxParticles;
    v344 = v21;
    if ( v23 <= v22 )
      v22 = v23;
    if ( v21 >= v22 )
      break;
    v24 = *(_DWORD *)&this->particles;
    v25 = 224 * v21;
    v26 = *(_DWORD *)(v25 + v24 + 188);
    v27 = v24 + v25;
    if ( (v26 & 1) != 0 )
    {
      v28 = (v26 & 2) == 0 || this->gap50[180] == 1;
      if ( (v26 & 4) != 0 )
      {
        v28 = 0;
        *(_DWORD *)(v27 + 188) = v26 & 0xFFFFFFFB;
      }
      else
      {
        *(float *)(v27 + 172) = deltaTime + *(float *)(v27 + 172);
      }
      if ( *(float *)(v27 + 172) <= (double)*(float *)(v27 + 176) )
      {
        if ( v28 )
        {
          v31 = deltaTime * *(float *)(v27 + 212);
          v32 = deltaTime * *(float *)(v27 + 216);
          v254 = deltaTime * *(float *)(v27 + 220);
          *(float *)(v27 + 24) = v31 + *(float *)(v27 + 24);
          *(float *)(v27 + 28) = v32 + *(float *)(v27 + 28);
          *(float *)(v27 + 32) = v254 + *(float *)(v27 + 32);
          *(_DWORD *)(v27 + 12) = *(_DWORD *)v27;
          v33 = *(_DWORD *)(v27 + 8);
          *(_DWORD *)(v27 + 16) = *(_DWORD *)(v27 + 4);
          *(_DWORD *)(v27 + 20) = v33;
          v34 = *(float *)(v27 + 144) * *(float *)(v27 + 24);
          v35 = *(float *)(v27 + 148) * *(float *)(v27 + 28);
          v248 = *(float *)(v27 + 152) * *(float *)(v27 + 32);
          v250 = v34 * deltaTime;
          v360 = v250 + *(float *)v27;
          v36 = v248 * deltaTime;
          *(float *)v27 = v360;
          hasSkeletalMeshActor = numBones == 0;
          v358 = v35 * deltaTime + *(float *)(v27 + 4);
          *(float *)(v27 + 4) = v358;
          *(float *)&v357 = v36 + *(float *)(v27 + 8);
          *(float *)(v27 + 8) = *(float *)&v357;
          if ( !hasSkeletalMeshActor && this->useSkeletalLocationAs == 2 )
          {
            v37 = (float *)(*(_DWORD *)this->gap494 + 12 * *(_DWORD *)(v27 + 196));
            v322 = *(float *)this->gap2D0 * *v37;
            v323 = v37[1] * *(float *)&this->gap2D0[4];
            v38 = v37[2];
            v39 = v323;
            v324 = v38 * *(float *)&this->gap2D0[8];
            v40 = v324;
            v41 = v322 - *(float *)(v27 + 156);
            v42 = v323 - *(float *)(v27 + 160);
            v43 = v324 - *(float *)(v27 + 164);
            *(float *)(v27 + 156) = v322;
            *(float *)(v27 + 160) = v39;
            v251 = v43;
            *(float *)(v27 + 164) = v40;
            *(float *)v27 = v41 + v360;
            *(float *)(v27 + 4) = v358 + v42;
            *(float *)(v27 + 8) = *(float *)&v357 + v251;
          }
          if ( (this->gap1CC[12] & 0x10) != 0 )
          {
            v44 = *(float *)v27;
            v45 = *(float *)(v27 + 76);
            v46 = *(float *)(v27 + 80);
            v319 = *(float *)(v27 + 72);
            v320 = v45;
            v321 = v46;
            v346 = v44 - v319;
            v47 = *(float *)(v27 + 4);
            v276[0] = 1065353216;
            v276[1] = 0;
            v276[2] = 0;
            v347 = v47 - v45;
            v348 = *(float *)(v27 + 8) - v46;
            v48 = (float *)FVector::RotateAngleAxis(
                             &v346,
                             v243,
                             (unsigned __int64)(*(float *)(v27 + 96) * *(float *)(v27 + 84) * deltaTime * 65535.0),
                             v276);
            v49 = *(float *)(v27 + 100) * *(float *)(v27 + 88);
            v346 = *v48;
            v347 = v48[1];
            v348 = v48[2];
            v271[0] = 0;
            v271[1] = 1065353216;
            v271[2] = 0;
            v50 = (float *)FVector::RotateAngleAxis(&v346, v236, (unsigned __int64)(v49 * deltaTime * 65535.0), v271);
            v51 = *(float *)(v27 + 104) * *(float *)(v27 + 92);
            v346 = *v50;
            v347 = v50[1];
            v348 = v50[2];
            v281[0] = 0;
            v281[1] = 0;
            v281[2] = 1065353216;
            v52 = (float *)FVector::RotateAngleAxis(&v346, v234, (unsigned __int64)(v51 * deltaTime * 65535.0), v281);
            v346 = *v52;
            v347 = v52[1];
            v348 = v52[2];
            v301 = v346 + v319;
            v53 = v347;
            *(float *)v27 = v301;
            v302 = v53 + v320;
            v54 = v348 + v321;
            *(float *)(v27 + 4) = v302;
            v303 = v54;
            *(float *)(v27 + 8) = v303;
          }
        }
      }
      else
      {
        if ( (this->gap50[196] & 8) == 0 )
          goto LABEL_56;
        *(float *)&v357 = FRange::GetRand((FRange *)&this->gap324[52]) + *(float *)(v27 + 172) - *(float *)(v27 + 176);
        if ( *(float *)(v27 + 176) == 0.0 )
          *(float *)&v357 = 0.0;
        else
          *(float *)&v357 = fmod(*(float *)&v357, *(float *)(v27 + 176));
        v30 = *(_DWORD *)this->gap0;
        memset(v274, 0, sizeof(v274));
        (*(void (__thiscall **)(UParticleEmitter *, int, int, _DWORD, _DWORD, int *))(v30 + 124))(
          this,
          v344,
          v357,
          0,
          0,
          v274);
      }
      *(float *)&v357 = 0.0;
      v349 = 0.0;
      v350 = 0.0;
      v351 = 0.0;
      v341 = 0.0;
      v342 = 0.0;
      v343 = 0.0;
      if ( !v28 || this->gap50[180] == 1 )
      {
LABEL_123:
        v110 = *(float *)(v27 + 176);
        v111 = *(float *)(v27 + 172);
        v345 = 1.0;
        v352 = v111;
        v359 = -1;
        if ( v110 == 0.0 || (v112 = v352 / *(float *)(v27 + 176), v112 < 0.0) )
        {
          v354 = 0.0;
        }
        else if ( v112 >= 1.0 )
        {
          v354 = 1.0;
        }
        else
        {
          v354 = v112;
        }
        v113 = *(_DWORD *)&this->gap1CC[204];
        if ( (v113 & 1) != 0 )
        {
          if ( (v113 & 2) != 0 )
          {
            v345 = 1.0 / (*(float *)(v27 + 172) + 1.0);
          }
          else if ( *(float *)(v27 + 176) != 0.0 )
          {
            v221 = (*(float *)&this->gap1CC[220] + 1.0) * v354;
            v114 = appFractional(v221);
            v115 = *(_DWORD *)&this->gap1CC[212];
            v360 = v114;
            v116 = 0;
            if ( v115 > 0 )
            {
              v117 = *(float **)&this->gap1CC[208];
              v118 = v117;
              while ( *v118 < (double)v360 )
              {
                ++v116;
                v118 += 2;
                if ( v116 >= *(_DWORD *)&this->gap1CC[212] )
                  goto LABEL_145;
              }
              v119 = v117[2 * v116 + 1];
              v358 = v117[2 * v116];
              if ( v116 )
              {
                v120 = v117[2 * v116 - 1];
                v121 = v117[2 * v116 - 2];
              }
              else
              {
                v120 = 1.0;
                v121 = 0.0;
              }
              if ( v358 == 0.0 )
                v122 = 1.0;
              else
                v122 = (v360 - v121) / (v358 - v121);
              v345 = (v119 - v120) * v122 + v120;
            }
          }
        }
LABEL_145:
        v289 = v345 * *(float *)(v27 + 36);
        v290 = v345 * *(float *)(v27 + 40);
        v123 = v290;
        v124 = v345 * *(float *)(v27 + 44);
        *(float *)(v27 + 108) = v289;
        *(float *)(v27 + 112) = v123;
        v291 = v124;
        *(float *)(v27 + 116) = v291;
        if ( (this->gap36C[120] & 1) != 0 && *(float *)(v27 + 176) != 0.0 )
        {
          v222 = (*(float *)&this->gap36C[136] + 1.0) * v354;
          v125 = appFractional(v222);
          v126 = *(_DWORD *)&this->gap36C[128];
          v360 = v125;
          v127 = 0;
          if ( v126 > 0 )
          {
            v128 = *(float **)&this->gap36C[124];
            v129 = v128;
            while ( *v129 < (double)v360 )
            {
              ++v127;
              v129 += 4;
              if ( v127 >= *(_DWORD *)&this->gap36C[128] )
                goto LABEL_159;
            }
            v130 = v128[4 * v127];
            v131 = (int *)&v128[4 * v127];
            v307 = *((float *)v131 + 1);
            v132 = *((float *)v131 + 3);
            v308 = *((float *)v131 + 2);
            v309 = v132;
            if ( v127 )
            {
              v133 = *((float *)v131 - 4);
              v335 = *((float *)v131 - 3);
              v134 = *(v131 - 1);
              v336 = *((float *)v131 - 2);
            }
            else
            {
              v133 = 0.0;
              v295 = 1065353216;
              v296 = 1065353216;
              v297 = 1065353216;
              *(float *)&v134 = 1.0;
              v335 = 1.0;
              v336 = 1.0;
            }
            v337 = *(float *)&v134;
            if ( v130 == 0.0 )
              v135 = 1.0;
            else
              v135 = (v360 - v133) / (v130 - v133);
            v260 = v309 - v337;
            v282 = (v307 - v335) * v135;
            v136 = v308 - v336;
            v283 = v135 * v260;
            v304 = v282 + v335;
            *(float *)(v27 + 144) = v304;
            v305 = v135 * v136 + v336;
            v137 = v283 + v337;
            *(float *)(v27 + 148) = v305;
            v306 = v137;
            *(float *)(v27 + 152) = v306;
          }
        }
LABEL_159:
        if ( (this->gap1CC[64] & 1) != 0 && *(float *)(v27 + 176) != 0.0 )
        {
          v223 = (*(float *)&this->gap1CC[80] + 1.0) * v354;
          v138 = appFractional(v223);
          v139 = *(_DWORD *)&this->gap1CC[72];
          v360 = v138;
          v140 = 0;
          if ( v139 > 0 )
          {
            v141 = *(float **)&this->gap1CC[68];
            v142 = v141;
            while ( *v142 < (double)v360 )
            {
              ++v140;
              v142 += 4;
              if ( v140 >= *(_DWORD *)&this->gap1CC[72] )
                goto LABEL_173;
            }
            v143 = v141[4 * v140];
            v144 = (int *)&v141[4 * v140];
            v292 = *((float *)v144 + 1);
            v145 = *((float *)v144 + 3);
            v293 = *((float *)v144 + 2);
            v294 = v145;
            if ( v140 )
            {
              v146 = *((float *)v144 - 4);
              v332 = *((float *)v144 - 3);
              v147 = *(v144 - 1);
              v333 = *((float *)v144 - 2);
            }
            else
            {
              v146 = 0.0;
              v298 = 1065353216;
              v299 = 1065353216;
              v300 = 1065353216;
              *(float *)&v147 = 1.0;
              v332 = 1.0;
              v333 = 1.0;
            }
            v334 = *(float *)&v147;
            if ( v143 == 0.0 )
              v148 = 1.0;
            else
              v148 = (v360 - v146) / (v143 - v146);
            v258 = v294 - v334;
            v279 = (v292 - v332) * v148;
            v149 = v293 - v333;
            v280 = v148 * v258;
            v325 = v279 + v332;
            *(float *)(v27 + 96) = v325;
            v326 = v148 * v149 + v333;
            v150 = v280 + v334;
            *(float *)(v27 + 100) = v326;
            v327 = v150;
            *(float *)(v27 + 104) = v327;
          }
        }
LABEL_173:
        if ( (this->gap50[84] & 2) != 0 && *(float *)(v27 + 176) != 0.0 )
        {
          v224 = (*(float *)&this->gap50[100] + 1.0) * v354;
          v151 = appFractional(v224);
          v152 = *(_DWORD *)&this->gap50[92];
          *(float *)&v361 = v151;
          v153 = 0;
          if ( v152 > 0 )
          {
            v154 = *(float **)&this->gap50[88];
            v155 = v154;
            while ( *v155 < (double)*(float *)&v361 )
            {
              ++v153;
              v155 += 2;
              if ( v153 >= *(_DWORD *)&this->gap50[92] )
                goto LABEL_189;
            }
            v156 = v154[2 * v153];
            v358 = v154[2 * v153 + 1];
            if ( v153 )
            {
              v157 = v154[2 * v153 - 1];
              v158 = v154[2 * v153 - 2];
            }
            else
            {
              v158 = 0.0;
              v338 = -1;
              v157 = NAN;
            }
            v360 = v157;
            if ( v156 == 0.0 )
              v159 = 1.0;
            else
              v159 = (*(float *)&v361 - v158) / (v156 - v158);
            v361 = BYTE2(v358) - BYTE2(v360);
            BYTE2(v359) = (unsigned __int64)((double)v361 * v159 + (double)BYTE2(v360));
            Rand = BYTE1(v358) - BYTE1(v157);
            BYTE1(v359) = (unsigned __int64)((double)(int)Rand * v159 + (double)BYTE1(v157));
            Rand = LOBYTE(v358) - LOBYTE(v157);
            v361 = LOBYTE(v157);
            LOBYTE(v359) = (unsigned __int64)((double)(int)Rand * v159 + (double)LOBYTE(v157));
            if ( this->gap324[0] == 1 )
            {
              Rand = HIBYTE(v358) - HIBYTE(v360);
              v361 = HIBYTE(v360);
              HIBYTE(v359) = (unsigned __int64)((double)(int)Rand * v159 + (double)HIBYTE(v360));
            }
            else
            {
              HIBYTE(v359) = -1;
            }
          }
        }
LABEL_189:
        Rand = BYTE2(v359);
        v160 = (unsigned __int64)((double)BYTE2(v359) * *(float *)(v27 + 132));
        Rand = BYTE1(v359);
        BYTE2(v359) = v160;
        v161 = (unsigned __int64)((double)BYTE1(v359) * *(float *)(v27 + 136));
        Rand = (unsigned __int8)v359;
        v162 = v161;
        BYTE1(v359) = v161;
        v163 = *(_DWORD *)&this->gap50[152] & 1;
        LOBYTE(v359) = (unsigned __int64)((double)(unsigned __int8)v359 * *(float *)(v27 + 140));
        if ( v163 && v352 > (double)*(float *)&this->gap50[148] && *(float *)(v27 + 176) != *(float *)&this->gap50[148]
          || (this->gap50[176] & 1) != 0
          && v352 < (double)*(float *)&this->gap50[172]
          && *(float *)&this->gap50[172] != 0.0 )
        {
          if ( v163 && v352 > (double)*(float *)&this->gap50[148] )
          {
            v164 = (int *)&this->gap50[132];
            v165 = (v352 - *(float *)&this->gap50[148]) / (*(float *)(v27 + 176) - *(float *)&this->gap50[148]);
          }
          else
          {
            v164 = (int *)&this->gap50[156];
            v165 = (*(float *)&this->gap50[172] - v352) / *(float *)&this->gap50[172];
          }
          v166 = *((float *)v164 + 1);
          v328 = *(float *)v164;
          v167 = *((float *)v164 + 2);
          v329 = v166;
          v168 = *((float *)v164 + 3);
          v169 = this->gap324[0];
          v170 = v165 * 255.0;
          v330 = v167;
          v331 = v168;
          if ( v169 == 2 )
          {
            LOWORD(v339) = 32639;
            BYTE2(v339) = 127;
            HIBYTE(v339) = -1 - (unsigned __int64)(v331 * v170);
            v359 = v339;
          }
          else if ( v169 == 1 )
          {
            Rand = HIBYTE(v359);
            v171 = (double)HIBYTE(v359) - v331 * v170;
            v172 = v171;
            if ( v171 >= 0.0 )
            {
              if ( v171 >= 255.0 )
                v172 = 255.0;
              HIBYTE(v359) = (unsigned __int64)v172;
            }
            else
            {
              HIBYTE(v359) = (unsigned __int64)0.0;
            }
          }
          else
          {
            Rand = BYTE2(v359);
            v173 = (double)BYTE2(v359) - v328 * v170;
            if ( v173 >= 0.0 )
            {
              if ( v173 >= 255.0 )
                v173 = 255.0;
            }
            else
            {
              v173 = 0.0;
            }
            Rand = v162;
            v361 = (unsigned __int64)v173;
            v174 = (double)v162 - v329 * v170;
            if ( v174 >= 0.0 )
            {
              if ( v174 >= 255.0 )
                v174 = 255.0;
            }
            else
            {
              v174 = 0.0;
            }
            v175 = (unsigned __int64)v174;
            Rand = (unsigned __int8)v359;
            v176 = (double)(unsigned __int8)v359 - v330 * v170;
            if ( v176 >= 0.0 )
            {
              if ( v176 >= 255.0 )
                v176 = 255.0;
            }
            else
            {
              v176 = 0.0;
            }
            Rand = HIBYTE(v359);
            v177 = (unsigned __int64)v176;
            v178 = (double)HIBYTE(v359) - v331 * v170;
            v179 = v178;
            if ( v178 >= 0.0 )
            {
              if ( v178 >= 255.0 )
                v179 = 255.0;
            }
            else
            {
              v179 = 0.0;
            }
            LOBYTE(v340) = v177;
            BYTE1(v340) = v175;
            BYTE2(v340) = v361;
            HIBYTE(v340) = (unsigned __int64)v179;
            v359 = v340;
          }
        }
        *(_DWORD *)(v27 + 168) = v359;
        if ( *(float *)&this->gap50[128] < 1.0 )
        {
          v180 = this->gap324[0];
          if ( v180 )
          {
            if ( v180 == 1 || v180 == 2 || v180 == 4 )
            {
              Rand = *(unsigned __int8 *)(v27 + 171);
              *(_BYTE *)(v27 + 171) = (unsigned __int64)((double)(int)Rand * *(float *)&this->gap50[128]);
            }
            else
            {
              Rand = *(unsigned __int8 *)(v27 + 170);
              v181 = (unsigned __int64)((double)(int)Rand * *(float *)&this->gap50[128]);
              Rand = *(unsigned __int8 *)(v27 + 169);
              *(_BYTE *)(v27 + 170) = v181;
              v182 = (unsigned __int64)((double)(int)Rand * *(float *)&this->gap50[128]);
              Rand = *(unsigned __int8 *)(v27 + 168);
              *(_BYTE *)(v27 + 169) = v182;
              *(_BYTE *)(v27 + 168) = (unsigned __int64)((double)(int)Rand * *(float *)&this->gap50[128]);
            }
          }
        }
        switch ( this->gap50[180] )
        {
          case 0:
          case 2:
          case 4:
            FBox::operator+=(&this->boundingBox, v27);
            break;
          case 1:
            v183 = (float *)this->owner;
            v184 = FCoords::operator*((char *)&GMath + 24, v229, v183 + 114);
            v185 = (float *)FVector::TransformPointBy(v27, v237, v184);
            v186 = v183[113] + v185[2];
            v187 = v183[112] + v185[1];
            v277[0] = *v185 + v183[111];
            v277[1] = v187;
            v277[2] = v186;
            FBox::operator+=(&this->boundingBox, v277);
            break;
          case 3:
            v188 = (float *)this->owner;
            v189 = FCoords::operator*((char *)&GMath + 24, v227, v188 + 114);
            v190 = (float *)FVector::TransformPointBy(v27, v231, v189);
            v191 = v190[2] + v188[113];
            v192 = v190[1] + v188[112];
            v275[0] = *v190 + v188[111];
            v275[1] = v192;
            v275[2] = v191;
            FBox::operator+=(&this->boundingBox, v275);
            break;
          default:
            break;
        }
        if ( *(float *)&this->gap36C[52] != 0.0 )
        {
          v193 = -*(float *)&this->gap36C[52];
          v318 = *(float *)&this->gap36C[52];
          v194 = *(float *)(v27 + 24);
          v361 = *(int *)(v27 + 24);
          if ( v194 >= v193 )
          {
            if ( *(float *)&v361 >= (double)v318 )
              v193 = v318;
            else
              v193 = *(float *)&v361;
          }
          *(float *)(v27 + 24) = v193;
        }
        if ( *(float *)&this->gap36C[56] != 0.0 )
        {
          v195 = -*(float *)&this->gap36C[56];
          v313 = *(float *)&this->gap36C[56];
          v196 = *(float *)(v27 + 28);
          v361 = *(int *)(v27 + 28);
          if ( v196 >= v195 )
          {
            if ( *(float *)&v361 >= (double)v313 )
              v195 = v313;
            else
              v195 = *(float *)&v361;
          }
          *(float *)(v27 + 28) = v195;
        }
        if ( *(float *)&this->gap36C[60] != 0.0 )
        {
          v197 = -*(float *)&this->gap36C[60];
          _maxActiveParticles = *(float *)&this->gap36C[60];
          v198 = *(float *)(v27 + 32);
          v361 = *(int *)(v27 + 32);
          if ( v198 >= v197 )
          {
            if ( *(float *)&v361 >= (double)_maxActiveParticles )
              v197 = _maxActiveParticles;
            else
              v197 = *(float *)&v361;
          }
          *(float *)(v27 + 32) = v197;
        }
        if ( this->gap50[180] != 4 || (this->useCollision & 1) != 0 )
        {
          Rand = FRangeVector::GetRand(&this->gap36C[64], v240);
          v199 = (FVector *)(v27 + 24);
          v206 = (float *)FVector::TransformVectorBy(v27 + 24, v238, (char *)&GMath + 24);
          v207 = *v206 * *(float *)Rand;
          v208 = *(float *)(Rand + 4) * v206[1];
          v270 = *(float *)(Rand + 8) * v206[2];
          v252 = v207 * deltaTime;
          v209 = v208 * deltaTime;
          v210 = v270 * deltaTime;
          *(float *)(v27 + 24) = *(float *)(v27 + 24) - v252;
          *(float *)(v27 + 28) = *(float *)(v27 + 28) - v209;
          *(float *)(v27 + 32) = *(float *)(v27 + 32) - v210;
        }
        else
        {
          Rand = FRangeVector::GetRand(&this->gap36C[64], v246);
          v199 = (FVector *)(v27 + 24);
          v200 = FCoords::operator/((char *)&GMath + 24, v228, v27 + 200);
          v201 = (float *)FVector::TransformVectorBy(v27 + 24, v244, v200);
          v202 = *(float *)Rand * *v201;
          v203 = *(float *)(Rand + 4) * v201[1];
          v256 = *(float *)(Rand + 8) * v201[2];
          v273[0] = v202 * deltaTime;
          v273[1] = v203 * deltaTime;
          v273[2] = v256 * deltaTime;
          v204 = FCoords::operator*((char *)&GMath + 24, v226, v27 + 200);
          v205 = (float *)FVector::TransformVectorBy(v273, v242, v204);
          *(float *)(v27 + 24) = *(float *)(v27 + 24) - *v205;
          *(float *)(v27 + 28) = *(float *)(v27 + 28) - v205[1];
          *(float *)(v27 + 32) = *(float *)(v27 + 32) - v205[2];
        }
        if ( *(float *)&v357 != 0.0
          && *(float *)&this->gap324[48] != 0.0
          && FVector::SizeSquared(v199) < (double)*(float *)&this->gap324[48] )
        {
          *(_DWORD *)(v27 + 188) |= 2u;
        }
        (*(void (__thiscall **)(UParticleEmitter *, _DWORD, int))(*(_DWORD *)this->gap0 + 132))(
          this,
          LODWORD(deltaTime),
          v344);
        v21 = v344 + 1;
      }
      else
      {
        if ( (this->useCollision & 2) != 0 )
        {
          v272[0] = *(float *)v27 - *(float *)(v27 + 12);
          v268 = 0;
          v272[1] = *(float *)(v27 + 4) - *(float *)(v27 + 16);
          v272[2] = *(float *)(v27 + 8) - *(float *)(v27 + 20);
          v55 = (float *)FVector::SafeNormal(v272, v245);
          v56 = *v55 * this->realExtentMultiplier.x;
          y = this->realExtentMultiplier.y;
          memset(&v285[3], 0, 12);
          v58 = y * v55[1];
          v59 = this->realExtentMultiplier.z * v55[2];
          v361 = *(int *)&this->owner[228];
          v259 = v59;
          v315 = v56 * *(float *)(v27 + 108);
          v316 = v58 * *(float *)(v27 + 112);
          v317 = v259 * *(float *)(v27 + 116);
          v278[0] = v315 + *(float *)v27;
          v278[1] = v316 + *(float *)(v27 + 4);
          v278[2] = v317 + *(float *)(v27 + 8);
          if ( !(*(int (__thiscall **)(int, char *, AEmitter *, float *, int, int, _DWORD, _DWORD, _DWORD))(*(_DWORD *)v361 + 224))(
                  v361,
                  v261,
                  this->owner,
                  v278,
                  v27 + 12,
                  132,
                  0,
                  0,
                  0) )
          {
            v349 = v265;
            v286 = v262 - v315;
            v350 = v266;
            v351 = v267;
            v341 = v286;
            v357 = 1;
            v287 = v263 - v316;
            v342 = v287;
            v288 = v264 - v317;
            v343 = v288;
          }
        }
        if ( (this->gap50[24] & 1) != 0 )
        {
          if ( *(float *)&v357 == 0.0 )
          {
            v60 = 0;
            if ( *(int *)&this->gap50[32] <= 0 )
              goto LABEL_123;
            v61 = *(float **)&this->gap50[28];
            while ( 1 )
            {
              v62 = *(float *)(v27 + 8) * v61[2] + *(float *)(v27 + 4) * v61[1] + *v61 * *(float *)v27 - v61[3];
              if ( v62 <= 0.0 )
              {
                v358 = NAN;
                if ( v62 >= 0.0 )
                  v358 = 0.0;
              }
              else
              {
                LODWORD(v358) = 1;
              }
              v63 = *(float *)(v27 + 20) * v61[2] + *(float *)(v27 + 16) * v61[1] + *v61 * *(float *)(v27 + 12) - v61[3];
              if ( v63 <= 0.0 )
              {
                v360 = NAN;
                if ( v63 >= 0.0 )
                  v360 = 0.0;
              }
              else
              {
                LODWORD(v360) = 1;
              }
              if ( (double)SLODWORD(v360) != (double)SLODWORD(v358) )
                break;
              ++v60;
              v61 += 4;
              if ( v60 >= *(_DWORD *)&this->gap50[32] )
                goto LABEL_123;
            }
            v64 = (float *)sub_A5906B(v235, v27, v27 + 12, v61);
            v65 = *v64;
            v66 = v64[1];
            v67 = v64[2];
            v341 = v65;
            v349 = *v61;
            v342 = v66;
            v68 = v61[1];
            v343 = v67;
            v350 = v68;
            v351 = v61[2];
            v357 = 1;
          }
        }
        else if ( *(float *)&v357 == 0.0 )
        {
          goto LABEL_123;
        }
        v69 = this->gap2D0[52];
        if ( v69 && *(_DWORD *)(*(_DWORD *)(*(_DWORD *)&this->owner[228] + 116) + 92) )
        {
          v70 = 0;
          v71 = v69 - 1;
          if ( v71 )
          {
            v72 = v71 - 1;
            if ( v72 )
            {
              if ( v72 == 1 )
                v70 = (unsigned __int64)(appSRand() * 1000.0);
            }
            else
            {
              v70 = *(_DWORD *)(v27 + 184);
            }
          }
          else
          {
            v70 = *(_DWORD *)this->gap470;
            *(_DWORD *)this->gap470 = v70 + 1;
          }
          if ( FRange::Size((FRange *)&this->gap2D0[56]) == 0.0 )
            v73 = (double)*(int *)&this->gap2D0[24];
          else
            v73 = FRange::Size((FRange *)&this->gap2D0[56]) + 1.0;
          v74 = (unsigned __int64)*(float *)&this->gap2D0[56] + v70 % (int)(unsigned __int64)v73;
          if ( v74 >= 0 )
          {
            if ( v74 >= *(_DWORD *)&this->gap2D0[24] )
              v74 = *(_DWORD *)&this->gap2D0[24];
          }
          else
          {
            v74 = 0;
          }
          v75 = 40 * v74;
          v361 = v75 + *(_DWORD *)&this->gap2D0[20];
          v360 = appSRand();
          *(float *)&v361 = FRange::GetRand((FRange *)(v361 + 32));
          v76 = FRange::GetRand((FRange *)&this->gap2D0[64]);
          if ( v76 * *(float *)&v361 >= v360 )
          {
            v77 = *(int **)(*(_DWORD *)(*(_DWORD *)&this->owner[228] + 116) + 92);
            LODWORD(v78) = v75 + *(_DWORD *)&this->gap2D0[20];
            v79 = this->owner;
            v80 = *v77;
            v360 = v78;
            v358 = *(float *)&v77;
            v361 = (int)v79;
            FRange::GetRand((FRange *)(LODWORD(v78) + 12));
            FRange::GetRand((FRange *)(LODWORD(v360) + 4));
            v81 = FRange::GetRand((FRange *)(LODWORD(v360) + 24));
            v219 = v81 * *(float *)(v361 + 744);
            (*(void (__thiscall **)(float, int, _DWORD, _DWORD, float, float, float, _DWORD))(v80 + 124))(
              COERCE_FLOAT(LODWORD(v358)),
              v361,
              0,
              *(_DWORD *)LODWORD(v360),
              COERCE_FLOAT(LODWORD(v341)),
              COERCE_FLOAT(LODWORD(v342)),
              COERCE_FLOAT(LODWORD(v343)),
              LODWORD(v219));
          }
        }
        if ( (this->gap50[40] & 1) == 0
          || (v220 = FRange::GetRand((FRange *)&this->gap50[44]), *(_DWORD *)(v27 + 184) + 1 < appFloor(v220)) )
        {
          v83 = deltaTime * this->acceleration.x;
          v84 = deltaTime * this->acceleration.y;
          v253 = deltaTime * this->acceleration.z;
          v257 = v83 * 0.5;
          v85 = v84 * 0.5;
          v86 = v253 * 0.5;
          *(float *)(v27 + 24) = *(float *)(v27 + 24) - v257;
          *(float *)(v27 + 28) = *(float *)(v27 + 28) - v85;
          *(float *)(v27 + 32) = *(float *)(v27 + 32) - v86;
          v87 = (_DWORD *)FVector::MirrorByVector(v27 + 24, v247, &v349);
          *(_DWORD *)(v27 + 24) = *v87;
          *(_DWORD *)(v27 + 28) = v87[1];
          *(_DWORD *)(v27 + 32) = v87[2];
          v88 = FRangeVector::GetRand(this->gap50, v232);
          FVector::operator*=(v27 + 24, v241, v88);
          if ( (this->gap1CC[164] & 1) != 0 )
          {
            v89 = FRangeVector::GetRand(&this->gap1CC[168], v233);
            FVector::operator*=(v27 + 48, v239, v89);
          }
          v249 = v351 * 0.0099999998;
          v90 = v350 * 0.0099999998;
          v310 = v349 * 0.0099999998 + v341;
          v91 = v310;
          *(float *)v27 = v310;
          v311 = v90 + v342;
          v92 = v311;
          v93 = v249 + v343;
          *(float *)(v27 + 4) = v311;
          v312 = v93;
          v94 = v312;
          *(float *)(v27 + 8) = v312;
          *(float *)(v27 + 12) = v91;
          v95 = *(_DWORD *)(v27 + 184);
          *(float *)(v27 + 16) = v92;
          *(float *)(v27 + 20) = v94;
          *(_DWORD *)(v27 + 184) = v95 + 1;
          goto LABEL_113;
        }
        if ( (this->gap50[196] & 8) != 0 )
        {
          v82 = *(_DWORD *)this->gap0;
          v218 = deltaTime * 0.5;
          memset(v285, 0, 12);
          (*(void (__thiscall **)(UParticleEmitter *, int, _DWORD, _DWORD, _DWORD, int *))(v82 + 124))(
            this,
            v344,
            LODWORD(v218),
            0,
            0,
            v285);
LABEL_113:
          v96 = *(_DWORD *)&this->gap50[52];
          if ( v96 >= 0 )
          {
            v97 = *(int **)(*(_DWORD *)&this->owner[936] + 4 * v96);
            if ( (v97[257] & 1) != 0 )
            {
              if ( v97[256] )
              {
                if ( deltaTime != 0.0 )
                {
                  v98 = *(_DWORD *)&this->gap50[56];
                  v360 = 0.0;
                  if ( v98 > 0 )
                  {
                    do
                    {
                      v99 = *v97;
                      v100 = v97[262];
                      v255 = v351 * 0.0099999998;
                      v284[0] = v349 * 0.0099999998 + v341;
                      v284[1] = v350 * 0.0099999998 + v342;
                      v284[2] = v255 + v343;
                      (*(void (__thiscall **)(int *, int, _DWORD, _DWORD, int, float *))(v99 + 124))(
                        v97,
                        v100,
                        LODWORD(deltaTime),
                        0,
                        3,
                        v284);
                      if ( (this->gap50[84] & 1) != 0 )
                      {
                        v361 = v97[259] + 224 * v97[262];
                        v101 = (float *)FRangeVector::GetRand(&this->gap50[60], v230);
                        v102 = v349 * *v101;
                        v103 = v350 * v101[1];
                        v104 = v351 * v101[2];
                        v105 = (FRange *)v361;
                        v269 = v104;
                        *(float *)(v361 + 24) = v102 + *(float *)(v361 + 24);
                        v105[3].max = v103 + v105[3].max;
                        v105[4].min = v269 + v105[4].min;
                      }
                      v106 = v97[263];
                      v107 = v97[262] + 1;
                      if ( v106 < v107 )
                        v106 = v97[262] + 1;
                      v108 = v107 % v97[283];
                      v109 = v360;
                      v97[263] = v106;
                      ++LODWORD(v109);
                      v360 = v109;
                      v97[262] = v108;
                    }
                    while ( SLODWORD(v109) < *(_DWORD *)&this->gap50[56] );
                  }
                }
              }
            }
          }
          goto LABEL_123;
        }
LABEL_56:
        v29 = deadParticles;
        *(_DWORD *)(v27 + 188) &= ~1u;
        deadParticles = v29 + 1;
        v21 = v344 + 1;
      }
    }
    else
    {
      ++deadParticles;
      v21 = v344 + 1;
    }
  }
  v211 = *(_DWORD *)&this->gap1CC[204];
  v212 = 1.0;
  if ( (v211 & 1) != 0 && (v211 & 2) == 0 && *(int *)&this->gap1CC[212] > 0 )
  {
    v213 = (float *)(*(_DWORD *)&this->gap1CC[208] + 4);
    v214 = *(_DWORD *)&this->gap1CC[212];
    do
    {
      if ( *v213 >= v212 )
        v212 = *v213;
      v213 += 2;
      --v214;
    }
    while ( v214 );
  }
  v215 = deadParticles;
  *(float *)&this->gap470[12] = v212;
  if ( (v215 >= this->maxParticles || this->activeParticles == v215)
    && *(float *)&rate == 0.0
    && (this->gap50[196] & 8) == 0 )
  {
    *(_DWORD *)this->gap44C |= 2u;
    return this->activeParticles - v215;
  }
  else
  {
    *(_DWORD *)this->gap44C &= ~2u;
    return this->activeParticles - v215;
  }
}