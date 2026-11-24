#if defined(USE_FOG) && defined(USE_FOG_INFO)
    vec4 fogInfo = getFogInfo();

    #ifdef USE_MODULATED_FOG
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(127.0 / 255.0), fogInfo.a);
    #elif defined(USE_ADDITIVE_FOG)
        gl_FragColor.rgb *= 1.0 - fogInfo.a;
    #else
        gl_FragColor.rgb = mix(gl_FragColor.rgb, fogInfo.rgb, fogInfo.a);
    #endif
#endif
