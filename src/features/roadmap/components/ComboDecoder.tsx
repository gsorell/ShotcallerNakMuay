import { useState } from "react";

import { SpriteFigure } from "@/features/learn/components/TechniqueSprite";

import { decodeCombos } from "../comboDecode";
import "./ComboDecoder.css";

interface ComboDecoderProps {
  /** A level's authored combinations, in authored order. */
  combos: readonly string[];
  /** Mirror the combinations, as the callout engine will when this is on. */
  southpaw?: boolean;
}

/**
 * A level's combinations, spelled out as figures.
 *
 * One row per combination: the shorthand as it will be called, and under it the
 * strikes in order. Nothing moves but the silhouettes themselves — no carousel,
 * no auto-advance — because this sits in a rest period. A panel that advanced
 * on its own would punish looking away, on the screen the app otherwise spends
 * the whole round telling you not to watch.
 */
export function ComboDecoder({ combos, southpaw = false }: ComboDecoderProps) {
  const decoded = decodeCombos(combos, southpaw);
  const [broken, setBroken] = useState<string[]>([]);

  if (decoded.length === 0) return null;

  return (
    <div className="combo-decoder">
      {decoded.map(({ text, beats }) => (
        <div className="combo-decoder-row" key={text}>
          <div className="combo-decoder-code">{text}</div>
          <ol className="combo-decoder-beats">
            {beats.map((beat, i) => {
              const sprite =
                beat.sprite && !broken.includes(beat.sprite.src)
                  ? beat.sprite
                  : undefined;
              return (
                <li className="combo-decoder-beat" key={`${beat.token}-${i}`}>
                  {sprite ? (
                    <SpriteFigure
                      variant={sprite}
                      name={beat.name ?? beat.token}
                      onBroken={() =>
                        setBroken((b) => [...b, sprite.src])
                      }
                    />
                  ) : (
                    // Keeps the slot, so a beat with no sheet still reads as a
                    // beat rather than shortening the combination.
                    <span className="combo-decoder-beat-blank" aria-hidden="true" />
                  )}
                  <span className="combo-decoder-beat-name">
                    {beat.name ?? beat.token}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}

export default ComboDecoder;
