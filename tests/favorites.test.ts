import { describe, expect, it } from "vitest";
import { MAX_FAVORITES, parseFavorites, sameFavorite, type Favorite } from "../src/lib/favorites";

const favorite: Favorite = { id: "one", text: "Hello!", tone: "warm", strength: "subtle" };

describe("saved favorites", () => {
  it("handles a new browser and round-trips valid favorites", () => {
    expect(parseFavorites(null)).toEqual([]);
    expect(parseFavorites(JSON.stringify([favorite]))).toEqual([favorite]);
  });
  it.each(["not-json", "{}", '[{"id":"bad"}]', JSON.stringify([{ ...favorite, tone: "wrong" }]),
    JSON.stringify([{ ...favorite, text: "[angry] bad" }]), JSON.stringify([favorite, favorite])])(
    "surfaces corrupt or unsupported saved data %j", (raw) => { expect(() => parseFavorites(raw)).toThrow(); },
  );
  it("enforces the saved favorite limit", () => {
    const many = Array.from({ length: MAX_FAVORITES + 1 }, (_, i) => ({ ...favorite, id: String(i) }));
    expect(() => parseFavorites(JSON.stringify(many))).toThrow();
  });
  it("deduplicates by words and both delivery choices, not ID", () => {
    expect(sameFavorite(favorite, { ...favorite, text: " Hello! " })).toBe(true);
    expect(sameFavorite(favorite, { ...favorite, tone: "calm" })).toBe(false);
    expect(sameFavorite(favorite, { ...favorite, strength: "expressive" })).toBe(false);
  });
});
