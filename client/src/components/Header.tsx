import './Header.css';
import React, { useState, useEffect } from 'react';

const Header = () => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  useEffect(() => {
    document.body.style.overscrollBehaviorY = 'contain';
    return () => {
      document.body.style.overscrollBehaviorY = 'auto';
    };
  }, []);

  const logoContainerStyle: React.CSSProperties = {
    cursor: 'pointer',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
  };

  const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    zIndex: 50,
    padding: '1rem',
    overflowY: 'auto',
  };

  return (
    <>
      <header className="app-header">
        <div className="logo" onClick={() => setIsHelpOpen(true)} style={logoContainerStyle}>
          {/* Replaced two images with single combined banner */}
          <img src="/assets/Logo_Header_Banner_Smooth.png" alt="Shotcaller Nak Muay Header Banner" />
        </div>
      </header>
      {isHelpOpen && (
        <div style={modalOverlayStyle} onClick={() => setIsHelpOpen(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <HelpContent onClose={() => setIsHelpOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
};

export default Header;

interface HelpContentProps {
  onClose: () => void;
}

const HelpContent: React.FC<HelpContentProps> = ({ onClose }) => {
  const modalContent = {
    maxWidth: '48rem',
    width: 'calc(100% - 2rem)',
    padding: '1.25rem 1.5rem',
    borderRadius: '0.75rem',
    background: 'rgb(15, 23, 42)',
    color: 'white',
    boxShadow: 'rgba(0, 0, 0, 0.6) 0px 10px 30px',
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  };

  const h3Style = {
    margin: '0px',
    fontSize: '1.125rem',
  };

  const closeButtonStyle = {
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: '8px',
    color: 'rgb(249, 168, 212)',
    cursor: 'pointer',
    fontWeight: 700,
    padding: '0.5rem 0.75rem',
    textAlign: 'center' as const,
  };

  const pStyle = {
    color: 'rgb(249, 168, 212)',
    margin: '0.5rem 0px',
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse' as const,
    color: 'rgb(249, 168, 212)',
    fontSize: '0.9rem',
  };

  const thStyle = {
    textAlign: 'left' as const,
    padding: '0.5rem 0.75rem',
    color: 'rgb(255, 255, 255)',
    width: '28%',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  };

  const tdStyle = {
    padding: '0.5rem 0.75rem',
    verticalAlign: 'top' as const,
  };

  const tdBoldStyle = { ...tdStyle, fontWeight: 700 };

  return (
    <div style={modalContent}>
      <div style={headerStyle}>
        <h3 style={h3Style}>How It Works</h3>
        <button style={closeButtonStyle} onClick={onClose}>Close</button>
      </div>
      <p style={{ ...pStyle, margin: '0.5rem 0px' }}>Turn your shadowboxing and bagwork into a guided session with spoken techniques and timed rounds. Focus on reaction and flow — just like a real trainer the app calls the strikes so you learn to respond automatically.</p>
      <p style={{ ...pStyle, margin: '0.25rem 0px 0px' }}>Pick 1 or more emphases, set a difficulty level, and get started!</p>
      <p style={{ ...pStyle, margin: '0.25rem 0px 0px' }}>---</p>
      <p style={{ ...pStyle, margin: '0.25rem 0px 0px' }}>Want to customize your own workout? Modify existing sets or create your own by maintaining groups, techniques, and combinations in the Technique Editor.</p>
      <div style={{ marginTop: '0.75rem' }}>
    <div style={headerStyle}></div>
        <h3
          style={{
            margin: '0px 0px 0.5rem',
            color: '#ffffff',
            textAlign: 'left' as const,
          }}
        >
          Glossary
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Technique</th>
                <th style={{...thStyle, width: 'auto', color: 'rgb(243, 232, 255)'}}>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={tdBoldStyle}>Jab (1)</td><td style={tdStyle}>A straight punch with the lead hand, used to gauge distance and set up other strikes.</td></tr>
              <tr><td style={tdBoldStyle}>Cross (2)</td><td style={tdStyle}>A straight punch with the rear hand, thrown across the body for maximum power.</td></tr>
              <tr><td style={tdBoldStyle}>Hook (3, 4)</td><td style={tdStyle}>A curved punch thrown with either hand, typically targeting the side of the opponent's head or body.</td></tr>
              <tr><td style={tdBoldStyle}>Uppercut (5, 6)</td><td style={tdStyle}>A vertical punch thrown with either hand, traveling upward to target the opponent's chin or solar plexus.</td></tr>
              <tr><td style={tdBoldStyle}>Elbow Strike (Sok)</td><td style={tdStyle}>A powerful close-range strike unique to Muay Thai. Elbows can be thrown horizontally, diagonally, vertically, or straight down and are often used when the opponent is in clinching range.</td></tr>
              <tr><td style={tdBoldStyle}>Knee Strike (Khao)</td><td style={tdStyle}>A strike with the knee, often used in the clinch but can also be thrown from a distance. Knee strikes are a hallmark of Muay Thai and are very effective at close range.</td></tr>
              <tr><td style={tdBoldStyle}>Roundhouse Kick (Tae Wiang)</td><td style={tdStyle}>The most common and powerful kick in Muay Thai, thrown with the shin. It can target the legs (low kick), body (mid kick), or head (high kick).</td></tr>
              <tr><td style={tdBoldStyle}>Switch Kick</td><td style={tdStyle}>A variation of the roundhouse kick, where the fighter switches stance before delivering the kick.</td></tr>
              <tr><td style={tdBoldStyle}>Teep (Push Kick)</td><td style={tdStyle}>A straight push kick used to maintain distance, disrupt rhythm, or knock an opponent off balance.</td></tr>
              <tr><td style={tdBoldStyle}>Guard</td><td style={tdStyle}>The basic defensive stance, with hands high to protect the head.</td></tr>
              <tr><td style={tdBoldStyle}>Clinch (Pam)</td><td style={tdStyle}>A grappling range where fighters hold onto each other; used for knees, elbows and sweeps.</td></tr>
              <tr><td style={tdBoldStyle}>Block (Bang)</td><td style={tdStyle}>Using the shin, arms, or gloves to absorb or deflect an incoming strike.</td></tr>
              <tr><td style={tdBoldStyle}>Parry</td><td style={tdStyle}>Using a hand to deflect a punch or kick to the side.</td></tr>
              <tr><td style={tdBoldStyle}>Slip</td><td style={tdStyle}>Moving the head to the side to avoid a straight punch.</td></tr>
              <tr><td style={tdBoldStyle}>Roll (or "Shoulder Roll")</td><td style={tdStyle}>Ducking the head and using the shoulder to block a hook, allowing the punch to roll off the shoulder.</td></tr>
              <tr><td style={tdBoldStyle}>Check</td><td style={tdStyle}>Lifting the shin to block an incoming roundhouse kick to the leg or body.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};