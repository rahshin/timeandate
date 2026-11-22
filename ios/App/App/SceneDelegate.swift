import AVFoundation
import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = TimerBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

private final class TimerBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(ForegroundTimerPlugin())
    }
}

// Bridge calls and synthesizer state are serialized on the main queue.
@objc private final class ForegroundTimerPlugin: CAPPlugin, CAPBridgedPlugin, AVSpeechSynthesizerDelegate, @unchecked Sendable {
    let identifier = "ForegroundTimerPlugin"
    let jsName = "ForegroundTimer"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "speak", returnType: CAPPluginReturnPromise)!,
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)!,
        CAPPluginMethod(name: "setAwake", returnType: CAPPluginReturnPromise)!
    ]

    private let synthesizer = AVSpeechSynthesizer()
    private var current: (AVSpeechUtterance, CAPPluginCall)?
    private var keepAwake = false

    override func load() {
        synthesizer.delegate = self
        NotificationCenter.default.addObserver(self, selector: #selector(backgrounded),
            name: UIApplication.willResignActiveNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(updateWake),
            name: UIApplication.didBecomeActiveNotification, object: nil)
    }

    @objc func speak(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.stopSpeech()
            let now = Date().timeIntervalSince1970 * 1000
            guard UIApplication.shared.applicationState == .active,
                  let expiresAt = call.getDouble("expiresAt"), expiresAt > now,
                  let text = call.getString("text"), let voice = AVSpeechSynthesisVoice(language: "en-US") else {
                call.resolve()
                return
            }
            let utterance = AVSpeechUtterance(string: text)
            utterance.voice = voice
            self.current = (utterance, call)
            self.synthesizer.speak(utterance)
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.stopSpeech()
            call.resolve()
        }
    }

    @objc func setAwake(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.keepAwake = call.getBool("enabled") ?? false
            self.updateWake()
            call.resolve()
        }
    }

    private func stopSpeech() {
        let call = current?.1
        current = nil
        synthesizer.stopSpeaking(at: .immediate)
        call?.resolve()
    }

    @objc private func backgrounded() {
        stopSpeech()
        UIApplication.shared.isIdleTimerDisabled = false
    }

    @objc private func updateWake() {
        UIApplication.shared.isIdleTimerDisabled = keepAwake && UIApplication.shared.applicationState == .active
    }

    private func finish(_ utterance: AVSpeechUtterance) {
        DispatchQueue.main.async {
            guard let (active, call) = self.current, active === utterance else { return }
            self.current = nil
            call.resolve()
        }
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        finish(utterance)
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        finish(utterance)
    }
}
