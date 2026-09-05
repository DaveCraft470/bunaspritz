import { supabase } from '@/lib/supabase';

export type ReportTargetType = 'user' | 'event';
export type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'rejected';

export type Report = {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  description: string;
  createdAt: string;
  status: ReportStatus;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

export const USER_REPORT_REASONS = ['Comportament nepotrivit', 'Hărțuire', 'Spam', 'Profil fals', 'Conținut nepotrivit', 'Alt motiv'] as const;
export const EVENT_REPORT_REASONS = ['Eveniment fals', 'Conținut nepotrivit', 'Fraudă/scam', 'Spam', 'Informații incorecte', 'Alt motiv'] as const;

function fromRow(row: any): Report {
  return {
    id: row.id,
    reporterId: row.reporter_id,
    targetType: row.target_type,
    targetId: row.target_id,
    reason: row.reason,
    description: row.description,
    createdAt: row.created_at,
    status: row.status,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
  };
}

// Every admin-reports.tsx caller reads its own snapshot instead of sharing
// a client-wide store now that reports round-trip through Supabase — the
// old useSyncExternalStore/module-array shape only made sense for a mock
// that lived purely in memory.
export async function getReports(): Promise<Report[]> {
  const { data, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(fromRow);
}

export async function hasActiveReport(reporterId: string, targetType: ReportTargetType, targetId: string): Promise<boolean> {
  const { data } = await supabase
    .from('reports')
    .select('id')
    .eq('reporter_id', reporterId)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .in('status', ['pending', 'reviewing'])
    .limit(1)
    .maybeSingle();
  return !!data;
}

export async function addReport(input: {
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  description: string;
}): Promise<Report | null> {
  if (await hasActiveReport(input.reporterId, input.targetType, input.targetId)) return null;

  const { data, error } = await supabase
    .from('reports')
    .insert({
      reporter_id: input.reporterId,
      target_type: input.targetType,
      target_id: input.targetId,
      reason: input.reason,
      description: input.description,
    })
    .select('*')
    .single();

  if (error || !data) return null;
  return fromRow(data);
}

export async function updateReportStatus(id: string, status: Exclude<ReportStatus, 'pending'>): Promise<boolean> {
  const { error } = await supabase.rpc('admin_resolve_report', { p_report_id: id, p_status: status });
  return !error;
}
