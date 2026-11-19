import UIKit
import Capacitor
import AVFoundation
import Vision

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
        CAPPluginMethod(name: "remuxToMp4", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "laySound", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "probeFraming", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "exportReel", returnType: CAPPluginReturnPromise)
    ]

    /// `{ from, to, sound, parts }`: lays the session's sound (recorded by
    /// RecordingAudioPlugin) under a finished reel, whose clips were filmed
    /// silent. `parts`, in order, are the reel's stretches: `durMs` long,
    /// and for a clip, `soundFromMs`, where in the sound file it was filmed
    /// (none for a card: silence). The picture is copied as it is. Resolves
    /// `{ uri, summary }`; rejects with the error's domain and code.
    @objc func laySound(_ call: CAPPluginCall) {
        guard let from = call.getString("from"), let to = call.getString("to"),
              let soundPath = call.getString("sound"),
              let inURL = VideoRemuxPlugin.fileURL(from),
              let outURL = VideoRemuxPlugin.fileURL(to),
              let soundURL = VideoRemuxPlugin.fileURL(soundPath) else {
            call.reject("from, to and sound are required")
            return
        }
        var parts: [(Double, Double?)] = []
        for item in call.getArray("parts") ?? [] {
            guard let o = item as? JSObject,
                  let d = (o["durMs"] as? NSNumber)?.doubleValue, d > 0 else { continue }
            parts.append((d, (o["soundFromMs"] as? NSNumber)?.doubleValue))
        }
        DispatchQueue.global(qos: .userInitiated).async {
            let started = Date()
            try? FileManager.default.removeItem(at: outURL)
            let asset = AVURLAsset(url: inURL)
            let soundAsset = AVURLAsset(url: soundURL)
            guard let video = asset.tracks(withMediaType: .video).first else {
                call.reject("lay sound: the reel has no picture")
                return
            }
            guard let soundTrack = soundAsset.tracks(withMediaType: .audio).first else {
                call.reject("lay sound: the sound file has no sound")
                return
            }
            let ms = { (v: Double) in CMTime(seconds: v / 1000, preferredTimescale: 600) }
            let composition = AVMutableComposition()
            var laid = 0
            do {
                guard let pic = composition.addMutableTrack(withMediaType: .video,
                                                            preferredTrackID: kCMPersistentTrackID_Invalid),
                      let snd = composition.addMutableTrack(withMediaType: .audio,
                                                            preferredTrackID: kCMPersistentTrackID_Invalid) else {
                    call.reject("lay sound: no composition tracks")
                    return
                }
                try pic.insertTimeRange(video.timeRange, of: video, at: .zero)
                pic.preferredTransform = video.preferredTransform
                let length = video.timeRange.duration
                var cursor = CMTime.zero
                for (dur, soundFrom) in parts {
                    if let soundFrom = soundFrom, cursor < length {
                        // Not past the picture's end.
                        let take = CMTimeMinimum(ms(dur), CMTimeSubtract(length, cursor))
                        let want = CMTimeRange(start: ms(soundFrom), duration: take)
                        let part = want.intersection(soundTrack.timeRange)
                        if part.duration > .zero {
                            let at = CMTimeAdd(cursor, CMTimeSubtract(part.start, want.start))
                            try snd.insertTimeRange(part, of: soundTrack, at: at)
                            laid += 1
                        }
                    }
                    cursor = CMTimeAdd(cursor, ms(dur))
                }
            } catch {
                call.reject("lay sound: \(VideoRemuxPlugin.describe(error))")
                return
            }
            guard laid > 0 else {
                call.reject("lay sound: no part of the reel falls within the sound")
                return
            }
            guard let session = AVAssetExportSession(asset: composition,
                                                     presetName: AVAssetExportPresetPassthrough) else {
                call.reject("lay sound: no export session")
                return
            }
            session.outputURL = outURL
            session.outputFileType = .mp4
            session.shouldOptimizeForNetworkUse = true
            session.exportAsynchronously {
                withExtendedLifetime((asset, soundAsset)) {}
                if session.status == .completed {
                    let took = Int(Date().timeIntervalSince(started) * 1000)
                    call.resolve([
                        "uri": outURL.absoluteString,
                        "summary": "\(laid) of \(parts.count) parts, \(took)ms"
                    ])
                } else {
                    try? FileManager.default.removeItem(at: outURL)
                    let e = session.error.map { VideoRemuxPlugin.describe($0) } ?? "ended \(session.status.rawValue)"
                    call.reject("lay sound: \(e)")
                }
            }
        }
    }

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
        // The sound recorded natively (RecordingAudioPlugin), and how many ms
        // after the video's first frame it started.
        var sound: (URL, Double)?
        if let a = call.getObject("audio"), let u = a["uri"] as? String,
           let url = VideoRemuxPlugin.fileURL(u),
           let off = (a["offsetMs"] as? NSNumber)?.doubleValue {
            sound = (url, off)
        }
        // Tried in turn until one writes: the cut with the native sound, the
        // cut alone, then the whole file alone. Every failure goes in the
        // summary, with the error's domain and code: "The operation could not
        // be completed" alone said nothing (build 95).
        var steps: [(String, [(Double, Double)], (URL, Double)?)] = []
        if !spans.isEmpty && sound != nil { steps.append(("cut+sound", spans, sound)) }
        if !spans.isEmpty { steps.append(("cut", spans, nil)) }
        if spans.isEmpty && sound != nil { steps.append(("whole+sound", [], sound)) }
        steps.append(("whole", [], nil))
        DispatchQueue.global(qos: .userInitiated).async {
            let started = Date()
            var failures: [String] = []
            func attempt(_ i: Int) {
                guard i < steps.count else {
                    call.reject("remux failed: " + failures.joined(separator: "; "))
                    return
                }
                let (name, keep, withSound) = steps[i]
                VideoRemuxPlugin.export(inURL, to: outURL, keep: keep, sound: withSound) { error, audio in
                    if let error = error {
                        failures.append("\(name): \(VideoRemuxPlugin.describe(error))")
                        attempt(i + 1)
                        return
                    }
                    let ms = Int(Date().timeIntervalSince(started) * 1000)
                    let tried = failures.isEmpty ? "" : " after " + failures.joined(separator: "; ")
                    call.resolve([
                        "uri": outURL.absoluteString,
                        "audio": audio,
                        "summary": (keep.isEmpty ? "whole" : "\(keep.count) spans kept")
                            + " (\(name)), audio \(audio), \(ms)ms" + tried
                    ])
                }
            }
            attempt(0)
        }
    }

    /// `{ file, timesMs }`: whether the whole fighter is in shot at each time.
    ///
    /// For every time (ms from the file's first frame, kept inside the
    /// picture) the exact frame is decoded (zero tolerance, turned upright by
    /// the track's transform) and Vision's body-pose detector run on it. Of
    /// the people found, the one with the most core joints showing counts.
    /// `visible` is the share of the 13 core joints (nose, shoulders, elbows,
    /// wrists, hips, knees, ankles) seen with confidence >= 0.5 and inside the
    /// frame (within 1% of an edge counts as outside); `box` bounds the
    /// confident joints, as fractions of the frame from its top-left. No
    /// person: `person: false, visible: 0`, no box; a frame that couldn't be
    /// decoded comes back the same, with `error`. Resolves
    /// `{ frames: [{ tMs, person, visible, box? }], summary }`, in the order asked.
    @objc func probeFraming(_ call: CAPPluginCall) {
        guard let file = call.getString("file"), let url = VideoRemuxPlugin.fileURL(file) else {
            call.reject("file is required")
            return
        }
        let asked: [Double] = (call.getArray("timesMs") ?? []).compactMap { ($0 as? NSNumber)?.doubleValue }
        guard !asked.isEmpty else {
            call.resolve(["frames": [] as [Any], "summary": "no times asked"])
            return
        }
        DispatchQueue.global(qos: .userInitiated).async {
            let started = Date()
            let asset = AVURLAsset(url: url)
            guard let video = asset.tracks(withMediaType: .video).first else {
                call.reject("probe framing: the file has no picture")
                return
            }
            let range = video.timeRange
            let fps = video.nominalFrameRate > 0 ? Double(video.nominalFrameRate) : 30
            let lastFrame = CMTimeMaximum(range.start,
                                          CMTimeSubtract(range.end, CMTime(seconds: 1 / fps, preferredTimescale: 600)))
            // ms → asset time, kept inside the picture.
            let at = { (ms: Double) -> CMTime in
                let t = CMTimeAdd(range.start, CMTime(seconds: max(0, ms) / 1000, preferredTimescale: 600))
                return CMTimeMinimum(t, lastFrame)
            }
            // Each distinct time decoded once, in file order, so the decoder
            // can run forward instead of seeking back for every frame.
            var times: [CMTime] = []
            for ms in asked {
                let t = at(ms)
                if !times.contains(where: { $0 == t }) { times.append(t) }
            }
            times.sort { $0 < $1 }

            var generator: AVAssetImageGenerator? = AVAssetImageGenerator(asset: asset)
            generator?.appliesPreferredTrackTransform = true
            generator?.requestedTimeToleranceBefore = .zero
            generator?.requestedTimeToleranceAfter = .zero
            let lock = NSLock()
            var found: [Int: [String: Any]] = [:]
            var remaining = times.count
            generator?.generateCGImagesAsynchronously(forTimes: times.map { NSValue(time: $0) }) {
                requested, image, _, result, error in
                let frame: [String: Any]
                if let image = image, result == .succeeded {
                    frame = VideoRemuxPlugin.framing(of: image)
                } else {
                    let why = error.map { VideoRemuxPlugin.describe($0) }
                        ?? (result == .cancelled ? "cancelled" : "no frame")
                    frame = ["person": false, "visible": 0, "error": why]
                }
                lock.lock()
                if let i = times.firstIndex(where: { $0 == requested }) { found[i] = frame }
                remaining -= 1
                let done = remaining == 0
                lock.unlock()
                guard done else { return }
                // Held until every frame is back: a generator let go of
                // cancels what it hasn't handed over yet. Let go of after this
                // callback returns, not from inside it.
                DispatchQueue.global(qos: .utility).async {
                    generator = nil
                    withExtendedLifetime(asset) {}
                }
                var people = 0
                let frames: [[String: Any]] = asked.map { ms in
                    let t = at(ms)
                    var f = times.firstIndex(where: { $0 == t }).flatMap { found[$0] }
                        ?? ["person": false, "visible": 0, "error": "no frame returned"]
                    f["tMs"] = ms
                    if f["person"] as? Bool == true { people += 1 }
                    return f
                }
                let took = Int(Date().timeIntervalSince(started) * 1000)
                call.resolve([
                    "frames": frames,
                    "summary": "\(frames.count) frames (\(times.count) decoded), \(people) with a person, \(took)ms"
                ])
            }
        }
    }

    /// The body joints whose showing decides whether a frame is usable.
    private static let coreJoints: [VNHumanBodyPoseObservation.JointName] = [
        .nose, .leftShoulder, .rightShoulder, .leftElbow, .rightElbow,
        .leftWrist, .rightWrist, .leftHip, .rightHip,
        .leftKnee, .rightKnee, .leftAnkle, .rightAnkle
    ]

    /// probeFraming's verdict on one upright frame.
    private static func framing(of image: CGImage) -> [String: Any] {
        // One request per frame: the generator may call back on more than
        // one thread, and a request isn't safe to share between them.
        let request = VNDetectHumanBodyPoseRequest()
        let handler = VNImageRequestHandler(cgImage: image, orientation: .up, options: [:])
        do {
            try handler.perform([request])
        } catch {
            return ["person": false, "visible": 0, "error": describe(error)]
        }
        // Vision's points are fractions of the image from its bottom-left.
        var best: (shown: Int, points: [CGPoint])?
        for body in request.results ?? [] {
            guard let joints = try? body.recognizedPoints(.all) else { continue }
            var shown = 0
            var points: [CGPoint] = []
            for name in coreJoints {
                guard let p = joints[name], p.confidence >= 0.5 else { continue }
                points.append(p.location)
                let inside = p.location.x > 0.01 && p.location.x < 0.99
                    && p.location.y > 0.01 && p.location.y < 0.99
                if inside { shown += 1 }
            }
            guard !points.isEmpty else { continue }
            if let b = best, shown < b.shown || (shown == b.shown && points.count <= b.points.count) { continue }
            best = (shown, points)
        }
        guard let b = best else { return ["person": false, "visible": 0] }
        let xs = b.points.map { Double(min(1, max(0, $0.x))) }
        let ys = b.points.map { Double(min(1, max(0, 1 - $0.y))) }   // flipped: from the top
        let x0 = xs.min() ?? 0, x1 = xs.max() ?? 0
        let y0 = ys.min() ?? 0, y1 = ys.max() ?? 0
        return [
            "person": true,
            "visible": Double(b.shown) / Double(coreJoints.count),
            "box": ["x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0]
        ]
    }

    /// `{ file, clips, out, width?, height?, fps?, videoBps?, targetLufs? }`:
    /// the highlight reel, cut from the full session once it's over.
    ///
    /// `clips` (`[{ fromMs, toMs }]`, ms from the file's first frame, clamped
    /// to the picture) are cut frame-accurately and joined back to back in the
    /// order given. The picture is re-encoded, H.264 High at `videoBps`
    /// (default 10 Mbps) and `fps` (30), at width×height (1080×1920), turned
    /// upright by the source's transform and scaled to fill (centre-cropped).
    /// The sound fades in and out over 20 ms at every cut, and gets one gain
    /// toward `targetLufs` (-14): the chosen stretches are read first and
    /// their RMS in dBFS stands in for LUFS; the gain is held down so the
    /// loudest sample stays at or below -1 dBFS. AAC, 48 kHz stereo, 192 kbps.
    /// A file with no sound makes a silent reel. The index goes up front; a
    /// half-written `out` is removed on failure. Resolves
    /// `{ uri, summary, durationMs }`; the summary gives the clips, length,
    /// gain and bitrate.
    @objc func exportReel(_ call: CAPPluginCall) {
        guard let file = call.getString("file"), let to = call.getString("out"),
              let inURL = VideoRemuxPlugin.fileURL(file),
              let outURL = VideoRemuxPlugin.fileURL(to) else {
            call.reject("file and out are required")
            return
        }
        var spans: [(Double, Double)] = []
        for item in call.getArray("clips") ?? [] {
            guard let o = item as? JSObject,
                  let f = (o["fromMs"] as? NSNumber)?.doubleValue,
                  let t = (o["toMs"] as? NSNumber)?.doubleValue,
                  t > f else { continue }
            spans.append((f, t))
        }
        guard !spans.isEmpty else {
            call.reject("export reel: no clips")
            return
        }
        let width = max(2, call.getInt("width") ?? 1080)
        let height = max(2, call.getInt("height") ?? 1920)
        let fps = max(1, call.getInt("fps") ?? 30)
        let videoBps = call.getDouble("videoBps") ?? 10_000_000
        let targetLufs = call.getDouble("targetLufs") ?? -14
        DispatchQueue.global(qos: .userInitiated).async {
            let started = Date()
            try? FileManager.default.removeItem(at: outURL)
            let fail = { (why: String) in
                try? FileManager.default.removeItem(at: outURL)
                call.reject("export reel: " + why)
            }
            let asset = AVURLAsset(url: inURL)
            guard let video = asset.tracks(withMediaType: .video).first else {
                fail("the file has no picture")
                return
            }
            let sound = asset.tracks(withMediaType: .audio).first
            // The file's first frame: what the clips count from (as remuxToMp4).
            let t0 = ([video] + (sound.map { [$0] } ?? [])).map { $0.timeRange.start }.min() ?? .zero
            let ms = { (v: Double) in CMTime(seconds: v / 1000, preferredTimescale: 600) }
            let ranges: [CMTimeRange] = spans.map { span in
                CMTimeRange(start: CMTimeAdd(t0, ms(span.0)), end: CMTimeAdd(t0, ms(span.1)))
                    .intersection(video.timeRange)
            }.filter { $0.duration > .zero }
            guard !ranges.isEmpty else {
                fail("no clip falls within the picture")
                return
            }

            // The cut: every clip's picture and sound, back to back.
            let composition = AVMutableComposition()
            guard let pic = composition.addMutableTrack(withMediaType: .video,
                                                        preferredTrackID: kCMPersistentTrackID_Invalid) else {
                fail("no composition track")
                return
            }
            var snd: AVMutableCompositionTrack? = sound == nil ? nil
                : composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
            var cuts: [CMTimeRange] = []   // each clip's place in the reel
            var cursor = CMTime.zero
            var soundLaid = false
            do {
                for range in ranges {
                    try pic.insertTimeRange(range, of: video, at: cursor)
                    if let snd = snd, let sound = sound {
                        let part = range.intersection(sound.timeRange)
                        if part.duration > .zero {
                            try snd.insertTimeRange(part, of: sound,
                                                    at: CMTimeAdd(cursor, CMTimeSubtract(part.start, range.start)))
                            soundLaid = true
                        }
                    }
                    cuts.append(CMTimeRange(start: cursor, duration: range.duration))
                    cursor = CMTimeAdd(cursor, range.duration)
                }
            } catch {
                fail(VideoRemuxPlugin.describe(error))
                return
            }
            if let s = snd, !soundLaid {
                composition.removeTrack(s)
                snd = nil
            }

            // The picture: upright, scaled to fill the render size, centred.
            let render = CGSize(width: width, height: height)
            let upright = CGRect(origin: .zero, size: video.naturalSize).applying(video.preferredTransform)
            guard upright.width > 0, upright.height > 0 else {
                fail("the picture has no size")
                return
            }
            let scale = max(render.width / upright.width, render.height / upright.height)
            let fill = video.preferredTransform
                .concatenating(CGAffineTransform(translationX: -upright.minX, y: -upright.minY))
                .concatenating(CGAffineTransform(scaleX: scale, y: scale))
                .concatenating(CGAffineTransform(translationX: (render.width - upright.width * scale) / 2,
                                                 y: (render.height - upright.height * scale) / 2))
            let layer = AVMutableVideoCompositionLayerInstruction(assetTrack: pic)
            layer.setTransform(fill, at: .zero)
            let instruction = AVMutableVideoCompositionInstruction()
            instruction.timeRange = CMTimeRange(start: .zero, duration: cursor)
            instruction.layerInstructions = [layer]
            let videoComposition = AVMutableVideoComposition()
            videoComposition.renderSize = render
            videoComposition.frameDuration = CMTime(value: 1, timescale: CMTimeScale(fps))
            videoComposition.instructions = [instruction]

            // The sound: float PCM, 48 kHz stereo, both to measure and to encode.
            let pcm: [String: Any] = [
                AVFormatIDKey: kAudioFormatLinearPCM,
                AVSampleRateKey: 48_000,
                AVNumberOfChannelsKey: 2,
                AVLinearPCMBitDepthKey: 32,
                AVLinearPCMIsFloatKey: true,
                AVLinearPCMIsBigEndianKey: false,
                AVLinearPCMIsNonInterleaved: false
            ]
            var gainDb = 0.0
            var loudness = "no sound"
            if let snd = snd {
                if let m = VideoRemuxPlugin.measure(composition, track: snd, settings: pcm) {
                    let rmsDb = 20 * log10(max(m.rms, 1e-9))
                    let peakDb = 20 * log10(max(m.peak, 1e-9))
                    // Near-silence isn't lifted: there's nothing to bring up.
                    if rmsDb > -70 { gainDb = min(targetLufs - rmsDb, -1 - peakDb) }
                    loudness = String(format: "gain %+.1f dB (rms %.1f, peak %.1f dBFS)", gainDb, rmsDb, peakDb)
                } else {
                    loudness = "gain 0 dB (couldn't measure)"
                }
            }
            let gain = Float(pow(10, gainDb / 20))

            let reader: AVAssetReader
            let writer: AVAssetWriter
            do {
                reader = try AVAssetReader(asset: composition)
                writer = try AVAssetWriter(outputURL: outURL, fileType: .mp4)
            } catch {
                fail(VideoRemuxPlugin.describe(error))
                return
            }
            let picOut = AVAssetReaderVideoCompositionOutput(videoTracks: [pic], videoSettings: [
                kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange
            ])
            picOut.videoComposition = videoComposition
            picOut.alwaysCopiesSampleData = false
            let picIn = AVAssetWriterInput(mediaType: .video, outputSettings: [
                AVVideoCodecKey: AVVideoCodecType.h264,
                AVVideoWidthKey: width,
                AVVideoHeightKey: height,
                AVVideoCompressionPropertiesKey: [
                    AVVideoAverageBitRateKey: videoBps,
                    AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
                    AVVideoExpectedSourceFrameRateKey: fps,
                    AVVideoMaxKeyFrameIntervalKey: fps
                ] as [String: Any]
            ])
            picIn.expectsMediaDataInRealTime = false
            guard reader.canAdd(picOut), writer.canAdd(picIn) else {
                fail("can't read or write the picture")
                return
            }
            reader.add(picOut)
            writer.add(picIn)

            var sndOut: AVAssetReaderAudioMixOutput?
            var sndIn: AVAssetWriterInput?
            if let snd = snd {
                // A 20 ms fade at both ends of every clip (half the clip, if
                // it's shorter than 40 ms); the gain itself goes on the samples.
                let ramps = AVMutableAudioMixInputParameters(track: snd)
                let fade = CMTime(value: 20, timescale: 1000)
                for cut in cuts {
                    let f = CMTimeMinimum(fade, CMTimeMultiplyByRatio(cut.duration, multiplier: 1, divisor: 2))
                    ramps.setVolumeRamp(fromStartVolume: 0, toEndVolume: 1,
                                        timeRange: CMTimeRange(start: cut.start, duration: f))
                    ramps.setVolumeRamp(fromStartVolume: 1, toEndVolume: 0,
                                        timeRange: CMTimeRange(start: CMTimeSubtract(cut.end, f), duration: f))
                }
                let mix = AVMutableAudioMix()
                mix.inputParameters = [ramps]
                let o = AVAssetReaderAudioMixOutput(audioTracks: [snd], audioSettings: pcm)
                o.audioMix = mix
                o.alwaysCopiesSampleData = false
                let i = AVAssetWriterInput(mediaType: .audio, outputSettings: [
                    AVFormatIDKey: kAudioFormatMPEG4AAC,
                    AVSampleRateKey: 48_000,
                    AVNumberOfChannelsKey: 2,
                    AVEncoderBitRateKey: 192_000
                ])
                i.expectsMediaDataInRealTime = false
                if reader.canAdd(o), writer.canAdd(i) {
                    reader.add(o)
                    writer.add(i)
                    sndOut = o
                    sndIn = i
                } else {
                    loudness = "sound dropped (can't read or write it)"
                }
            }

            // The index up front, so the reel plays and scrubs straight away.
            writer.shouldOptimizeForNetworkUse = true
            guard writer.startWriting() else {
                fail("writer: " + (writer.error.map { VideoRemuxPlugin.describe($0) } ?? "didn't start"))
                return
            }
            guard reader.startReading() else {
                writer.cancelWriting()
                fail("reader: " + (reader.error.map { VideoRemuxPlugin.describe($0) } ?? "didn't start"))
                return
            }
            writer.startSession(atSourceTime: .zero)

            // Picture and sound are pulled side by side: a reader with two
            // outputs stalls if one of them isn't read.
            let group = DispatchGroup()
            func pump(_ input: AVAssetWriterInput, from output: AVAssetReaderOutput, _ label: String,
                      change: ((CMSampleBuffer) -> CMSampleBuffer?)? = nil) {
                group.enter()
                var finished = false
                input.requestMediaDataWhenReady(on: DispatchQueue(label: "reel.export." + label)) {
                    while !finished && input.isReadyForMoreMediaData {
                        if reader.status == .reading, let sample = output.copyNextSampleBuffer() {
                            if input.append(change?(sample) ?? sample) { continue }
                            reader.cancelReading()   // the writer failed; frees the other output
                        }
                        finished = true
                        input.markAsFinished()
                        group.leave()
                    }
                }
            }
            pump(picIn, from: picOut, "picture")
            if let sndIn = sndIn, let sndOut = sndOut {
                pump(sndIn, from: sndOut, "sound",
                     change: gain == 1 ? nil : { VideoRemuxPlugin.amplified($0, by: gain) })
            }

            group.notify(queue: DispatchQueue.global(qos: .userInitiated)) {
                withExtendedLifetime((asset, composition)) {}
                if reader.status != .completed || writer.status == .failed {
                    let e = writer.error ?? reader.error
                    writer.cancelWriting()
                    fail(e.map { VideoRemuxPlugin.describe($0) } ?? "stopped (reader \(reader.status.rawValue))")
                    return
                }
                writer.finishWriting {
                    guard writer.status == .completed else {
                        fail("finish: " + (writer.error.map { VideoRemuxPlugin.describe($0) }
                                           ?? "ended \(writer.status.rawValue)"))
                        return
                    }
                    let seconds = CMTimeGetSeconds(cursor)
                    let took = Int(Date().timeIntervalSince(started) * 1000)
                    let dropped = spans.count - ranges.count
                    call.resolve([
                        "uri": outURL.absoluteString,
                        "durationMs": Int((seconds * 1000).rounded()),
                        "summary": "\(ranges.count) clips" + (dropped > 0 ? " (\(dropped) outside the file)" : "")
                            + String(format: ", %.1fs, ", seconds) + loudness
                            + String(format: ", %.1f Mbps", videoBps / 1_000_000)
                            + ", \(width)x\(height)@\(fps), \(took)ms"
                    ])
                }
            }
        }
    }

    /// The RMS and peak (linear, 1 = full scale) of a track's float PCM.
    private static func measure(_ asset: AVAsset, track: AVAssetTrack,
                                settings: [String: Any]) -> (rms: Double, peak: Double)? {
        guard let reader = try? AVAssetReader(asset: asset) else { return nil }
        let output = AVAssetReaderAudioMixOutput(audioTracks: [track], audioSettings: settings)
        output.alwaysCopiesSampleData = false
        guard reader.canAdd(output) else { return nil }
        reader.add(output)
        guard reader.startReading() else { return nil }
        var sum = 0.0
        var count = 0
        var peak: Float = 0
        var samples: [Float] = []
        while let sample = output.copyNextSampleBuffer() {
            guard let block = CMSampleBufferGetDataBuffer(sample) else { continue }
            let n = CMBlockBufferGetDataLength(block) / MemoryLayout<Float>.size
            guard n > 0 else { continue }
            if samples.count < n { samples = [Float](repeating: 0, count: n) }
            let status = samples.withUnsafeMutableBytes {
                CMBlockBufferCopyDataBytes(block, atOffset: 0, dataLength: n * MemoryLayout<Float>.size,
                                           destination: $0.baseAddress!)
            }
            guard status == noErr else { continue }
            for k in 0..<n {
                let v = samples[k]
                sum += Double(v * v)
                peak = max(peak, abs(v))
            }
            count += n
        }
        guard reader.status == .completed, count > 0 else { return nil }
        return ((sum / Double(count)).squareRoot(), Double(peak))
    }

    /// A copy of a float PCM sample buffer with every sample times `gain`,
    /// clipped to full scale; nil if it can't be made (the caller then uses
    /// the original).
    private static func amplified(_ sample: CMSampleBuffer, by gain: Float) -> CMSampleBuffer? {
        guard let source = CMSampleBufferGetDataBuffer(sample),
              let format = CMSampleBufferGetFormatDescription(sample) else { return nil }
        let length = CMBlockBufferGetDataLength(source)
        let n = length / MemoryLayout<Float>.size
        guard n > 0 else { return nil }
        var samples = [Float](repeating: 0, count: n)
        let read = samples.withUnsafeMutableBytes {
            CMBlockBufferCopyDataBytes(source, atOffset: 0, dataLength: n * MemoryLayout<Float>.size,
                                       destination: $0.baseAddress!)
        }
        guard read == noErr else { return nil }
        for k in 0..<n { samples[k] = min(1, max(-1, samples[k] * gain)) }
        var block: CMBlockBuffer?
        guard CMBlockBufferCreateWithMemoryBlock(
            allocator: kCFAllocatorDefault, memoryBlock: nil, blockLength: length,
            blockAllocator: kCFAllocatorDefault, customBlockSource: nil, offsetToData: 0,
            dataLength: length, flags: kCMBlockBufferAssureMemoryNowFlag, blockBufferOut: &block
        ) == noErr, let block = block else { return nil }
        let wrote = samples.withUnsafeBytes {
            CMBlockBufferReplaceDataBytes(with: $0.baseAddress!, blockBuffer: block,
                                          offsetIntoDestination: 0, dataLength: n * MemoryLayout<Float>.size)
        }
        guard wrote == noErr else { return nil }
        var out: CMSampleBuffer?
        guard CMAudioSampleBufferCreateReadyWithPacketDescriptions(
            allocator: kCFAllocatorDefault, dataBuffer: block, formatDescription: format,
            sampleCount: CMSampleBufferGetNumSamples(sample),
            presentationTimeStamp: CMSampleBufferGetPresentationTimeStamp(sample),
            packetDescriptions: nil, sampleBufferOut: &out
        ) == noErr else { return nil }
        return out
    }

    /// An error as domain, code and message, with what lay under it.
    private static func describe(_ error: Error) -> String {
        let e = error as NSError
        var text = "\(e.domain) \(e.code) \(e.localizedDescription)"
        if let reason = e.localizedFailureReason { text += " (\(reason))" }
        if let under = e.userInfo[NSUnderlyingErrorKey] as? NSError {
            text += " <- \(under.domain) \(under.code)"
        }
        return text
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
        sound: (URL, Double)? = nil,
        done: @escaping (Error?, Bool) -> Void
    ) {
        try? FileManager.default.removeItem(at: outURL)
        let asset = AVURLAsset(url: inURL)
        // With the sound recorded natively, the video's own (silent, if any)
        // sound track is left out.
        let tracks = asset.tracks.filter {
            $0.mediaType == .video || ($0.mediaType == .audio && sound == nil)
        }
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
        // The sound's file, held (with `asset`) until the export is done: a
        // composition's source let go of mid-export can fail it.
        let soundAsset = sound.map { AVURLAsset(url: $0.0) }
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
            if let sound = sound,
               let soundTrack = soundAsset?.tracks(withMediaType: .audio).first,
               let into = composition.addMutableTrack(withMediaType: .audio,
                                                      preferredTrackID: kCMPersistentTrackID_Invalid) {
                // Video time v is sound time v - offset (the sound started
                // offset ms after the first frame), less where the video starts.
                let shift = CMTimeAdd(t0, CMTime(seconds: sound.1 / 1000, preferredTimescale: 600))
                var cursor = CMTime.zero
                for range in ranges {
                    let inSound = CMTimeRange(start: CMTimeSubtract(range.start, shift),
                                              end: CMTimeSubtract(range.end, shift))
                    let part = inSound.intersection(soundTrack.timeRange)
                    if part.duration > .zero {
                        let at = CMTimeAdd(cursor, CMTimeSubtract(part.start, inSound.start))
                        try into.insertTimeRange(part, of: soundTrack, at: at)
                    }
                    cursor = CMTimeAdd(cursor, range.duration)
                }
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
            withExtendedLifetime((asset, soundAsset)) {}
            if session.status == .completed {
                done(nil, audio)
            } else {
                try? FileManager.default.removeItem(at: outURL)
                done(session.error ?? RemuxError("export ended \(session.status.rawValue)"), false)
            }
        }
    }
}

