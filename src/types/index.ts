import type INITIAL_TECHNIQUES from "@/constants/techniques";

export type TechniquesShape = typeof INITIAL_TECHNIQUES;

export type EmphasisKey =
  | "timer_only"
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

export type Page = "timer" | "editor" | "logs" | "completed";

// Type for techniques with source style information
export type TechniqueWithStyle = {
  text: string;
  style: string;
};
