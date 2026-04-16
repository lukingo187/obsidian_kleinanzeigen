import { App, TFile, TFolder, normalizePath, parseYaml } from 'obsidian';
import { Listing, isZustand, isPreisart, isStatus, isCarrierName, isBezahlart } from '../models/listing';

export class VaultService {
  private getBaseFolder: () => string;

  constructor(private app: App, getBaseFolder: () => string) {
    this.getBaseFolder = getBaseFolder;
  }

  private async ensureFolder(): Promise<void> {
    const base = this.getBaseFolder();
    const folder = this.app.vault.getAbstractFileByPath(base);
    if (!folder) {
      try {
        await this.app.vault.createFolder(base);
      } catch { /* folder created by concurrent call */ }
    }
  }

  async createListing(listing: Listing): Promise<TFile> {
    await this.ensureFolder();

    const base = this.getBaseFolder();
    const safeName = listing.artikel.replace(/[\\/:*?"<>|]/g, '_');
    let filePath = normalizePath(`${base}/${safeName}.md`);

    let counter = 1;
    while (this.app.vault.getAbstractFileByPath(filePath)) {
      filePath = normalizePath(`${base}/${safeName} ${counter}.md`);
      counter++;
    }

    const content = this.buildFileContent(listing);
    return await this.app.vault.create(filePath, content);
  }

  async updateListing(listing: Listing): Promise<void> {
    if (!listing.filePath) throw new Error('updateListing called without filePath');

    const file = this.app.vault.getAbstractFileByPath(listing.filePath);
    if (!(file instanceof TFile)) throw new Error(`File not found: ${listing.filePath}`);

    const content = this.buildFileContent(listing);
    await this.app.vault.modify(file, content);
  }

  async deleteListing(listing: Listing): Promise<void> {
    if (!listing.filePath) throw new Error('deleteListing called without filePath');

    const file = this.app.vault.getAbstractFileByPath(listing.filePath);
    if (!(file instanceof TFile)) throw new Error(`File not found: ${listing.filePath}`);

    await this.app.vault.trash(file, true);
  }

  async getAllListings(): Promise<Listing[]> {
    const listings: Listing[] = [];

    const baseFolder = this.app.vault.getAbstractFileByPath(this.getBaseFolder());

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
    let fm: Record<string, any> | null | undefined = this.app.metadataCache.getFileCache(file)?.frontmatter;

    // Fallback: if cache isn't ready yet, parse the file content directly
    if (!fm) {
      try {
        const content = await this.app.vault.read(file);
        fm = this.parseFrontmatter(content);
      } catch {
        return null;
      }
    }

    if (!fm) return null;

    return {
      artikel: fm.artikel ?? file.basename,
      beschreibung: fm.beschreibung,
      zustand: isZustand(fm.zustand) ? fm.zustand : 'ok',
      status: isStatus(fm.status) ? fm.status : 'active',
      preis: Number(fm.preis) || 0,
      preisart: isPreisart(fm.preisart) ? fm.preisart : 'negotiable',
      verkauft_fuer: fm.verkauft_fuer,
      eingestellt_am: fm.eingestellt_am ?? '',
      erstmals_eingestellt_am: fm.erstmals_eingestellt_am ?? '',
      eingestellt_count: fm.eingestellt_count ?? 1,
      verkauft: fm.verkauft ?? false,
      verkauft_am: fm.verkauft_am,
      bezahlt: fm.bezahlt ?? false,
      bezahlt_am: fm.bezahlt_am,
      bezahlart: isBezahlart(fm.bezahlart) ? fm.bezahlart : undefined,
      carrier: isCarrierName(fm.carrier) ? fm.carrier : undefined,
      porto_name: fm.porto_name,
      porto_price: fm.porto_price != null ? Number(fm.porto_price) : undefined,
      anschrift: fm.anschrift,
      label_erstellt: fm.label_erstellt ?? false,
      sendungsnummer: fm.sendungsnummer != null ? String(fm.sendungsnummer) : undefined,
      verschickt: fm.verschickt ?? false,
      verschickt_am: fm.verschickt_am,
      filePath: file.path,
    };
  }

  private parseFrontmatter(content: string): Record<string, any> | null {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;

    try {
      return parseYaml(match[1]) ?? null;
    } catch {
      return null;
    }
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

    if (listing.carrier) lines.push(`carrier: "${listing.carrier}"`);
    if (listing.porto_name) lines.push(`porto_name: "${listing.porto_name}"`);
    if (listing.porto_price != null) lines.push(`porto_price: ${listing.porto_price}`);
    if (listing.anschrift) lines.push(`anschrift: "${listing.anschrift.replace(/\n/g, '\\n')}"`);
    lines.push(`label_erstellt: ${listing.label_erstellt}`);
    if (listing.sendungsnummer) lines.push(`sendungsnummer: "${listing.sendungsnummer}"`);
    lines.push(`verschickt: ${listing.verschickt}`);
    if (listing.verschickt_am) lines.push(`verschickt_am: "${listing.verschickt_am}"`);

    if (listing.beschreibung) {
      const indented = listing.beschreibung.split('\n').map(l => `  ${l}`).join('\n');
      lines.push(`beschreibung: |\n${indented}`);
    }

    lines.push('---');
    lines.push('');

    if (listing.beschreibung) {
      lines.push(listing.beschreibung);
    }

    return lines.join('\n');
  }
}
