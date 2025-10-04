import React from 'react';

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
  isVisible
}) => {
  if (!isVisible) return null;





  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '1rem'
      }}
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) {
          onDismiss();
        }
      }}
    >
      <div
        style={{
          maxWidth: '400px',
          width: '100%',
          background: '#1a1a1a',
          color: 'white',
          padding: '2rem',
          borderRadius: '12px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          textAlign: 'center'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* App Icon */}
        <div
          style={{
            width: 64,
            height: 64,
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem auto'
          }}
        >
          <img
            src="/assets/logo_icon.png"
            alt="Nak Muay Shot Caller"
            style={{
              width: 48,
              height: 48,
              borderRadius: '12px',
              objectFit: 'cover'
            }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              target.parentElement!.innerHTML = '🥊';
              target.parentElement!.style.fontSize = '32px';
            }}
          />
        </div>

        {/* Content */}
        <h2 style={{ margin: '0 0 1rem 0', color: '#f9a8d4', fontSize: '1.25rem' }}>
          Download this App!
        </h2>
        
        <p style={{ margin: '0 0 1.5rem 0', lineHeight: 1.5, color: '#e5e7eb' }}>
          Install it right from your browser! Get faster loading, distraction-free full-screen training, and offline access.
        </p>
        
        <div style={{
          background: '#2a2a2a', 
          padding: '1rem', 
          borderRadius: '8px', 
          margin: '1rem 0', 
          textAlign: 'left',
          fontSize: '0.9rem'
        }}>
          <div style={{ marginBottom: '0.75rem' }}>
            <strong style={{ color: '#60a5fa' }}>Desktop Chrome:</strong><br />
            • Look for ⊕ icon in address bar<br />
            • Or: Menu (⋮) → "Install Nak Muay Shot Caller"
          </div>
          <div>
            <strong style={{ color: '#60a5fa' }}>Mobile:</strong><br />
            • Menu → "Add to Home Screen"<br />
            • Or: Share → "Add to Home Screen"
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
          <button
            onClick={onDismiss}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
            }}
          >
            Got It!
          </button>
          
          <button
            onClick={onDismissPermanently}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#f9a8d4',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(249,168,212,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
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