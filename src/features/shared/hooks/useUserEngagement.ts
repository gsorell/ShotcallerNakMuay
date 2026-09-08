import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "user_engagement_stats";

export function useUserEngagement(
  isEditorRef: React.MutableRefObject<boolean>
) {
  const [sessionStartTime] = useState(Date.now());

  const [userEngagement, setUserEngagement] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return {
          visitCount: parsed.visitCount || 0,
          timeOnSite: 0, // Reset time for new session
          completedWorkouts: parsed.completedWorkouts || 0,
          lastVisit: parsed.lastVisit ? new Date(parsed.lastVisit) : new Date(),
        };
      } catch {
        return {
          visitCount: 0,
          timeOnSite: 0,
          completedWorkouts: 0,
          lastVisit: new Date(),
        };
      }
    }
    return {
      visitCount: 0,
      timeOnSite: 0,
      completedWorkouts: 0,
      lastVisit: new Date(),
    };
  });

  // Track user engagement and update visit count on mount
  useEffect(() => {
    const newEngagement = {
      ...userEngagement,
      visitCount: userEngagement.visitCount + 1,
      lastVisit: new Date(),
    };
    setUserEngagement(newEngagement);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...newEngagement,
        lastVisit: newEngagement.lastVisit.toISOString(),
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track time on site
  useEffect(() => {
    const interval = setInterval(() => {
      // Skip updating while editing techniques to avoid focus drops on mobile
      if (isEditorRef.current) return;
      const timeOnSite = Math.floor((Date.now() - sessionStartTime) / 1000);
      setUserEngagement((prev) => ({ ...prev, timeOnSite }));
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [sessionStartTime, isEditorRef]);

  /**
   * Count a finished workout.
   *
   * `completedWorkouts` is the criterion the install prompt most wants — the
   * product just did its job in front of the user — but nothing ever
   * incremented it, so the counter sat at 0 forever and the prompt fell
   * through to the 120-second `timeOnSite` rule instead. Two minutes into a
   * visit is usually the middle of round one, which is the worst possible
   * moment to put a modal over the callouts.
   */
  const recordCompletedWorkout = useCallback(() => {
    setUserEngagement((prev) => {
      const next = { ...prev, completedWorkouts: prev.completedWorkouts + 1 };
      try {
        const lastVisit =
          next.lastVisit instanceof Date ? next.lastVisit : new Date();
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ ...next, lastVisit: lastVisit.toISOString() })
        );
      } catch {
        /* ignore - a lost count costs at most a delayed prompt */
      }
      return next;
    });
  }, []);

  return { userEngagement, setUserEngagement, recordCompletedWorkout };
}
