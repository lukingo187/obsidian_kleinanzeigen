import { Notice } from 'obsidian';
import { Listing } from '../models/listing';
import { formatCurrency, formatDateDE, formatPortoDisplay } from '../utils/formatting';
import type { Stats } from './statsService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export class ExportService {
  static generateCSV(listings: Listing[]): string {
    const headers = ['Artikel', 'Zustand', 'Preis', 'Preisart', 'Carrier', 'Porto', 'Portopreis', 'Eingestellt am', 'Status', 'Verkauft für', 'Verkauft am', 'Bezahlart'];
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;

    const rows = listings.map(l => [
      l.artikel,
      l.zustand,
      l.preis.toString(),
      l.preisart,
      l.carrier ?? '',
      l.porto_name ?? '',
      l.porto_price != null ? l.porto_price.toString() : '',
      l.eingestellt_am ?? '',
      l.status,
      l.verkauft_fuer?.toString() ?? '',
      l.verkauft_am ?? '',
      l.bezahlart ?? '',
    ].map(esc).join(';'));

    return [headers.map(esc).join(';'), ...rows].join('\n');
  }

  static exportCSV(listings: Listing[]): void {
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
    new Notice(`CSV exportiert: ${listings.length} Artikel`);
  }

  static exportPDF(listings: Listing[], stats?: Stats): void {
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
      head: [['Artikel', 'Zustand', 'Preis', 'Carrier', 'Porto', 'Eingestellt', 'Status', 'Verkauft für']],
      body: listings.map(l => [
        l.artikel,
        l.zustand,
        `${formatCurrency(l.preis)} ${l.preisart}`,
        l.carrier ?? '\u2014',
        formatPortoDisplay(l.carrier, l.porto_name, l.porto_price),
        l.eingestellt_am ? formatDateDE(l.eingestellt_am) : '',
        l.status,
        l.verkauft_fuer != null ? formatCurrency(l.verkauft_fuer) : '',
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [100, 100, 100] },
    });

    doc.save(`kleinanzeigen_export_${new Date().toISOString().slice(0, 10)}.pdf`);
    new Notice(`PDF exportiert: ${listings.length} Artikel`);
  }
}
