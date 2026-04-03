import { App, Modal } from 'obsidian';
import { Listing } from '../models/listing';

export class PostCreationModal extends Modal {
  private listing: Listing;
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(app: App, listing: Listing) {
    super(app);
    this.listing = listing;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('ka-modal');

    contentEl.createEl('h2', { text: 'Artikel gespeichert!' });
    contentEl.createEl('p', {
      text: 'Kopiere Titel und Beschreibung, um das Inserat auf Kleinanzeigen einzustellen.',
      cls: 'ka-ai-hint',
    });

    this.renderCopyRow(contentEl, 'Titel', this.listing.artikel);

    if (this.listing.beschreibung) {
      this.renderCopyRow(contentEl, 'Beschreibung', this.listing.beschreibung);
    }

    const closeBtn = contentEl.createEl('button', { text: 'Schließen', cls: 'ka-close-btn' });
    closeBtn.addEventListener('click', () => this.close());
  }

  private renderCopyRow(container: HTMLElement, label: string, value: string) {
    const row = container.createDiv({ cls: 'ka-copy-row' });
    row.createEl('span', { text: label, cls: 'ka-copy-label' });
    const preview = row.createEl('span', { text: value, cls: 'ka-copy-preview' });
    const btn = row.createEl('button', { text: 'Kopieren', cls: 'ka-copy-btn' });

    btn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(value);
      btn.textContent = '✓ Kopiert!';
      preview.addClass('ka-copy-preview-flash');
      const t = setTimeout(() => {
        btn.textContent = 'Kopieren';
        preview.removeClass('ka-copy-preview-flash');
      }, 2000);
      this.timers.push(t);
    });
  }

  onClose() {
    this.timers.forEach(clearTimeout);
    this.contentEl.empty();
  }
}
