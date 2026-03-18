export function formatDate(date: Date): string {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${y}-${m}-${d}`;
}

export function formatDateDE(dateStr: string): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr ?? '';
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

export function formatCurrency(amount: number): string {
  const n = Number(amount) || 0;
  return `${n.toFixed(2).replace('.', ',')}€`;
}

export function todayString(): string {
  return formatDate(new Date());
}

export function parsePortoPrice(porto: string): number {
  const match = porto.match(/\((\d+,\d+)€\)/);
  if (!match) return 0;
  return parseFloat(match[1].replace(',', '.'));
}
