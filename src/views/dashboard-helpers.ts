import { setIcon } from 'obsidian';
import type { Status } from '../models/listing';

export const STATUS_LUCIDE_ICON: Record<Status, string> = {
  'Aktiv': 'circle-dot',
  'Verkauft': 'banknote',
  'Verschickt': 'truck',
  'Abgeschlossen': 'circle-check',
  'Abgelaufen': 'clock',
  'Archiviert': 'archive',
};

export function renderStatusBadge(el: HTMLElement, status: Status) {
  const iconSpan = el.createSpan({ cls: 'ka-status-icon' });
  setIcon(iconSpan, STATUS_LUCIDE_ICON[status]);
  el.createSpan({ text: status });
}

export function addSettingRow(container: HTMLElement, label: string, render: (el: HTMLElement) => void) {
  const row = container.createDiv({ cls: 'ka-setting-item' });
  row.createEl('label', { text: label });
  render(row);
}

export function addUsageCard(container: HTMLElement, value: string, label: string) {
  const card = container.createDiv({ cls: 'ka-usage-card' });
  card.createDiv({ cls: 'ka-usage-value', text: value });
  card.createDiv({ cls: 'ka-usage-label', text: label });
}

export function addSectionHeader(container: HTMLElement, title: string, onEdit: () => void) {
  const header = container.createDiv({ cls: 'ka-section-header' });
  header.createEl('h4', { text: title });
  const editBtn = header.createEl('button', { cls: 'ka-section-edit-btn', attr: { 'aria-label': 'Bearbeiten' } });
  setIcon(editBtn, 'pencil');
  editBtn.addEventListener('click', () => onEdit());
}

export function addDetailRow(container: HTMLElement, label: string, value: string) {
  const row = container.createDiv({ cls: 'ka-detail-row' });
  row.createSpan({ cls: 'ka-detail-label', text: label });
  row.createSpan({ cls: 'ka-detail-value', text: value });
}
