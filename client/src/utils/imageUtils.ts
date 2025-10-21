import html2canvas from 'html2canvas';

export interface WorkoutStats {
  timestamp: string;
  emphases: string[];
  difficulty: string;
  shotsCalledOut: number;
  roundsCompleted: number;
  roundsPlanned: number;
  roundLengthMin: number;
}

/**
 * Captures a DOM element as a canvas and downloads it as an image
 * @param element - The DOM element to capture
 * @param filename - The filename for the downloaded image
 * @param options - html2canvas options for customization
 */
export const captureAndDownloadElement = async (
  element: HTMLElement,
  filename: string = 'workout-summary',
  options: Partial<Parameters<typeof html2canvas>[1]> = {}
): Promise<void> => {
  try {
    // Default options for high quality capture
    const defaultOptions = {
      backgroundColor: null,
      scale: 2, // Higher resolution
      useCORS: true,
      allowTaint: false,
      height: element.scrollHeight,
      width: element.scrollWidth,
      ...options
    };

    // Capture the element as canvas
    const canvas = await html2canvas(element, defaultOptions);
    
    // Convert canvas to blob
    canvas.toBlob((blob) => {
      if (!blob) {
        throw new Error('Failed to create image blob');
      }
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.png`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 'image/png', 0.95);
    
  } catch (error) {
    console.error('Error capturing element:', error);
    throw new Error('Failed to capture and download image');
  }
};

/**
 * Captures a DOM element and returns it as a blob for sharing
 * @param element - The DOM element to capture
 * @param options - html2canvas options for customization
 * @returns Promise<Blob> - The image blob
 */
export const captureElementAsBlob = async (
  element: HTMLElement,
  options: Partial<Parameters<typeof html2canvas>[1]> = {}
): Promise<Blob> => {
  try {
    const defaultOptions = {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      allowTaint: false,
      height: element.scrollHeight,
      width: element.scrollWidth,
      ...options
    };

    const canvas = await html2canvas(element, defaultOptions);
    
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create image blob'));
        }
      }, 'image/png', 0.95);
    });
  } catch (error) {
    console.error('Error capturing element:', error);
    throw new Error('Failed to capture element as blob');
  }
};

/**
 * Generates a filename for workout summary based on stats
 * @param stats - Workout statistics
 * @returns string - Generated filename
 */
export const generateWorkoutFilename = (stats: WorkoutStats): string => {
  const date = new Date(stats.timestamp);
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  const emphases = stats.emphases.join('-').replace(/\s+/g, '-').toLowerCase();
  
  return `shotcaller-workout-${dateStr}-${emphases}-${stats.difficulty}`;
};

/**
 * Checks if the Web Share API is available
 * @returns boolean
 */
export const isWebShareSupported = (): boolean => {
  return 'share' in navigator;
};

/**
 * Shares workout image using Web Share API
 * @param blob - Image blob to share
 * @param stats - Workout stats for generating share text
 */
export const shareWorkoutImage = async (blob: Blob, stats: WorkoutStats): Promise<void> => {
  if (!isWebShareSupported()) {
    throw new Error('Web Share API not supported');
  }

  try {
    const file = new File([blob], `${generateWorkoutFilename(stats)}.png`, {
      type: 'image/png',
    });

    const shareText = `Just completed a ${stats.difficulty} workout with ${stats.shotsCalledOut} shots called out! 🥊 ${stats.roundsCompleted}/${stats.roundsPlanned} rounds of ${stats.emphases.join(', ')} training. #NakMuay #ShotcallerNakMuay #MuayThai`;

    await navigator.share({
      title: 'Shotcaller Nak Muay Workout Complete!',
      text: shareText,
      files: [file],
    });
  } catch (error) {
    console.error('Error sharing workout:', error);
    throw new Error('Failed to share workout image');
  }
};