import React from "react";
import "./PWAInstallPrompt.css";

interface PWAInstallPromptProps {
  onDismiss: () => void;
  onDismissPermanently: () => void;
  isVisible: boolean;
}

const APP_STORE_URL = "https://apps.apple.com/us/app/shot-caller-nak-muay/id6757487630";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.shotcallernakmuay.app&pcampaignid=web_share";

type Platform = "ios" | "android" | "other";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({
  onDismiss,
  onDismissPermanently,
  isVisible,
}) => {
  if (!isVisible) return null;

  const platform = detectPlatform();

  const handleOpenAppStore = () => {
    window.open(APP_STORE_URL, "_blank");
    onDismissPermanently();
  };

  const handleOpenPlayStore = () => {
    window.open(PLAY_STORE_URL, "_blank");
    onDismissPermanently();
  };

  // Show App Store modal for iOS users
  if (platform === "ios") {
    return (
      <div
        className="pwa-prompt-backdrop"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onDismiss();
          }
        }}
      >
        <div className="pwa-prompt-card" onClick={(e) => e.stopPropagation()}>
          <div className="pwa-prompt-icon">
            <img
              src="/assets/logo_icon.png"
              alt="Nak Muay Shot Caller"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
                target.parentElement!.innerHTML =
                  '<span class="pwa-prompt-icon-fallback">🥊</span>';
              }}
            />
          </div>

          <h2 className="pwa-prompt-title">Now Available on the App Store!</h2>

          <p className="pwa-prompt-description">
            Get the native iOS app for the best experience and to support
            continued development.
          </p>

          <div className="pwa-prompt-buttons">
            <button
              onClick={handleOpenAppStore}
              className="pwa-prompt-btn pwa-prompt-btn-primary"
            >
              Open in App Store
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

  // Show Play Store modal for Android users
  if (platform === "android") {
    return (
      <div
        className="pwa-prompt-backdrop"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onDismiss();
          }
        }}
      >
        <div className="pwa-prompt-card" onClick={(e) => e.stopPropagation()}>
          <div className="pwa-prompt-icon">
            <img
              src="/assets/logo_icon.png"
              alt="Nak Muay Shot Caller"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
                target.parentElement!.innerHTML =
                  '<span class="pwa-prompt-icon-fallback">🥊</span>';
              }}
            />
          </div>

          <h2 className="pwa-prompt-title">Now Available on Google Play!</h2>

          <p className="pwa-prompt-description">
            Get the native Android app for the best experience and to support
            continued development.
          </p>

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

  // Show native app promotion for desktop/other users
  return (
    <div
      className="pwa-prompt-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onDismiss();
        }
      }}
    >
      <div className="pwa-prompt-card" onClick={(e) => e.stopPropagation()}>
        <div className="pwa-prompt-icon">
          <img
            src="/assets/logo_icon.png"
            alt="Nak Muay Shot Caller"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
              target.parentElement!.innerHTML =
                '<span class="pwa-prompt-icon-fallback">🥊</span>';
            }}
          />
        </div>

        <h2 className="pwa-prompt-title">Get the Mobile App!</h2>

        <p className="pwa-prompt-description">
          Get the native app for iPhone or Android for the best experience and
          to support continued development.
        </p>

        <div className="pwa-prompt-buttons pwa-prompt-buttons-stacked">
          <button
            onClick={handleOpenAppStore}
            className="pwa-prompt-btn pwa-prompt-btn-primary pwa-prompt-btn-appstore"
          >
            Download for iPhone
          </button>

          <button
            onClick={handleOpenPlayStore}
            className="pwa-prompt-btn pwa-prompt-btn-primary pwa-prompt-btn-playstore"
          >
            Download for Android
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
};

export default PWAInstallPrompt;
