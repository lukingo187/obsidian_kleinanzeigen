import { App, Modal, Setting } from 'obsidian';
import { t } from '../i18n';

export class ConfirmModal extends Modal {
  private message: string;
  private onConfirm: () => void;

  constructor(app: App, message: string, onConfirm: () => void) {
    super(app);
    this.message = message;
    this.onConfirm = onConfirm;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('ka-modal');

    contentEl.createEl('h2', { text: t('modal.confirm.title') });
    contentEl.createEl('p', { text: this.message });

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText(t('common.delete'))
        .setWarning()
        .onClick(() => {
          this.onConfirm();
          this.close();
        }))
      .addButton(btn => btn
        .setButtonText(t('common.cancel'))
        .onClick(() => this.close()));
  }

  onClose() {
    this.contentEl.empty();
  }
}
