import UIKit
import Capacitor
import AVFoundation

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // The one and only place this app's audio session is configured.
        //
        // The bundled TTS plugin used to set it too, from a background queue in
        // its own init, so the effective category was a race between the two
        // writers and nondeterministic. patches/@capacitor-community+text-to-
        // speech+6.1.0.patch takes that second writer out; do not add another.
        //
        // .playback, NOT .ambient. Ambient is silenced by the Ring/Silent
        // switch, so every time it won that race the app went completely mute
        // on a phone set to silent - no bell, no clack, no callouts. That is
        // not a state a round timer can ever be in: the user starts a round and
        // hears nothing, with no indication why. Ambient also cannot play in
        // the background, which quietly contradicted the UIBackgroundModes:
        // audio entitlement in Info.plist and stopped the round bell firing
        // once the screen locked mid-round.
        //
        // .mixWithOthers, NOT .duckOthers: Spotify and Apple Music keep playing
        // underneath at full volume, rather than dipping every time a technique
        // is called. Cooperative mixing is the long-standing intent here; the
        // plugin's .duckOthers was working against it.
        //
        // NOTE: setting this at launch is necessary but NOT sufficient. WebKit
        // overwrites the category for web content - see AudioSessionPlugin at
        // the bottom of this file - so the web layer calls back in to re-apply
        // it once its AudioContext exists. This is the same code both times.
        AppDelegate.applyAudioSessionCategory()

        // Override point for customization after application launch.
        return true
    }

    /// `.playback` so the Ring/Silent switch cannot mute a round timer, and
    /// `.mixWithOthers` so the user's music keeps playing underneath instead of
    /// being interrupted every time a round starts. Those two together are the
    /// whole requirement, and no web API can express them - see
    /// AudioSessionPlugin.
    static func applyAudioSessionCategory() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try session.setActive(true)
        } catch {
            print("⚠️ Failed to configure audio session: \(error.localizedDescription)")
        }
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Coming back from a call, Siri, or another app can leave the session
        // on someone else's terms. Cheap to re-apply, and it costs nothing when
        // the category is already what we want.
        AppDelegate.applyAudioSessionCategory()
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

/// Puts the `.mixWithOthers` option back after WebKit has taken the session.
///
/// WebKit does not give web content the app's AVAudioSession category. It keeps
/// its own page-level session and maps `navigator.audioSession.type` onto a
/// category itself (WebCore's `fromDOMAudioSessionType`). That mapping takes no
/// options, and every type that WOULD mix - "transient", "ambient" - maps to
/// AmbientSound, which the Ring/Silent switch mutes. So from web code alone the
/// choice is audible-on-silent OR mixing, never both:
///
///     playback       -> MediaPlayback      audible, interrupts other audio
///     transient      -> AmbientSound       muted by the switch, mixes
///     ambient        -> AmbientSound       muted by the switch, mixes
///     transient-solo -> SoloAmbientSound   muted by the switch, exclusive
///
/// The combination this app needs - playback WITH mixWithOthers - has no web
/// spelling at all. So the web layer sets type = "playback" (which gets WebKit
/// to MediaPlayback, defeating the mute switch) and then calls this straight
/// after building its AudioContext, and we add back the one option WebKit
/// dropped. Without it, starting a round stops the user's music.
///
/// Lives in AppDelegate.swift rather than its own file on purpose: a new file
/// has to be registered in project.pbxproj, and that cannot be compile-checked
/// from the Windows box this is usually edited on. Capacitor finds the class
/// through the ObjC runtime, so which file it sits in does not matter.
@objc(AudioSessionPlugin)
public class AudioSessionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AudioSessionPlugin"
    public let jsName = "AudioSession"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "apply", returnType: CAPPluginReturnPromise)
    ]

    @objc func apply(_ call: CAPPluginCall) {
        AppDelegate.applyAudioSessionCategory()

        // Report what actually stuck, not what we asked for. If WebKit wins a
        // future round of this, these two values are what will show it.
        let session = AVAudioSession.sharedInstance()
        call.resolve([
            "category": session.category.rawValue,
            "mixesWithOthers": session.categoryOptions.contains(.mixWithOthers)
        ])
    }
}
