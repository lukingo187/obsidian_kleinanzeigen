import { App, TFile, TFolder, normalizePath, parseYaml } from 'obsidian';
import { Listing, isCondition, isPriceType, isStatus, isPaymentMethod, isCarrierName } from '../models/listing';

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
    const safeName = listing.title.replace(/[\\/:*?"<>|]/g, '_');
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
      title:            fm.title ?? file.basename,
      description:      fm.description,
      condition:        isCondition(fm.condition) ? fm.condition : 'ok',
      status:           isStatus(fm.status) ? fm.status : 'active',
      price:            Number(fm.price) || 0,
      price_type:       isPriceType(fm.price_type) ? fm.price_type : 'negotiable',
      sold_for:         fm.sold_for,
      listed_at:        fm.listed_at ?? '',
      first_listed_at:  fm.first_listed_at ?? '',
      listing_count:    fm.listing_count ?? 1,
      sold:             fm.sold ?? false,
      sold_at:          fm.sold_at,
      paid:             fm.paid ?? false,
      paid_at:          fm.paid_at,
      payment_method:   isPaymentMethod(fm.payment_method) ? fm.payment_method : undefined,
      carrier:          isCarrierName(fm.carrier) ? fm.carrier : undefined,
      shipping_service: fm.shipping_service,
      shipping_cost:    fm.shipping_cost != null ? Number(fm.shipping_cost) : undefined,
      shipping_address: fm.shipping_address,
      label_printed:    fm.label_printed ?? false,
      tracking_number:  fm.tracking_number != null ? String(fm.tracking_number) : undefined,
      shipped:          fm.shipped ?? false,
      shipped_at:       fm.shipped_at,
      filePath:         file.path,
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

    lines.push(`title: "${listing.title}"`);
    lines.push(`condition: "${listing.condition}"`);
    lines.push(`status: "${listing.status}"`);
    lines.push(`price: ${listing.price}`);
    lines.push(`price_type: "${listing.price_type}"`);

    if (listing.sold_for != null) lines.push(`sold_for: ${listing.sold_for}`);

    lines.push(`listed_at: "${listing.listed_at}"`);
    lines.push(`first_listed_at: "${listing.first_listed_at}"`);
    lines.push(`listing_count: ${listing.listing_count}`);

    lines.push(`sold: ${listing.sold}`);
    if (listing.sold_at) lines.push(`sold_at: "${listing.sold_at}"`);

    lines.push(`paid: ${listing.paid}`);
    if (listing.paid_at) lines.push(`paid_at: "${listing.paid_at}"`);
    if (listing.payment_method) lines.push(`payment_method: "${listing.payment_method}"`);

    if (listing.carrier) lines.push(`carrier: "${listing.carrier}"`);
    if (listing.shipping_service) lines.push(`shipping_service: "${listing.shipping_service}"`);
    if (listing.shipping_cost != null) lines.push(`shipping_cost: ${listing.shipping_cost}`);
    if (listing.shipping_address) lines.push(`shipping_address: "${listing.shipping_address.replace(/\n/g, '\\n')}"`);
    lines.push(`label_printed: ${listing.label_printed}`);
    if (listing.tracking_number) lines.push(`tracking_number: "${listing.tracking_number}"`);
    lines.push(`shipped: ${listing.shipped}`);
    if (listing.shipped_at) lines.push(`shipped_at: "${listing.shipped_at}"`);

    if (listing.description) {
      const indented = listing.description.split('\n').map(l => `  ${l}`).join('\n');
      lines.push(`description: |\n${indented}`);
    }

    lines.push('---');
    lines.push('');

    if (listing.description) {
      lines.push(listing.description);
    }

    return lines.join('\n');
  }
}
