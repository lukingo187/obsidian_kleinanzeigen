import { Notice } from 'obsidian';
import { Listing } from '../models/listing';
import { t } from '../i18n';
import { formatCurrency, formatDateDE, formatPortoDisplay, formatError } from '../utils/formatting';
import type { Stats } from './statsService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export class ExportService {
  static generateCSV(listings: Listing[]): string {
    const headers = ['Item', 'Condition', 'Price', 'Price Type', 'Carrier', 'Shipping Service', 'Shipping Cost', 'Listed At', 'Status', 'Sold For', 'Sold At', 'Payment Method'];
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;

    const rows = listings.map(l => [
      l.title,
      l.condition,
      l.price.toString(),
      l.price_type,
      l.carrier ?? '',
      l.shipping_service ?? '',
      l.shipping_cost != null ? l.shipping_cost.toString() : '',
      l.listed_at ?? '',
      l.status,
      l.sold_for?.toString() ?? '',
      l.sold_at ?? '',
      l.payment_method ?? '',
    ].map(esc).join(';'));

    return [headers.map(esc).join(';'), ...rows].join('\n');
  }

  static exportCSV(listings: Listing[]): void {
    try {
      const csv = ExportService.generateCSV(listings);
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kleinanzeigen_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      new Notice(t('notice.export.csv', { count: listings.length }));
    } catch (e) {
      console.error('[Kleinanzeigen] CSV export failed:', e);
      new Notice(t('notice.saveError', { error: formatError(e) }));
    }
  }

  static exportPDF(listings: Listing[], stats?: Stats): void {
    try {
      const doc = new jsPDF();

      doc.setFontSize(16);
      doc.text('Kleinanzeigen Export', 14, 20);
      doc.setFontSize(10);
      doc.text(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`, 14, 28);

      let startY = 35;
      if (stats) {
        doc.text(
          `Artikel: ${listings.length}  |  Umsatz: ${formatCurrency(stats.totalRevenue)}  |  Gewinn: ${formatCurrency(stats.totalProfit)}`,
          14, startY,
        );
        startY += 10;
      }

      autoTable(doc, {
        startY,
        head: [['Item', 'Condition', 'Price', 'Carrier', 'Shipping', 'Listed', 'Status', 'Sold For']],
        body: listings.map(l => [
          l.title,
          l.condition,
          `${formatCurrency(l.price)} ${l.price_type}`,
          l.carrier ?? '\u2014',
          formatPortoDisplay(l.carrier, l.shipping_service, l.shipping_cost),
          l.listed_at ? formatDateDE(l.listed_at) : '',
          l.status,
          l.sold_for != null ? formatCurrency(l.sold_for) : '',
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [100, 100, 100] },
      });

      doc.save(`kleinanzeigen_export_${new Date().toISOString().slice(0, 10)}.pdf`);
      new Notice(t('notice.export.pdf', { count: listings.length }));
    } catch (e) {
      console.error('[Kleinanzeigen] PDF export failed:', e);
      new Notice(t('notice.saveError', { error: formatError(e) }));
    }
  }
}
