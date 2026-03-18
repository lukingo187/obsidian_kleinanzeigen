import { App, TFile, TFolder, normalizePath } from 'obsidian';
import { Listing } from '../models/listing';

const BASE_FOLDER = 'kleinanzeigen';

export class VaultService {
  constructor(private app: App) {}

  private async ensureFolder(): Promise<void> {
    const folder = this.app.vault.getAbstractFileByPath(BASE_FOLDER);
    if (!folder) {
      await this.app.vault.createFolder(BASE_FOLDER);
    }
  }

  async createListing(listing: Listing): Promise<TFile> {
    await this.ensureFolder();

    const filePath = normalizePath(`${BASE_FOLDER}/${listing.artikel}.md`);
    const content = this.buildFileContent(listing);
    return await this.app.vault.create(filePath, content);
  }

  async updateListing(listing: Listing): Promise<void> {
    if (!listing.filePath) return;

    const file = this.app.vault.getAbstractFileByPath(listing.filePath);
    if (!(file instanceof TFile)) return;

    const content = this.buildFileContent(listing);
    await this.app.vault.modify(file, content);
  }

  async getAllListings(): Promise<Listing[]> {
    const listings: Listing[] = [];

    let baseFolder = this.app.vault.getAbstractFileByPath(BASE_FOLDER);
    if (!(baseFolder instanceof TFolder)) {
      baseFolder = this.app.vault.getAbstractFileByPath('Kleinanzeigen');
    }

    if (!(baseFolder instanceof TFolder)) return listings;

    const files = this.getAllFiles(baseFolder);

    for (const file of files) {
      const listing = await this.parseListing(file);
      if (listing) listings.push(listing);
    }

    return listings;
  }

  private getAllFiles(folder: TFolder): TFile[] {
    const files: TFile[] = [];
    for (const child of folder.children) {
      if (child instanceof TFile && child.extension === 'md') {
        files.push(child);
      } else if (child instanceof TFolder) {
        files.push(...this.getAllFiles(child));
      }
    }
    return files;
  }

  private async parseListing(file: TFile): Promise<Listing | null> {
    let fm = this.app.metadataCache.getFileCache(file)?.frontmatter;

    // Fallback: if cache isn't ready yet, parse the file content directly
    if (!fm) {
      const content = await this.app.vault.read(file);
      fm = this.parseFrontmatter(content);
    }

    if (!fm) return null;

    return {
      artikel: fm.artikel ?? file.basename,
      beschreibung: fm.beschreibung,
      zustand: fm.zustand ?? 'Gut',
      status: fm.status ?? 'Aktiv',
      preis: Number(fm.preis) || 0,
      preisart: fm.preisart ?? 'VB',
      verkauft_fuer: fm.verkauft_fuer,
      eingestellt_am: fm.eingestellt_am ?? '',
      erstmals_eingestellt_am: fm.erstmals_eingestellt_am ?? '',
      eingestellt_count: fm.eingestellt_count ?? 1,
      verkauft: fm.verkauft ?? false,
      verkauft_am: fm.verkauft_am,
      bezahlt: fm.bezahlt ?? false,
      bezahlt_am: fm.bezahlt_am,
      bezahlart: fm.bezahlart,
      porto: fm.porto,
      anschrift: fm.anschrift,
      label_erstellt: fm.label_erstellt ?? false,
      sendungsnummer: fm.sendungsnummer,
      verschickt: fm.verschickt ?? false,
      verschickt_am: fm.verschickt_am,
      filePath: file.path,
    };
  }

  private parseFrontmatter(content: string): Record<string, any> | null {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;

    const fm: Record<string, any> = {};
    for (const line of match[1].split('\n')) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      let value: any = line.slice(idx + 1).trim();

      // Remove surrounding quotes
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      // Parse booleans and numbers
      else if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (!isNaN(Number(value)) && value !== '') value = Number(value);

      fm[key] = value;
    }
    return fm;
  }

  private buildFileContent(listing: Listing): string {
    const lines: string[] = ['---'];

    lines.push(`artikel: "${listing.artikel}"`);
    lines.push(`zustand: "${listing.zustand}"`);
    lines.push(`status: "${listing.status}"`);
    lines.push(`preis: ${listing.preis}`);
    lines.push(`preisart: "${listing.preisart}"`);

    if (listing.verkauft_fuer != null) lines.push(`verkauft_fuer: ${listing.verkauft_fuer}`);

    lines.push(`eingestellt_am: "${listing.eingestellt_am}"`);
    lines.push(`erstmals_eingestellt_am: "${listing.erstmals_eingestellt_am}"`);
    lines.push(`eingestellt_count: ${listing.eingestellt_count}`);

    lines.push(`verkauft: ${listing.verkauft}`);
    if (listing.verkauft_am) lines.push(`verkauft_am: "${listing.verkauft_am}"`);

    lines.push(`bezahlt: ${listing.bezahlt}`);
    if (listing.bezahlt_am) lines.push(`bezahlt_am: "${listing.bezahlt_am}"`);
    if (listing.bezahlart) lines.push(`bezahlart: "${listing.bezahlart}"`);

    if (listing.porto) lines.push(`porto: "${listing.porto}"`);
    if (listing.anschrift) lines.push(`anschrift: "${listing.anschrift}"`);
    lines.push(`label_erstellt: ${listing.label_erstellt}`);
    if (listing.sendungsnummer) lines.push(`sendungsnummer: "${listing.sendungsnummer}"`);
    lines.push(`verschickt: ${listing.verschickt}`);
    if (listing.verschickt_am) lines.push(`verschickt_am: "${listing.verschickt_am}"`);

    lines.push('---');
    lines.push('');

    if (listing.beschreibung) {
      lines.push(listing.beschreibung);
    }

    return lines.join('\n');
  }
}
