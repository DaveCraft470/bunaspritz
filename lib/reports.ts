import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { freshChannel } from '@/lib/realtime';

export type ReportTargetType = 'user' | 'event' | 'event_photo';
export type ReportStatus = 'new' | 'reviewing' | 'resolved' | 'dismissed';

export type Report = {
  id: string;
  reporterId: string;
  reporterLabel: string;
  targetType: ReportTargetType;
  targetId: string;
  targetLabel: string;
  reason: string;
  description: string;
  createdAt: string;
  status: ReportStatus;
};

export const USER_REPORT_REASONS = ['Comportament nepotrivit', 'Hărțuire', 'Spam', 'Profil fals', 'Conținut nepotrivit', 'Alt motiv'] as const;
export const EVENT_REPORT_REASONS = ['Eveniment fals', 'Conținut nepotrivit', 'Fraudă/scam', 'Spam', 'Informații incorecte', 'Alt motiv'] as const;
export const EVENT_PHOTO_REPORT_REASONS = ['Conținut nepotrivit', 'Nu are legătură cu evenimentul', 'Hărțuire', 'Spam', 'Alt motiv'] as const;

const REPORT_COLUMNS = 'id, reporter_id, reporter_label, target_type, target_id, target_label, reason, description, status, created_at';

function mapReport(row: any): Report {
  return {
    id: row.id,
    reporterId: row.reporter_id,
    reporterLabel: row.reporter_label,
    targetType: row.target_type,
    targetId: row.target_id,
    targetLabel: row.target_label,
    reason: row.reason,
    description: row.description,
    createdAt: row.created_at,
    status: row.status,
  };
}

// The "resolved"/"dismissed" reports are excluded, matching the old mock's
// hasActiveReport — a report closed out shouldn't block re-reporting.
export async function hasActiveReport(reporterId: string, targetType: ReportTargetType, targetId: string): Promise<boolean> {
  const { data } = await supabase
    .from('reports')
    .select('id')
    .eq('reporter_id', reporterId)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .not('status', 'in', '(resolved,dismissed)')
    .limit(1);
  return !!data?.length;
}

export async function addReport(input: Omit<Report, 'id' | 'createdAt' | 'status'>): Promise<Report | null> {
  if (await hasActiveReport(input.reporterId, input.targetType, input.targetId)) return null;
  const { data, error } = await supabase
    .from('reports')
    .insert({
      reporter_id: input.reporterId,
      reporter_label: input.reporterLabel,
      target_type: input.targetType,
      target_id: input.targetId,
      target_label: input.targetLabel,
      reason: input.reason,
      description: input.description,
    })
    .select(REPORT_COLUMNS)
    .single();
  if (error || !data) return null;
  return mapReport(data);
}

export async function updateReportStatus(id: string, status: ReportStatus): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('reports')
    .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: userData.user?.id ?? null })
    .eq('id', id);
  return !error;
}

// Admin-only list, live-updating via realtime — the "see your own reports,
// admins see all" RLS policy already restricts rows to admins (or the
// caller's own submissions), so this returns an empty list for anyone else.
export function useReports(): Report[] {
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase.from('reports').select(REPORT_COLUMNS).order('created_at', { ascending: false });
      if (!cancelled) setReports((data ?? []).map(mapReport));
    }
    load();

    const channel = freshChannel('reports-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => load())
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return reports;
}
