import { useEffect, useState } from "react";

export function useUserEngagement(
  isEditorRef: React.MutableRefObject<boolean>
) {
  const [sessionStartTime] = useState(Date.now());

  const [userEngagement, setUserEngagement] = useState(() => {
    const stored = localStorage.getItem("user_engagement_stats");
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
      "user_engagement_stats",
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

  return { userEngagement, setUserEngagement };
}
