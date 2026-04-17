import { C } from '@/constants/theme';

export type TopicStatus = 'ahead' | 'on-track' | 'behind';

export interface StatusResult {
  status: TopicStatus;
  color: string;
  label: string;
}

/**
 * SINGLE SOURCE OF TRUTH for topic/exam pace status calculations.
 * Used in Planner (index.tsx) for pace badge and History (log.tsx) for topic mastery cards.
 *
 * @param masteryPct  - Current mastery percentage (0–100)
 * @param daysLeft    - Days remaining until exam (optional, for time-aware calculation)
 * @param studyWindow - Total expected study period in days (default 180)
 */
export function getTopicStatus(
  masteryPct: number,
  daysLeft?: number,
  studyWindow: number = 180,
): StatusResult {
  // If we have time-aware data, use pace-based calculation
  if (daysLeft !== undefined && daysLeft > 0) {
    const daysStudied = Math.max(1, studyWindow - daysLeft);
    const expectedPct = Math.min(100, Math.round((daysStudied / studyWindow) * 100));
    const delta = masteryPct - expectedPct;

    if (delta >= 5) return { status: 'ahead', color: C.success, label: 'ahead' };
    if (delta <= -5) return { status: 'behind', color: C.accentRed, label: 'behind' };
    return { status: 'on-track', color: C.accentCyan, label: 'on track' };
  }

  // Cold-start fallback: no exam date context
  if (masteryPct >= 75) return { status: 'ahead', color: C.success, label: 'ahead' };
  if (masteryPct >= 50) return { status: 'on-track', color: C.accentCyan, label: 'on track' };
  return { status: 'behind', color: C.accentRed, label: 'behind' };
}
