export function formatDate(date: Date): string {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${y}-${m}-${d}`;
}

export function formatDateDE(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

export function formatCurrency(amount: number): string {
  const n = Number(amount) || 0;
  return `${n.toFixed(2).replace('.', ',')}€`;
}

export function todayString(): string {
  return formatDate(new Date());
}

export function formatError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function formatPortoDisplay(
  carrier?: string,
  portoName?: string,
  portoPrice?: number,
): string {
  if (!carrier) return '—';
  if (carrier === 'Pickup') return 'Pickup';
  const name = portoName || carrier;
  return `${name} (${formatCurrency(portoPrice ?? 0)})`;
}
