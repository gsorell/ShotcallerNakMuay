import { createPortal } from "react-dom";

import { useEntitlement } from "@/features/entitlement";
import { usePaywall } from "@/features/paywall";
import { AnalyticsEvents, trackEvent } from "@/utils/analytics";
import { humanizeKey } from "@/utils/techniqueUtils";
import "@/styles/modal.css";
import { useWorkoutContext } from "../contexts/WorkoutProvider";
import {
  BLEND_ALL,
  DEFAULT_ROUND_STRUCTURE,
  describeRound,
  finisherSeconds,
  planRounds,
  type BetweenCallouts,
  type CalisthenicsPlacement,
  type IntensityShape,
  type MixMode,
  type RoundStructure,
} from "../utils/roundPlan";
import "./RoundStructureSheet.css";
import { VoiceSettings } from "./VoiceSettings";

type RoundStructureSheetProps = {
  onClose: () => void;
};

type Choice<T extends string> = { value: T; label: string };

const MIX_CHOICES: Choice<MixMode>[] = [
  { value: "blend", label: "Blended" },
  { value: "by_round", label: "By round" },
];

const MIX_HINTS: Record<MixMode, string> = {
  blend: "Every round draws on all your styles, in equal measure.",
  by_round:
    "Each round belongs to one style, in the order you picked them. Change any round below.",
};

// Stands for "whatever the rotation gives this round" in a round's picker.
const AUTO = "";

const INTENSITY_CHOICES: Choice<IntensityShape>[] = [
  { value: "steady", label: "Steady" },
  { value: "ramp", label: "Build" },
  { value: "pyramid", label: "Pyramid" },
];

const INTENSITY_HINTS: Record<IntensityShape, string> = {
  steady: "The same pace in every round.",
  ramp: "Starts easier and gets a little faster each round.",
  pyramid: "Builds to the middle rounds, then eases back off.",
};

const BETWEEN_CHOICES: Choice<BetweenCallouts>[] = [
  { value: "off", label: "Off" },
  { value: "jab", label: "Jab" },
  { value: "check", label: "Check" },
  { value: "either", label: "Jab/Check" },
];

const BETWEEN_HINTS: Record<BetweenCallouts, string> = {
  off: "Nothing is called between one callout and the next.",
  jab: "A jab is called after every callout.",
  check: "A check is called after every callout.",
  either: "A jab or a check, at random, is called after every callout.",
};

type CalisthenicsChoice = "off" | CalisthenicsPlacement;

const CALISTHENICS_CHOICES: Choice<CalisthenicsChoice>[] = [
  { value: "off", label: "Off" },
  { value: "sprinkled", label: "Mixed in" },
  { value: "finisher", label: "Finisher" },
  { value: "final_round", label: "Last round" },
];

/**
 * Everything about how a session runs beyond its styles and its clock: how the
 * rounds are structured, how techniques are called, and the voice calling
 * them. It replaced the Advanced Settings panel that used to sit at the foot
 * of the setup screen.
 *
 * A sheet rather than controls on the setup screen: most sessions never need
 * any of this, and the screen it is opened from shows one line for it however
 * much is set in here.
 *
 * Mounted only while open, and portalled to the body — the bar that opens it
 * has a backdrop filter, which would otherwise trap a fixed overlay inside it.
 */