/// The full session's sound on iOS, recorded here rather than by the web view.
///
/// WebKit can't record the microphone without stopping the user's music: it
/// records on an audio session of its own that doesn't mix (WebKit bug
/// 264473, closed as intended), and while it records, iOS sidelines spoken
/// audio, so the callouts went silent too (TestFlight builds 91-94). Recorded
/// here, on the app's session set to .playAndRecord with .mixWithOthers, the
/// music plays on, the callouts (AVSpeechSynthesizer, on this same session)
/// play out of the loudspeaker (.defaultToSpeaker), and
/// a Bluetooth speaker stays a speaker (.allowBluetoothA2DP; not
/// .allowBluetooth, which would put it into call mode). The web view films
/// the picture; VideoRemuxPlugin lays this file under it when the rests are
/// cut, offset by when each started.
///
/// Also reports the session, its interruptions and route changes, for the
/// reel's trace: from Windows there's no other way to see an iPhone's.
///
/// Registered by scripts/register-ios-app-plugins.mjs.
@objc(RecordingAudioPlugin)
public class RecordingAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RecordingAudioPlugin"
    public let jsName = "RecordingAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestMicrophone", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startRecording", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopRecording", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise)
    ]

    private static var events: [String] = []
    private static let started = Date()
    private var recorder: AVAudioRecorder?

    /// Adds a line to the trace the web layer reads (status()), from any
    /// plugin.
    static func trace(_ line: String) {
        let s = Int(Date().timeIntervalSince(started))
        events.append("\(s)s \(line)")
        if events.count > 60 { events.removeFirst(events.count - 60) }
    }

    /// Switches the session off and on again into `category`, not just over.
    /// From the second filmed session after a launch the app's own output
    /// stalled (the bell queued and only came out once the app was left and
    /// opened again, TestFlight builds 107-109); a full deactivation is the
    /// nearest thing the app can do to what leaving it does.
    static func reactivate(_ category: AVAudioSession.Category,
                           options: AVAudioSession.CategoryOptions) throws {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setActive(false, options: .notifyOthersOnDeactivation)
        } catch {
            trace("deactivate failed: \(error.localizedDescription)")
        }
        try session.setCategory(category, mode: .default, options: options)
        try session.setActive(true)
    }
    private var recordingURL: URL?

    override public func load() {
        let center = NotificationCenter.default
        center.addObserver(self, selector: #selector(onInterruption(_:)),
                           name: AVAudioSession.interruptionNotification, object: nil)
        center.addObserver(self, selector: #selector(onRouteChange(_:)),
                           name: AVAudioSession.routeChangeNotification, object: nil)
    }

    /// Asks for the microphone if it hasn't been yet. Resolves `{ granted }`.
    @objc func requestMicrophone(_ call: CAPPluginCall) {
        let session = AVAudioSession.sharedInstance()
        switch session.recordPermission {
        case .granted: call.resolve(["granted": true])
        case .denied: call.resolve(["granted": false])
        default:
            session.requestRecordPermission { granted in
                call.resolve(["granted": granted])
            }
        }
    }

    /// Starts recording. Resolves `{ startedAtMs }` (epoch ms, when the
    /// recorder started) or rejects: no microphone, or it wouldn't start.
    @objc func startRecording(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let session = AVAudioSession.sharedInstance()
            guard session.recordPermission == .granted else {
                call.reject("microphone not granted")
                return
            }
            self.recorder?.stop()
            do {
                try RecordingAudioPlugin.reactivate(.playAndRecord,
                    options: [.mixWithOthers, .defaultToSpeaker, .allowBluetoothA2DP])
                let url = FileManager.default.temporaryDirectory
                    .appendingPathComponent("full-audio-\(UUID().uuidString).m4a")
                let recorder = try AVAudioRecorder(url: url, settings: [
                    AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
                    AVSampleRateKey: 44_100,
                    AVNumberOfChannelsKey: 1,
                    AVEncoderBitRateKey: 128_000
                ])
                recorder.prepareToRecord()
                guard recorder.record() else {
                    try? FileManager.default.removeItem(at: url)
                    self.note("recorder would not start")
                    call.reject("recorder would not start")
                    return
                }
                let at = Date().timeIntervalSince1970 * 1000
                self.recorder = recorder
                self.recordingURL = url
                self.note("recording (\(RecordingAudioPlugin.describe()))")
                call.resolve(["startedAtMs": at, "status": RecordingAudioPlugin.describe()])
            } catch {
                self.note("recording failed: \(error.localizedDescription)")
                call.reject("recording failed: \(error.localizedDescription)")
            }
        }
    }

    /// Stops recording, puts the session back as AppDelegate has it, and
    /// resolves `{ uri, durationMs }` (no uri if nothing was recording).
    @objc func stopRecording(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let duration = self.recorder?.currentTime ?? 0
            self.recorder?.stop()
            self.recorder = nil
            let url = self.recordingURL
            self.recordingURL = nil
            do {
                try RecordingAudioPlugin.reactivate(.playback, options: [.mixWithOthers])
            } catch {
                self.note("session not put back: \(error.localizedDescription)")
            }
            self.note("stopped after \(Int(duration))s -> \(RecordingAudioPlugin.describe())")
            var result: [String: Any] = ["durationMs": duration * 1000]
            if let url = url { result["uri"] = url.absoluteString }
            call.resolve(result)
        }
    }

    @objc func status(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let recent = RecordingAudioPlugin.events.suffix(30)
            RecordingAudioPlugin.events.removeAll()
            call.resolve([
                "status": RecordingAudioPlugin.describe(),
                "events": Array(recent)
            ])
        }
    }

    @objc private func onInterruption(_ n: Notification) {
        let raw = n.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt ?? 99
        let kind = AVAudioSession.InterruptionType(rawValue: raw) == .began ? "began" : "ended"
        DispatchQueue.main.async {
            self.note("interruption \(kind)")
            // A call or Siri pauses the recorder; carry on once it's over.
            // (The time it was out is missing from the file, so the sound
            // after it runs early by that much: rare enough to leave.)
            if kind == "ended", let recorder = self.recorder, !recorder.isRecording {
                try? AVAudioSession.sharedInstance().setActive(true)
                self.note(recorder.record() ? "recording again" : "could not record again")
            }
        }
    }

    @objc private func onRouteChange(_ n: Notification) {
        let raw = n.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt ?? 99
        DispatchQueue.main.async {
            self.note("route change \(raw) -> \(RecordingAudioPlugin.describe())")
        }
    }

    private func note(_ line: String) {
        RecordingAudioPlugin.trace(line)
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

/// Registered by scripts/register-ios-app-plugins.mjs (see VideoRemuxPlugin).
///
/// Plays the bell, the 10-second warning and the clack natively, on the app's
/// own audio session, instead of through Web Audio. After a filmed session
/// (the native recorder switches the session to recording and back), WebKit's
/// audio output stopped: from the second filmed session after a launch the
/// bell and the clack were silent, and both came out at once when the app
/// was left and opened again (TestFlight builds 107 and 108). Rebuilding the
/// AudioContext didn't help; the output under it is WebKit's, out of reach of
/// the page. The callouts had the same trouble and also play natively now.
///
/// Sounds are the web build's files in the app bundle (public/), loaded once.
@objc(NativeSoundsPlugin)
public class NativeSoundsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeSoundsPlugin"
    public let jsName = "NativeSounds"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "preload", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise)
    ]

    private var players: [String: AVAudioPlayer] = [:]

    private func player(_ file: String) -> AVAudioPlayer? {
        if let p = players[file] { return p }
        let name = file.hasPrefix("/") ? String(file.dropFirst()) : file
        let url = Bundle.main.bundleURL.appendingPathComponent("public").appendingPathComponent(name)
        guard let p = try? AVAudioPlayer(contentsOf: url) else { return nil }
        p.prepareToPlay()
        players[file] = p
        return p
    }

    /// `{ files: ["/big-bell-330719.mp3", ...] }`: loads them ahead of the first cue.
    @objc func preload(_ call: CAPPluginCall) {
        let files = call.getArray("files", String.self) ?? []
        DispatchQueue.main.async {
            let loaded = files.filter { self.player($0) != nil }
            call.resolve(["loaded": loaded.count])
        }
    }

    /// `{ file, volume }`: plays it from the start. Resolves `{ durationMs }`
    /// once it has started, or rejects if it couldn't be loaded or started.
    @objc func play(_ call: CAPPluginCall) {
        guard let file = call.getString("file") else {
            call.reject("no file")
            return
        }
        let volume = call.getFloat("volume") ?? 1.0
        DispatchQueue.main.async {
            guard let p = self.player(file) else {
                call.reject("could not load \(file)")
                return
            }
            p.volume = volume
            p.currentTime = 0
            var started = p.play()
            if !started {
                // A session someone else left inactive: put the app's back.
                AppDelegate.applyAudioSessionCategory()
                try? AVAudioSession.sharedInstance().setActive(true)
                started = p.play()
            }
            if started {
                call.resolve(["durationMs": p.duration * 1000])
            } else {
                call.reject("could not play \(file)")
            }
        }
    }
}
