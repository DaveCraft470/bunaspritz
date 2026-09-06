export type PartyMeterLevel = 'quiet' | 'warming' | 'popular' | 'almost_full' | 'full';

export type PartyMeterData = {
  level: PartyMeterLevel;
  label: string;
  percentage: number;
  attendeeCount: number;
  maxParticipants: number;
};

export function getPartyMeter(
  attendeeCount: number | null | undefined,
  maxParticipants: number | null | undefined,
): PartyMeterData | null {
  if (!Number.isFinite(maxParticipants) || (maxParticipants ?? 0) <= 0) return null;

  const safeAttendeeCount = Math.max(0, Number.isFinite(attendeeCount) ? attendeeCount ?? 0 : 0);
  const safeMaxParticipants = maxParticipants as number;
  const percentage = Math.min(100, Math.max(0, Math.round((safeAttendeeCount / safeMaxParticipants) * 100)));

  if (percentage >= 100) {
    return { level: 'full', label: '🔴 Complet', percentage, attendeeCount: safeAttendeeCount, maxParticipants: safeMaxParticipants };
  }
  if (percentage >= 75) {
    return { level: 'almost_full', label: '🔥 Se umple', percentage, attendeeCount: safeAttendeeCount, maxParticipants: safeMaxParticipants };
  }
  if (percentage >= 50) {
    return { level: 'popular', label: '🔥 Devine popular', percentage, attendeeCount: safeAttendeeCount, maxParticipants: safeMaxParticipants };
  }
  if (percentage >= 25) {
    return { level: 'warming', label: 'Se adună lumea', percentage, attendeeCount: safeAttendeeCount, maxParticipants: safeMaxParticipants };
  }
  return { level: 'quiet', label: 'Locuri disponibile', percentage, attendeeCount: safeAttendeeCount, maxParticipants: safeMaxParticipants };
}
