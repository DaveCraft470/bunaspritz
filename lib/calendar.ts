export type CalendarDay = {
  date: Date;
  key: string;
  inCurrentMonth: boolean;
};

export function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addMonths(date: Date, amount: number) {
  const result = new Date(date);
  const originalDay = result.getDate();
  const targetYear = result.getFullYear();
  const targetMonth = result.getMonth() + amount;
  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  result.setDate(Math.min(originalDay, daysInTargetMonth));
  result.setMonth(targetMonth);
  return result;
}

export function isSameDay(left: Date, right: Date) {
  return dateKey(left) === dateKey(right);
}

export function isDateBetween(date: Date, minimum: Date, maximum: Date) {
  const value = startOfDay(date).getTime();
  return value >= startOfDay(minimum).getTime() && value <= startOfDay(maximum).getTime();
}

export function getMonthGrid(month: Date): CalendarDay[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const firstWeekday = (first.getDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - firstWeekday);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return {
      date,
      key: dateKey(date),
      inCurrentMonth: date.getMonth() === month.getMonth(),
    };
  });
}

export function formatMonth(month: Date) {
  return month.toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' });
}
