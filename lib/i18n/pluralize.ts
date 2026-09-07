// Romanian plural rule (simplified CLDR): singular for 1, "few" form for 0
// and for n%100 in 1..19, otherwise the "de"-prefixed form (20, 21, 100, ...).
export function pluralRo(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const mod100 = n % 100;
  if (n === 0 || (mod100 >= 1 && mod100 <= 19)) return few;
  return many;
}

export function pluralEn(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}
