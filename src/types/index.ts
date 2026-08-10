import type INITIAL_TECHNIQUES from "@/constants/techniques";

export type TechniquesShape = typeof INITIAL_TECHNIQUES;

export type EmphasisKey =
  | "timer_only"
  | "freestyle"
  | "khao"
  | "mat"
  | "tae"
  | "femur"
  | "sok"
  | "boxing"
  | "newb"
  | "two_piece"
  | "southpaw";

export type Difficulty = "easy" | "medium" | "hard";

export type Page =
  | "timer"
  | "editor"
  | "logs"
  | "completed"
  | "learn"
  | "roadmap";

// Type for techniques with source style information
export type TechniqueWithStyle = {
  /** What is spoken. */
  text: string;
  style: string;
  /**
   * What is shown on screen, when it should differ from what is spoken.
   * The guided path uses it to put the name and the number up together while
   * calling only one of them, so a glance reinforces the mapping. Falls back
   * to `text` when absent.
   */
  display?: string;
};
