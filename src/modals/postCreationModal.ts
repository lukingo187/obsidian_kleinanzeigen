import { App, Modal } from 'obsidian';
import { Listing } from '../models/listing';
import { t } from '../i18n';

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

    contentEl.createEl('h2', { text: t('modal.postCreate.title') });
    contentEl.createEl('p', {
      text: t('modal.postCreate.hint'),
      cls: 'ka-ai-hint',
    });

    this.renderCopyRow(contentEl, t('modal.postCreate.label.title'), this.listing.title);

    if (this.listing.description) {
      this.renderCopyRow(contentEl, t('modal.postCreate.label.desc'), this.listing.description);
    }

    const closeBtn = contentEl.createEl('button', { text: t('common.close'), cls: 'ka-close-btn' });
    closeBtn.addEventListener('click', () => this.close());
  }

  private renderCopyRow(container: HTMLElement, label: string, value: string) {
    const row = container.createDiv({ cls: 'ka-copy-row' });
    row.createEl('span', { text: label, cls: 'ka-copy-label' });
    const preview = row.createEl('span', { text: value, cls: 'ka-copy-preview' });
    const btn = row.createEl('button', { text: t('modal.postCreate.copy'), cls: 'ka-copy-btn' });

    btn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(value);
      btn.textContent = t('modal.postCreate.copied');
      preview.addClass('ka-copy-preview-flash');
      const timer = setTimeout(() => {
        btn.textContent = t('modal.postCreate.copy');
        preview.removeClass('ka-copy-preview-flash');
      }, 2000);
      this.timers.push(timer);
    });
  }

  onClose() {
    this.timers.forEach(clearTimeout);
    this.contentEl.empty();
  }
}
