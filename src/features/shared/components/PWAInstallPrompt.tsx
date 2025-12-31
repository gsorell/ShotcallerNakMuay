import React from "react";
import "./PWAInstallPrompt.css";

interface PWAInstallPromptProps {
  onInstall: () => Promise<boolean>;
  onDismiss: () => void;
  onDismissPermanently: () => void;
  isVisible: boolean;
}

const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({
  onInstall,
  onDismiss,
  onDismissPermanently,
  isVisible,
}) => {
  if (!isVisible) return null;

  // Detect if user is on Android
  const isAndroid = /Android/i.test(navigator.userAgent);

  const handleOpenPlayStore = () => {
    window.open('https://play.google.com/store/apps/details?id=com.shotcallernakmuay.app', '_blank');
    onDismissPermanently();
  };

  // Show Play Store modal for Android users
  if (isAndroid) {
    return (
      <div
        className="pwa-prompt-backdrop"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onDismiss();
          }
        }}
      >
        <div
          className="pwa-prompt-card"
          onClick={(e) => e.stopPropagation()}
        >
          {/* App Icon */}
          <div className="pwa-prompt-icon">
            <img
              src="/assets/logo_icon.png"
              alt="Nak Muay Shot Caller"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
                target.parentElement!.innerHTML = '<span class="pwa-prompt-icon-fallback">🥊</span>';
              }}
            />
          </div>

          {/* Content */}
          <h2 className="pwa-prompt-title">
            Now Available on Google Play!
          </h2>

          <p className="pwa-prompt-description">
            Get the best experience with the native Android app. Download now from the Google Play Store for better performance, offline support, and enhanced features.
          </p>

          {/* Actions */}
          <div className="pwa-prompt-buttons">
            <button
              onClick={handleOpenPlayStore}
              className="pwa-prompt-btn pwa-prompt-btn-primary"
            >
              Open in Play Store
            </button>

            <button
              onClick={onDismiss}
              className="pwa-prompt-btn pwa-prompt-btn-secondary"
            >
              Continue with Web Version
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show regular PWA install prompt for non-Android users
  return (
    <div
      className="pwa-prompt-backdrop"
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) {
          onDismiss();
        }
      }}
    >
      <div
        className="pwa-prompt-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* App Icon */}
        <div className="pwa-prompt-icon">
          <img
            src="/assets/logo_icon.png"
            alt="Nak Muay Shot Caller"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
              target.parentElement!.innerHTML = '<span class="pwa-prompt-icon-fallback">🥊</span>';
            }}
          />
        </div>

        {/* Content */}
        <h2 className="pwa-prompt-title">
          Download this App!
        </h2>

        <p className="pwa-prompt-description">
          Install it right from your browser! Get faster loading,
          distraction-free full-screen training, and offline access.
        </p>

        <div className="pwa-prompt-instructions">
          <div>
            <strong>Desktop Chrome:</strong>
            <br />
            • Look for ⊕ icon in address bar
            <br />• Or: Menu (⋮) → "Install Nak Muay Shot Caller"
          </div>
          <div>
            <strong>Mobile:</strong>
            <br />
            • Menu → "Add to Home Screen"
            <br />• Or: Share → "Add to Home Screen"
          </div>
        </div>

        {/* Actions */}
        <div className="pwa-prompt-buttons">
          <button
            onClick={onDismiss}
            className="pwa-prompt-btn pwa-prompt-btn-primary"
          >
            Got It!
          </button>

          <button
            onClick={onDismissPermanently}
            className="pwa-prompt-btn pwa-prompt-btn-secondary"
            title="Don't show this again"
          >
            Don't Show Again
          </button>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
