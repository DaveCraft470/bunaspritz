import { useSyncExternalStore } from 'react';

export type ReportTargetType = 'user' | 'event';
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

let reports: Report[] = [];
const listeners = new Set<() => void>();
let seeded = false;

function notify() {
  listeners.forEach((listener) => listener());
}

export function useReports() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => reports,
    () => reports,
  );
}

export function hasActiveReport(reporterId: string, targetType: ReportTargetType, targetId: string) {
  return reports.some((report) => report.reporterId === reporterId && report.targetType === targetType && report.targetId === targetId && !['resolved', 'dismissed'].includes(report.status));
}

export function addReport(input: Omit<Report, 'id' | 'createdAt' | 'status'>): Report | null {
  if (hasActiveReport(input.reporterId, input.targetType, input.targetId)) return null;
  const report: Report = { ...input, id: `local-report-${Date.now()}-${Math.random().toString(36).slice(2)}`, createdAt: new Date().toISOString(), status: 'new' };
  reports = [report, ...reports];
  notify();
  return report;
}

export function updateReportStatus(id: string, status: ReportStatus) {
  reports = reports.map((report) => (report.id === id ? { ...report, status } : report));
  notify();
}

export function seedDevelopmentReports() {
  if (!__DEV__ || seeded) return;
  seeded = true;
  reports = [
    {
      id: 'dev-report-user',
      reporterId: 'development-reporter',
      reporterLabel: '@tester',
      targetType: 'user',
      targetId: 'development-target-user',
      targetLabel: '@demo-user',
      reason: 'Spam',
      description: 'Raport de test pentru filtrare și detail view.',
      createdAt: new Date().toISOString(),
      status: 'new',
    },
    {
      id: 'dev-report-event',
      reporterId: 'development-reporter',
      reporterLabel: '@tester',
      targetType: 'event',
      targetId: 'development-target-event',
      targetLabel: 'Eveniment demo',
      reason: 'Informații incorecte',
      description: 'Raport de test local; nu există în Supabase.',
      createdAt: new Date().toISOString(),
      status: 'reviewing',
    },
    ...reports,
  ];
  notify();
}
