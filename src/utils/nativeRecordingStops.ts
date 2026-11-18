/**
 * How many times the native sound recording (iOS, RecordingAudioPlugin) has
 * been stopped this launch. Each stop switches the app's audio session from
 * recording back to playback, and a Web Audio context built before that
 * switch keeps reporting "running" while playing nothing: the bell was
 * silent from the second filmed session after a launch on (TestFlight build
 * 107). The sound effects rebuild their context when this has moved on.
 */
let stops = 0;

export const noteNativeRecordingStopped = (): void => {
  stops += 1;
};

export const nativeRecordingStops = (): number => stops;
