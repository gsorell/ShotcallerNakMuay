// Mirror technique for southpaw mode - only swap Left/Right directional words
// Exempts techniques from the 'southpaw' style to avoid double negatives
export const mirrorTechnique = (
  technique: string,
  sourceStyle?: string
): string => {
  // Safety check: ensure input is a valid string
  if (!technique || typeof technique !== "string") {
    return String(technique || "");
  }

  // EXEMPTION: Don't mirror techniques from southpaw style to avoid double negative
  if (sourceStyle === "southpaw") {
    return technique;
  }

  // Simple swap: Left ↔ Right (case insensitive, preserving original case)
  let mirrored = technique;

  try {
    // Use temporary placeholders to avoid double-swapping
    mirrored = mirrored.replace(/\bLeft\b/gi, "|||TEMP_LEFT|||");
    mirrored = mirrored.replace(/\bRight\b/gi, "Left");
    mirrored = mirrored.replace(/\|\|\|TEMP_LEFT\|\|\|/gi, "Right");
  } catch (error) {
    return technique; // Return original on error
  }

  return mirrored;
};
