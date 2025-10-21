import html2canvas from 'html2canvas';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

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
    
    // Check if we're running in a native app
    const isNative = Capacitor.isNativePlatform();
    
    if (isNative) {
      // Native mobile: Use Capacitor Filesystem API
      await downloadImageNative(canvas, filename);
    } else {
      // Web: Use traditional download approach
      await downloadImageWeb(canvas, filename);
    }
    
  } catch (error) {
    console.error('Error capturing element:', error);
    throw new Error('Failed to capture and download image');
  }
};

/**
 * Downloads image in web environment using blob URL and anchor element
 */
const downloadImageWeb = async (canvas: HTMLCanvasElement, filename: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to create image blob'));
        return;
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
      resolve();
    }, 'image/png', 0.95);
  });
};

/**
 * Downloads image in native environment using Capacitor Filesystem
 */
const downloadImageNative = async (canvas: HTMLCanvasElement, filename: string): Promise<void> => {
  try {
    // Convert canvas to base64
    const base64Data = canvas.toDataURL('image/png', 0.95);
    
    // Remove the data URL prefix to get just the base64 string
    const base64String = base64Data.replace(/^data:image\/png;base64,/, '');
    
    // Save to device using Capacitor Filesystem in Documents directory
    // Create a ShotcallerNakMuay subdirectory for better organization
    const result = await Filesystem.writeFile({
      path: `ShotcallerNakMuay/${filename}.png`,
      data: base64String,
      directory: Directory.Documents
      // Note: For base64 data, we don't need to specify encoding
    });
    
    console.log('File saved successfully:', result.uri);
    
    // Show a success message (you might want to use a toast library)
    if (typeof window !== 'undefined' && 'alert' in window) {
      alert(`Workout image saved to Documents/ShotcallerNakMuay folder as ${filename}.png`);
    }
    
  } catch (error) {
    console.error('Error saving file:', error);
    
    // Try one more time with just the root Documents directory
    try {
      const base64Data = canvas.toDataURL('image/png', 0.95);
      const base64String = base64Data.replace(/^data:image\/png;base64,/, '');
      
      const result = await Filesystem.writeFile({
        path: `${filename}.png`,
        data: base64String,
        directory: Directory.Documents
      });
      
      console.log('File saved to Documents root:', result.uri);
      
      if (typeof window !== 'undefined' && 'alert' in window) {
        alert(`Workout image saved to Documents folder as ${filename}.png`);
      }
    } catch (fallbackError) {
      console.error('Fallback save also failed:', fallbackError);
      throw new Error('Failed to save image to device');
    }
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
 * Generates a unique filename for workout summary based on stats
 * Includes date and time to prevent file overwrites on multiple downloads
 * @param stats - Workout statistics
 * @returns string - Generated filename with unique timestamp (YYYY-MM-DD-HH-MM-SS format)
 */
export const generateWorkoutFilename = (stats: WorkoutStats): string => {
  const date = new Date(stats.timestamp);
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  const timeStr = date.toISOString().split('T')[1].replace(/:/g, '-').split('.')[0]; // HH-MM-SS
  const emphases = stats.emphases.join('-').replace(/\s+/g, '-').toLowerCase();
  
  return `shotcaller-workout-${dateStr}-${timeStr}-${emphases}-${stats.difficulty}`;
};

/**
 * Checks if the Web Share API is available
 * @returns boolean
 */
export const isWebShareSupported = (): boolean => {
  return 'share' in navigator;
};

/**
 * Checks if we're running in a native app environment
 * @returns boolean
 */
export const isNativeApp = (): boolean => {
  return Capacitor.isNativePlatform();
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