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
            // Never while a session is being filmed: WebKit moves the session
            // to .playAndRecord while the microphone is open, and .playback
            // has no input, so putting it back mid-session (coming back from
            // Control Center or a notification fires applicationDidBecomeActive)
            // would leave the rest of the reel and the full session silent.
            // .playAndRecord isn't muted by the Ring/Silent switch either.
            if session.category == .playAndRecord { return }
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

/// Registered by scripts/register-ios-app-plugins.mjs, which adds it to the
/// generated capacitor.config.json's packageClassList after every cap sync:
/// iOS registers only the classes named there, and cap sync lists the npm
/// plugins alone. (AudioSessionPlugin above isn't listed, so it has never been
/// registered; the web layer's call to it fails quietly. Left that way on
/// purpose for now: see applyAudioSessionCategory.)
///
/// Rewrites the full session (see fullSession.ts) as an ordinary MP4 that
/// Photos can scrub, with only the stretches that were work in it: the rests
/// are cut, and what's left is joined back to back.
///
/// The same job as VideoRemuxPlugin.java on Android, done with AVFoundation:
/// the kept stretches go into a composition, exported with the passthrough
/// preset, so nothing is re-encoded. If the cut fails, the whole file is
/// exported instead (the summary says "uncut"); if that fails too, the call
/// rejects and the caller saves the file as it was recorded.
@objc(VideoRemuxPlugin)
public class VideoRemuxPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "VideoRemuxPlugin"
    public let jsName = "VideoRemux"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "remuxToMp4", returnType: CAPPluginReturnPromise)
    ]

    /// `{ from, to, keep? }`: file:// URIs, and the stretches to keep as
    /// `[{ fromMs, toMs }]` from the first frame. Resolves `{ uri, summary }`.
    @objc func remuxToMp4(_ call: CAPPluginCall) {
        guard let from = call.getString("from"), let to = call.getString("to"),
              let inURL = VideoRemuxPlugin.fileURL(from),
              let outURL = VideoRemuxPlugin.fileURL(to) else {
            call.reject("from and to are required")
            return
        }
        var spans: [(Double, Double)] = []
        for item in call.getArray("keep") ?? [] {
            guard let o = item as? JSObject,
                  let f = (o["fromMs"] as? NSNumber)?.doubleValue,
                  let t = (o["toMs"] as? NSNumber)?.doubleValue,
                  t > f else { continue }
            spans.append((f, t))
        }
        DispatchQueue.global(qos: .userInitiated).async {
            let started = Date()
            VideoRemuxPlugin.export(inURL, to: outURL, keep: spans) { cutError, cutAudio in
                if let cutError = cutError, !spans.isEmpty {
                    // The cut failed: the whole file, rather than nothing.
                    VideoRemuxPlugin.export(inURL, to: outURL, keep: []) { wholeError, wholeAudio in
                        if let wholeError = wholeError {
                            call.reject("remux failed: \(wholeError.localizedDescription)")
                        } else {
                            call.resolve([
                                "uri": outURL.absoluteString,
                                "audio": wholeAudio,
                                "summary": "uncut (\(cutError.localizedDescription)), audio \(wholeAudio)"
                            ])
                        }
                    }
                    return
                }
                if let cutError = cutError {
                    call.reject("remux failed: \(cutError.localizedDescription)")
                    return
                }
                let ms = Int(Date().timeIntervalSince(started) * 1000)
                call.resolve([
                    "uri": outURL.absoluteString,
                    "audio": cutAudio,
                    "summary": (spans.isEmpty ? "whole" : "\(spans.count) spans kept") + ", audio \(cutAudio), \(ms)ms"
                ])
            }
        }
    }

    private static func fileURL(_ s: String) -> URL? {
        if s.hasPrefix("file:") { return URL(string: s) }
        return URL(fileURLWithPath: s)
    }

    private struct RemuxError: LocalizedError {
        let errorDescription: String?
        init(_ message: String) { errorDescription = message }
    }

    /// Exports `keep` (all of it, if empty) from `inURL` to `outURL`; calls
    /// back with nil once written, or the error.
    private static func export(
        _ inURL: URL,
        to outURL: URL,
        keep: [(Double, Double)],
        done: @escaping (Error?, Bool) -> Void
    ) {
        try? FileManager.default.removeItem(at: outURL)
        let asset = AVURLAsset(url: inURL)
        let tracks = asset.tracks.filter { $0.mediaType == .video || $0.mediaType == .audio }
        guard !tracks.isEmpty else {
            done(RemuxError("no audio or video tracks"), false)
            return
        }
        // The file's first frame: what the spans count from.
        let t0 = tracks.map { $0.timeRange.start }.min() ?? .zero
        let end = tracks.map { $0.timeRange.end }.max() ?? asset.duration
        var ranges: [CMTimeRange] = keep.map { span in
            let a = CMTimeAdd(t0, CMTime(seconds: span.0 / 1000, preferredTimescale: 600))
            let b = CMTimeMinimum(end, CMTimeAdd(t0, CMTime(seconds: span.1 / 1000, preferredTimescale: 600)))
            return CMTimeRange(start: a, end: b)
        }.filter { $0.duration > .zero }
        if !keep.isEmpty && ranges.isEmpty {
            done(RemuxError("nothing to keep"), false)
            return
        }
        if ranges.isEmpty { ranges = [CMTimeRange(start: t0, end: end)] }

        let composition = AVMutableComposition()
        do {
            for track in tracks {
                guard let into = composition.addMutableTrack(
                    withMediaType: track.mediaType,
                    preferredTrackID: kCMPersistentTrackID_Invalid
                ) else { continue }
                var cursor = CMTime.zero
                for range in ranges {
                    let part = range.intersection(track.timeRange)
                    if part.duration > .zero {
                        // Where in the span this track's part starts, so a
                        // track that starts late stays in step.
                        let at = CMTimeAdd(cursor, CMTimeSubtract(part.start, range.start))
                        try into.insertTimeRange(part, of: track, at: at)
                    }
                    cursor = CMTimeAdd(cursor, range.duration)
                }
                if track.mediaType == .video { into.preferredTransform = track.preferredTransform }
            }
        } catch {
            done(error, false)
            return
        }
        guard let session = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough) else {
            done(RemuxError("no export session"), false)
            return
        }
        guard session.supportedFileTypes.contains(.mp4) else {
            done(RemuxError("passthrough can't write mp4 for this file"), false)
            return
        }
        session.outputURL = outURL
        session.outputFileType = .mp4
        // The index up front, so Photos can scrub it straight away.
        session.shouldOptimizeForNetworkUse = true
        // Whether any sound made it in: the microphone's, kept with the picture.
        let audio = composition.tracks(withMediaType: .audio).contains { $0.timeRange.duration > .zero }
        session.exportAsynchronously {
            if session.status == .completed {
                done(nil, audio)
            } else {
                try? FileManager.default.removeItem(at: outURL)
                done(session.error ?? RemuxError("export ended \(session.status.rawValue)"), false)
            }
        }
    }
}

