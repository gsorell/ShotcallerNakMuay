package com.shotcallernakmuay.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Custom plugins MUST be registered BEFORE super.onCreate().
        //
        // registerPlugin() only adds to bridgeBuilder, and BridgeActivity's
        // super.onCreate() is what calls bridgeBuilder.create(). Registering
        // afterwards mutates a builder that has already been consumed, so the
        // plugin is silently never registered — no error, no warning, it just
        // never appears in the bridge and every call from JS fails.
        registerPlugin(AudioSessionPlugin.class);
        registerPlugin(InstallInfoPlugin.class);

        super.onCreate(savedInstanceState);
    }
}
