export function formatEventStart(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  const now = new Date();
  const dayPart =
    date.toDateString() === now.toDateString()
      ? 'Azi'
      : date.toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' });
  const timePart = date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  return `${dayPart} · ${timePart}`;
}

export function formatPrice(value: number | null) {
  if (value === null) return null;
  if (value === 0) return 'Gratis';
  return `${value} RON`;
}