/// Watches the app's audio session while a session is filmed, for the reel's
/// trace: from Windows there's no other way to see an iPhone's.
///
/// WebKit records the microphone on an audio session of its own, and
/// starting it interrupts the app's (build 93's trace). The callouts' speech
/// used to play on the app's session and went silent with it; it now has a
/// session of its own (patches/@capacitor-community+text-to-speech+6.1.0.patch).
/// Setting the app's session to .playAndRecord here was tried (build 93) and
/// changed nothing, so this only reports: the category, options and route,
/// and every interruption and route change. release() activates the app's
/// session again as AppDelegate sets it, clearing an interruption that never
/// ended.
///
/// Registered by scripts/register-ios-app-plugins.mjs.
@objc(RecordingAudioPlugin)
public class RecordingAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RecordingAudioPlugin"
    public let jsName = "RecordingAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "allowRecording", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "release", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise)
    ]

    private var events: [String] = []
    private let started = Date()

    override public func load() {
        let center = NotificationCenter.default
        center.addObserver(self, selector: #selector(onInterruption(_:)),
                           name: AVAudioSession.interruptionNotification, object: nil)
        center.addObserver(self, selector: #selector(onRouteChange(_:)),
                           name: AVAudioSession.routeChangeNotification, object: nil)
    }

    @objc func allowRecording(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.note("filming (\(RecordingAudioPlugin.describe()))")
            call.resolve(["status": RecordingAudioPlugin.describe()])
        }
    }

    @objc func release(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            do {
                let session = AVAudioSession.sharedInstance()
                try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
                try session.setActive(true)
                self.note("released -> \(RecordingAudioPlugin.describe())")
            } catch {
                self.note("release failed: \(error.localizedDescription)")
            }
            call.resolve(["status": RecordingAudioPlugin.describe()])
        }
    }

    @objc func status(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let recent = self.events.suffix(30)
            self.events.removeAll()
            call.resolve([
                "status": RecordingAudioPlugin.describe(),
                "events": Array(recent)
            ])
        }
    }

    @objc private func onInterruption(_ n: Notification) {
        let raw = n.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt ?? 99
        let kind = AVAudioSession.InterruptionType(rawValue: raw) == .began ? "began" : "ended"
        DispatchQueue.main.async { self.note("interruption \(kind)") }
    }

    @objc private func onRouteChange(_ n: Notification) {
        let raw = n.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt ?? 99
        DispatchQueue.main.async {
            self.note("route change \(raw) -> \(RecordingAudioPlugin.describe())")
        }
    }

    private func note(_ line: String) {
        let s = Int(Date().timeIntervalSince(started))
        events.append("\(s)s \(line)")
        if events.count > 60 { events.removeFirst(events.count - 60) }
    }

    /// "PlayAndRecord/Default [speaker,mix,a2dp] out Speaker in MicrophoneBuiltIn"
    static func describe() -> String {
        let s = AVAudioSession.sharedInstance()
        var opts: [String] = []
        let o = s.categoryOptions
        if o.contains(.mixWithOthers) { opts.append("mix") }
        if o.contains(.duckOthers) { opts.append("duck") }
        if o.contains(.defaultToSpeaker) { opts.append("speaker") }
        if o.contains(.allowBluetoothA2DP) { opts.append("a2dp") }
        if o.contains(.allowBluetooth) { opts.append("hfp") }
        let outs = s.currentRoute.outputs.map { $0.portType.rawValue }.joined(separator: ",")
        let ins = s.currentRoute.inputs.map { $0.portType.rawValue }.joined(separator: ",")
        let cat = s.category.rawValue.replacingOccurrences(of: "AVAudioSessionCategory", with: "")
        let mode = s.mode.rawValue.replacingOccurrences(of: "AVAudioSessionMode", with: "")
        return "\(cat)/\(mode) [\(opts.joined(separator: ","))] out \(outs) in \(ins.isEmpty ? "none" : ins)"
    }
}
