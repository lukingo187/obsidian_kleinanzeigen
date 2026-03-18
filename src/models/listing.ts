export type Preisart = 'VB' | 'Festpreis';

export type Zustand = 'Neu mit Etikett' | 'Neu' | 'Sehr Gut' | 'Gut' | 'In Ordnung' | 'Defekt';

export type Status = 'Aktiv' | 'Verkauft' | 'Verschickt' | 'Abgeschlossen' | 'Abgelaufen';

export type PortoOption =
  | 'Großbrief (1,80€)'
  | 'Warensendung (2,70€)'
  | 'Maxibrief (2,90€)'
  | 'Päckchen S (4,19€)'
  | 'Päckchen M (5,19€)'
  | 'Paket 2kg (6,19€)'
  | 'Paket 5kg (7,69€)'
  | 'Paket 10kg (10,49€)'
  | 'Abholung (0,00€)';

export interface Listing {
  // Core
  artikel: string;
  beschreibung?: string;
  zustand: Zustand;
  status: Status;

  // Pricing
  preis: number;
  preisart: Preisart;
  verkauft_fuer?: number;

  // Listing History
  eingestellt_am: string;
  erstmals_eingestellt_am: string;
  eingestellt_count: number;

  // Sale
  verkauft: boolean;
  verkauft_am?: string;

  // Payment
  bezahlt: boolean;
  bezahlt_am?: string;
  bezahlart?: string;

  // Shipping
  porto?: PortoOption;
  anschrift?: string;
  label_erstellt: boolean;
  sendungsnummer?: string;
  verschickt: boolean;
  verschickt_am?: string;

  // Meta
  filePath?: string;
}

export const ZUSTAND_OPTIONS: Zustand[] = [
  'Neu mit Etikett', 'Neu', 'Sehr Gut', 'Gut', 'In Ordnung', 'Defekt'
];

export const STATUS_OPTIONS: Status[] = [
  'Aktiv', 'Verkauft', 'Verschickt', 'Abgeschlossen', 'Abgelaufen'
];

export const PORTO_OPTIONS: PortoOption[] = [
  'Großbrief (1,80€)',
  'Warensendung (2,70€)',
  'Maxibrief (2,90€)',
  'Päckchen S (4,19€)',
  'Päckchen M (5,19€)',
  'Paket 2kg (6,19€)',
  'Paket 5kg (7,69€)',
  'Paket 10kg (10,49€)',
  'Abholung (0,00€)',
];
