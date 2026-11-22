import "./ReelProgress.css";

/**
 * A thin bar for the reel's export: filled to `progress` (0 to 1), or
 * sweeping while there's no figure yet (the clips are still being picked).
 * The wait can run past half a minute; a bar that moves says the app hasn't
 * hung, so nobody force-quits it mid-cut.
 */
export default function ReelProgress({ progress }: { progress: number | null }) {
  const pct = progress === null ? null : Math.round(progress * 100);
  return (
    <span
      className={`reel-progress ${pct === null ? "is-waiting" : ""}`}
      role="progressbar"
      aria-label="Cutting your reel"
      aria-valuemin={0}
      aria-valuemax={100}
      {...(pct === null ? {} : { "aria-valuenow": pct })}
    >
      <span className="reel-progress-fill" style={pct === null ? undefined : { width: `${pct}%` }} />
    </span>
  );
}

/** "42%", or "" before there's a figure. */
export const percentText = (progress: number | null): string =>
  progress === null ? "" : `${Math.round(progress * 100)}%`;
