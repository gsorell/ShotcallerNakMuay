import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { 
  captureAndDownloadElement, 
  shareWorkoutImage, 
  isWebShareSupported,
  WorkoutStats 
} from './utils/imageUtils';

interface WorkoutCompletedProps {
  stats: WorkoutStats;
  onRestart: () => void;
  onReset: () => void;
  onViewLog: () => void;
}

export default function WorkoutCompleted({ stats, onRestart, onReset, onViewLog }: WorkoutCompletedProps) {
  const workoutSummaryRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const handleDownload = async () => {
    if (!workoutSummaryRef.current) return;
    setIsCapturing(true);
    try {
      const filename = `workout-${new Date(stats.timestamp).toISOString().split('T')[0]}`;
      await captureAndDownloadElement(workoutSummaryRef.current, filename);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleShare = async () => {
    if (!workoutSummaryRef.current) return;
    setIsCapturing(true);
    try {
      const canvas = await html2canvas(workoutSummaryRef.current);
      canvas.toBlob(async (blob: Blob | null) => {
        if (blob) {
          await shareWorkoutImage(blob, stats);
        }
      });
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div 
      ref={workoutSummaryRef}
      style={{
        maxWidth: 500,
        margin: '2rem auto',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        borderRadius: 20,
        padding: '2rem',
        color: 'white',
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
      }}>
      
      {/* Header Section */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <img src="/assets/icon_stacked.png" alt="Logo" style={{ 
          maxWidth: 180, 
          height: 'auto',
          marginBottom: 20
        }} />
        
        <h1 style={{ 
          margin: 0, 
          color: '#f9a8d4',
          fontSize: '2rem',
          fontWeight: 700,
          marginBottom: 8
        }}>
          Workout Complete!
        </h1>
      </div>
      {/* Date & Time */}
      <div style={{ 
        fontSize: '0.9rem', 
        color: '#94a3b8', 
        marginBottom: 16,
        textAlign: 'center'
      }}>
        {new Date(stats.timestamp).toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })} • {new Date(stats.timestamp).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        })}
      </div>
      
      {/* Workout Type */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h2 style={{
          margin: 0,
          fontSize: '1.5rem',
          fontWeight: 700,
          color: '#f9a8d4',
          marginBottom: 24
        }}>
          {stats.emphases.join(' • ')}
        </h2>
        
        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px',
          marginBottom: 16
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: '0.75rem', 
              color: '#94a3b8', 
              marginBottom: 4,
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }}>
              Difficulty
            </div>
            <div style={{ 
              fontSize: '1.2rem', 
              fontWeight: 700, 
              color: 'white',
              textTransform: 'capitalize'
            }}>
              {stats.difficulty}
            </div>
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: '0.75rem', 
              color: '#94a3b8', 
              marginBottom: 4,
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }}>
              Shots Called
            </div>
            <div style={{ 
              fontSize: '1.2rem', 
              fontWeight: 700, 
              color: 'white'
            }}>
              {stats.shotsCalledOut}
            </div>
          </div>
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: '0.75rem', 
              color: '#94a3b8', 
              marginBottom: 4,
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }}>
              Rounds
            </div>
            <div style={{ 
              fontSize: '1.2rem', 
              fontWeight: 700, 
              color: 'white'
            }}>
              {stats.roundsCompleted}/{stats.roundsPlanned}
            </div>
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: '0.75rem', 
              color: '#94a3b8', 
              marginBottom: 4,
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }}>
              Duration
            </div>
            <div style={{ 
              fontSize: '1.2rem', 
              fontWeight: 700, 
              color: 'white'
            }}>
              {stats.roundLengthMin} min/round
            </div>
          </div>
        </div>
      </div>
      {/* Action Buttons */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: 12, 
        marginBottom: 16 
      }}>
        <button 
          onClick={onRestart} 
          style={{ 
            background: '#2563eb', 
            color: 'white', 
            border: 'none', 
            borderRadius: 12, 
            padding: '14px 20px', 
            fontWeight: 600, 
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          Restart
        </button>
        
        <button 
          onClick={onReset} 
          style={{ 
            background: '#ef4444', 
            color: 'white', 
            border: 'none', 
            borderRadius: 12, 
            padding: '14px 20px', 
            fontWeight: 600, 
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          Home
        </button>
      </div>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: isWebShareSupported() ? '1fr 1fr 1fr' : '1fr 1fr',
        gap: 12
      }}>
        <button 
          onClick={onViewLog} 
          style={{ 
            background: '#f9a8d4', 
            color: 'white', 
            border: 'none', 
            borderRadius: 12, 
            padding: '14px 16px', 
            fontWeight: 600, 
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          View Log
        </button>
        
        <button 
          onClick={handleDownload}
          disabled={isCapturing}
          style={{ 
            background: isCapturing ? '#6b7280' : '#10b981', 
            color: 'white', 
            border: 'none', 
            borderRadius: 12, 
            padding: '14px 16px', 
            fontWeight: 600, 
            cursor: isCapturing ? 'not-allowed' : 'pointer',
            fontSize: '0.9rem'
          }}
        >
          {isCapturing ? 'Downloading...' : 'Download'}
        </button>
        
        {isWebShareSupported() && (
          <button 
            onClick={handleShare}
            disabled={isCapturing}
            style={{ 
              background: isCapturing ? '#6b7280' : '#8b5cf6', 
              color: 'white', 
              border: 'none', 
              borderRadius: 12, 
              padding: '14px 16px', 
              fontWeight: 600, 
              cursor: isCapturing ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem'
            }}
          >
            {isCapturing ? 'Sharing...' : 'Share'}
          </button>
        )}
      </div>
      
      {/* Brand Footer */}
      <div style={{ 
        textAlign: 'center', 
        marginTop: 24,
        paddingTop: 16,
        borderTop: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8
      }}>
        <img src="/assets/logo_icon.png" alt="" style={{ 
          width: 16, 
          height: 16,
          opacity: 0.7
        }} />
        <span style={{ 
          fontSize: '0.75rem', 
          color: '#94a3b8',
          fontWeight: 500
        }}>
          NAK MUAY SHOT CALLER
        </span>
      </div>
    </div>
  );
}