export default function RoundStructureSheet({
  onClose,
}: RoundStructureSheetProps) {
  const { settings, emphasisList } = useWorkoutContext();
  const { isPro } = useEntitlement();
  const { openPaywall } = usePaywall();
  const {
    roundStructure,
    setRoundStructure,
    styleOrder,
    roundsCount,
    roundMin,
    addCalisthenics,
    setAddCalisthenics,
    selectedEmphases,
    readInOrder,
    setReadInOrder,
    southpawMode,
    setSouthpawMode,
  } = settings;

  // A bare timer or a freestyle round calls no techniques, so there is nothing
  // to structure or mirror — only the voice applies.
  const callsTechniques =
    !selectedEmphases.timer_only && !selectedEmphases.freestyle;
  const proTag = !isPro && <span className="rs-pro-tag">🔒 Pro</span>;

  // Free users see the controls at rest, the way the training options show
  // theirs; choosing anything opens the paywall instead.
  const structure = isPro ? roundStructure : DEFAULT_ROUND_STRUCTURE;
  const calisthenicsOn = isPro && addCalisthenics;

  const gated = (apply: () => void) => () => {
    if (!isPro) {
      onClose();
      openPaywall("round_structure");
      return;
    }
    apply();
  };

  const update = (patch: Partial<RoundStructure>, name: string) => {
    setRoundStructure({ ...structure, ...patch });
    try {
      trackEvent("round_structure_change", {
        setting_name: name,
        setting_value: String(Object.values(patch)[0]),
      });
    } catch { /* analytics must never break the setting it measures */ }
  };

  const labelOf = (key: string) => {
    const found = emphasisList.find((e) => e.key === key);
    return found ? found.label : humanizeKey(key);
  };

  const plan = planRounds({
    structure,
    styles: styleOrder,
    roundsCount,
    addCalisthenics: calisthenicsOn,
  });
  // The rounds a style can be given — a closing calisthenics round is not one.
  const styleRoundCount = plan.filter((r) => r.calisthenics !== "only").length;

  // What each round would be with nothing set by hand — what a round's
  // picker shows until someone changes it.
  const rotation = planRounds({
    structure: { ...structure, customRounds: [] },
    styles: styleOrder,
    roundsCount,
    addCalisthenics: calisthenicsOn,
  });

  const chooseMix = (mode: MixMode) => {
    // Turning it on starts from the rotation every time. Rounds set by hand
    // last week, for a different set of styles, should not come back.
    update({ mixMode: mode, customRounds: [] }, "mix_mode");
  };

  const pickerValue = (index: number): string => {
    const pick = structure.customRounds[index];
    if (pick === BLEND_ALL) return BLEND_ALL;
    if (pick && styleOrder.includes(pick)) return pick;
    const auto = rotation[index]?.styles ?? [];
    return auto.length === 1 ? auto[0]! : AUTO;
  };

  const chooseCustomRound = (index: number, key: string) => {
    const customRounds = Array.from(
      { length: Math.max(roundsCount, structure.customRounds.length) },
      (_, i) => structure.customRounds[i] ?? null
    );
    customRounds[index] = key || null;
    update({ customRounds }, "custom_round");
  };

  const chooseCalisthenics = (choice: CalisthenicsChoice) => {
    if (choice === "off") {
      setAddCalisthenics(false);
      return;
    }
    setAddCalisthenics(true);
    update({ calisthenics: choice }, "calisthenics");
  };

  const calisthenicsValue: CalisthenicsChoice = calisthenicsOn
    ? structure.calisthenics
    : "off";
  const finisher = finisherSeconds(roundMin);
  const calisthenicsHint =
    calisthenicsValue === "off"
      ? "No bodyweight exercises."
      : calisthenicsValue === "sprinkled"
      ? "Bodyweight exercises turn up among the techniques."
      : calisthenicsValue === "finisher"
      ? finisher
        ? `The last ${finisher} seconds of every round are bodyweight exercises.`
        : "These rounds are too short to split — lengthen them for a finisher."
      : roundsCount >= 2
      ? "The last round is bodyweight exercises only."
      : "Needs at least two rounds; with one, they are mixed in."
  ;

  const sheet = (
    <div className="sc-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="sc-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="round-structure-heading"
      >
        <h3 id="round-structure-heading" className="sc-modal-heading">
          Session Settings
        </h3>
        {callsTechniques && (
          <p className="sc-modal-desc">
            How your rounds are built and called. Leave it alone and every
            round runs the way it always has.
          </p>
        )}

        {callsTechniques && (
          <>
        {styleOrder.length >= 2 && (
          <section className="rs-section">
            <h4 className="rs-label">Styles{proTag}</h4>
            <Segmented
              name="How styles are mixed"
              choices={MIX_CHOICES}
              value={structure.mixMode}
              onChoose={(v) => gated(() => chooseMix(v))()}
            />
            <p className="rs-hint">{MIX_HINTS[structure.mixMode]}</p>

            {structure.mixMode === "by_round" && (
              <div className="rs-custom">
                {Array.from({ length: styleRoundCount }, (_, i) => (
                  <label key={i} className="rs-custom-row">
                    <span>Round {i + 1}</span>
                    <select
                      value={pickerValue(i)}
                      onChange={(e) =>
                        gated(() => chooseCustomRound(i, e.target.value))()
                      }
                    >
                      {styleOrder.map((key) => (
                        <option key={key} value={key}>
                          {labelOf(key)}
                        </option>
                      ))}
                      {/* Only where the rotation itself blends: more styles
                          than rounds leaves the last round sharing. */}
                      {(rotation[i]?.styles.length ?? 0) > 1 && (
                        <option value={AUTO}>Blend the rest</option>
                      )}
                      <option value={BLEND_ALL}>Blend all</option>
                    </select>
                  </label>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="rs-section">
          <h4 className="rs-label">Your session</h4>
          <ol className="rs-plan">
            {plan.map((round, i) => {
              const { title, notes } = describeRound(round, labelOf);
              return (
                <li key={i}>
                  <span className="rs-plan-round">{i + 1}</span>
                  <span className="rs-plan-body">
                    <span className="rs-plan-title">{title}</span>
                    {notes.length > 0 && (
                      <span className="rs-plan-notes">
                        {notes.join(" · ")}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="rs-section">
          <h4 className="rs-label">Pace{proTag}</h4>
          <Segmented
            name="Pace across rounds"
            choices={INTENSITY_CHOICES}
            value={structure.intensity}
            onChoose={(v) =>
              gated(() => update({ intensity: v }, "intensity"))()
            }
          />
          <p className="rs-hint">{INTENSITY_HINTS[structure.intensity]}</p>
        </section>

        <section className="rs-section">
          <h4 className="rs-label">Calisthenics{proTag}</h4>
          <Segmented
            name="Calisthenics"
            choices={CALISTHENICS_CHOICES}
            value={calisthenicsValue}
            onChoose={(v) => gated(() => chooseCalisthenics(v))()}
          />
          <p className="rs-hint">{calisthenicsHint}</p>
        </section>

        <section className="rs-section">
          <h4 className="rs-label">Callouts{proTag}</h4>
          <label className="rs-toggle">
            <input
              type="checkbox"
              checked={isPro && readInOrder}
              onChange={(e) => {
                const checked = e.target.checked;
                gated(() => setReadInOrder(checked))();
              }}
            />
            Read techniques in order
          </label>
          <p className="rs-hint">
            Calls techniques one after another instead of at random.
          </p>
          <label className="rs-toggle rs-toggle--spaced">
            <input
              type="checkbox"
              checked={isPro && southpawMode}
              onChange={(e) => {
                const checked = e.target.checked;
                gated(() => {
                  setSouthpawMode(checked);
                  try {
                    trackEvent(AnalyticsEvents.SettingToggle, {
                      setting_name: "southpaw_mode",
                      setting_value: checked,
                    });
                  } catch { /* analytics must never break the setting it measures */ }
                })();
              }}
            />
            Southpaw mode
          </label>
          <p className="rs-hint">
            Swaps left and right in every callout, for left-handed fighters.
          </p>
          <label className="rs-toggle rs-toggle--spaced">
            <input
              type="checkbox"
              checked={structure.buildUp}
              onChange={(e) => {
                const checked = e.target.checked;
                gated(() => update({ buildUp: checked }, "build_up"))();
              }}
            />
            Round 1 calls single techniques only
          </label>
          <p className="rs-hint">
            {roundsCount >= 2
              ? "A warm-up round. Combinations come in from round 2."
              : "A warm-up round. Needs at least two rounds."}
          </p>
          <div className="rs-sublabel">Between callouts</div>
          <Segmented
            name="Between callouts"
            choices={BETWEEN_CHOICES}
            value={structure.between}
            onChoose={(v) => gated(() => update({ between: v }, "between"))()}
          />
          <p className="rs-hint">{BETWEEN_HINTS[structure.between]}</p>
        </section>
          </>
        )}

        <section className="rs-section">
          <h4 className="rs-label">Voice</h4>
          <VoiceSettings />
        </section>

        <div className="sc-modal-actions">
          {isPro && (
            <button
              type="button"
              className="sc-modal-btn"
              onClick={() => {
                setRoundStructure({ ...DEFAULT_ROUND_STRUCTURE });
              }}
            >
              Reset
            </button>
          )}
          <button
            type="button"
            className="sc-modal-btn sc-modal-btn--primary"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}

function Segmented<T extends string>({
  name,
  choices,
  value,
  onChoose,
}: {
  name: string;
  choices: Choice<T>[];
  value: T;
  onChoose: (value: T) => void;
}) {
  return (
    <div className="rs-segmented" role="group" aria-label={name}>
      {choices.map((choice) => (
        <button
          key={choice.value}
          type="button"
          className={`rs-segment ${value === choice.value ? "is-on" : ""}`}
          aria-pressed={value === choice.value}
          onClick={() => onChoose(choice.value)}
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}
