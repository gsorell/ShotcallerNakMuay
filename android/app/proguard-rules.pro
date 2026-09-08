# R8 rules for the release build.
#
# Play Console's "App optimization is below our threshold" advisory (Obfuscation
# 5%, deadline Feb 2027) is what these exist for: the release build ran with
# `minifyEnabled false`, so nothing but incidental library bytecode was ever
# obfuscated.
#
# These rules are deliberately conservative. Size is not the goal — 62 MB of the
# 70 MB bundle is `assets/public` (audio and technique sprites), which R8 cannot
# touch, so the entire prize is a fraction of ~16 MB of dex. What R8 *can* do is
# break this app silently: Capacitor resolves plugins reflectively by class name
# and method annotation, and a stripped or renamed plugin fails at runtime in
# release builds only, with a successful build and no warning. Keeping too much
# costs a few hundred KB; keeping too little costs a broken store release.
#
# NOTE: several dependencies ship their own consumer rules, which AGP merges in
# automatically — @capacitor/android carries the plugin/annotation keeps, and
# the Facebook SDK carries its own. The rules below are the ones that are ours
# to own, plus belt-and-braces duplicates where the failure would be silent.

# ---------------------------------------------------------------- crash traces
# Without these, every stack trace in Play Console Vitals is unreadable. The
# mapping file is embedded in the AAB automatically (BUNDLE-METADATA), so Play
# can deobfuscate as long as the line numbers survive.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Annotations, generic signatures and inner-class metadata. Capacitor reads
# @CapacitorPlugin and @PluginMethod at runtime; dropping RuntimeVisible
# annotations makes every plugin invisible to the bridge.
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod,Exceptions

# ------------------------------------------------------------- our own plugins
# AudioSessionPlugin and InstallInfoPlugin are registered by class in
# MainActivity and then called from JS by the names in their annotations.
# @capacitor/android's consumer rules already cover `public class * extends
# com.getcapacitor.Plugin`, but these are the two whose loss would be worst and
# least obvious — ducking silently stopping, or grandfathered owners silently
# losing Pro — so they are pinned explicitly rather than by inheritance.
-keep public class com.shotcallernakmuay.app.AudioSessionPlugin { *; }
-keep public class com.shotcallernakmuay.app.InstallInfoPlugin { *; }
-keep public class com.shotcallernakmuay.app.MainActivity { *; }

# ------------------------------------------------------------------- Capacitor
-keep public class * extends com.getcapacitor.Plugin { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * {
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
    @com.getcapacitor.annotation.Permission <methods>;
    @com.getcapacitor.PluginMethod public <methods>;
}
-keep @com.getcapacitor.NativePlugin public class * {
    @com.getcapacitor.PluginMethod public <methods>;
}
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }

# The bridge exposes objects to the WebView through @JavascriptInterface; the
# names are the contract with JS and cannot be renamed.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ---------------------------------------------------------------------- Cordova
# cordova-android rides along with Capacitor and resolves plugin classes from
# strings in config, which R8 cannot follow.
-keep class org.apache.cordova.** { *; }
-keep public class * extends org.apache.cordova.CordovaPlugin { *; }

# ------------------------------------------------------------------ RevenueCat
# purchases-capacitor ships no consumer rules of its own. Entitlement resolution
# failing quietly is the worst outcome in this app - a paying subscriber sees
# the free tier - so the SDK and Play Billing are kept whole.
-keep class com.revenuecat.purchases.** { *; }
-keep interface com.revenuecat.purchases.** { *; }
-keep class com.android.billingclient.** { *; }
-keep interface com.android.billingclient.** { *; }

# RevenueCat's models are Kotlin and some are kotlinx-serializable. R8 has
# built-in handling for kotlinx.serialization, but the failure mode if a version
# bump outruns that support is a deserialization error at purchase time.
-keepclassmembers class **$$serializer { *; }
-keepclassmembers @kotlinx.serialization.Serializable class * { *; }
-keep,includedescriptorclasses class kotlinx.serialization.** { *; }

# ------------------------------------------------------------------ Meta / ads
# facebook-core ships consumer rules, but the install-attribution path is
# reflective (a ContentProvider initialises the SDK before onCreate, and the
# Install Referrer is read across a process boundary). A break here is invisible
# by definition: Meta accepts an event and drops it as unmatched. See
# docs/RELEASE_NOTES_v1.17.2.md.
-keep class com.facebook.** { *; }
-keep interface com.facebook.** { *; }
-keep class com.android.installreferrer.** { *; }

# ------------------------------------------------------------------- Kotlin/JVM
-keep class kotlin.Metadata { *; }
-dontwarn kotlin.**
-dontwarn kotlinx.**

# --------------------------------------------------------------------- WebView
# The app is a WebView shell; JS bridge classes must not be renamed.
-keepclassmembers class * extends android.webkit.WebChromeClient {
    public void *(android.webkit.WebView, java.lang.String);
}

# ------------------------------------------------------------------ diagnostics
# Emitted to android/app/build/outputs/mapping/release/. `usage.txt` lists what
# R8 removed - read it before believing a passing build, since everything this
# file gets wrong fails at runtime rather than at compile time.
-printusage build/outputs/mapping/release/usage.txt
-printseeds build/outputs/mapping/release/seeds.txt
