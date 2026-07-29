#ifdef USE_FOG
    #ifdef FOG_EXP2
        float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
    #else
        float fogFactor = clamp( ( vFogDepth - fogNear ) / ( fogFar - fogNear ), 0.0, 1.0 );
    #endif

    #ifdef USE_MODULATED_FOG
        vec3 fogMixColor = vec3(127.0 / 255.0);
    #elif defined(USE_ADDITIVE_FOG)
        vec3 fogMixColor = vec3(0.0);
    #else
        vec3 fogMixColor = fogColor;
    #endif

    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogMixColor, fogFactor );
    gl_FragColor.a = max(gl_FragColor.a, 0.0);
#endif
