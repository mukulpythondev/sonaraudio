import { isStrength, isTone, textError, type Strength, type Tone } from "./speech";

// Preserve existing saved phrases across the SonarAudio rebrand.
export const FAVORITES_KEY = "bolbhaav:favorites:v1";
export const MAX_FAVORITES = 12;

export interface Favorite {
  id: string;
  text: string;
  tone: Tone;
  strength: Strength;
}

function isFavorite(value: unknown): value is Favorite {
  return typeof value === "object" && value !== null
    && "id" in value && typeof value.id === "string" && value.id.length > 0 && value.id.length < 100
    && "text" in value && typeof value.text === "string" && textError(value.text) === null
    && "tone" in value && isTone(value.tone)
    && "strength" in value && isStrength(value.strength);
}

export function parseFavorites(raw: string | null): Favorite[] {
  if (raw === null) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || value.length > MAX_FAVORITES || !value.every(isFavorite)) {
    throw new Error("Saved favorites have an unsupported format.");
  }
  if (new Set(value.map((item) => item.id)).size !== value.length) {
    throw new Error("Saved favorites contain duplicate identifiers.");
  }
  return value;
}

export function sameFavorite(a: Pick<Favorite, "text" | "tone" | "strength">, b: Pick<Favorite, "text" | "tone" | "strength">): boolean {
  return a.text.trim() === b.text.trim() && a.tone === b.tone && a.strength === b.strength;
}
