import type { Listing, Status } from '../models/listing';

export type FilterStatus = 'all' | 'archive' | Status;
export type Tab = 'overview' | 'stats';
export type StatsPeriod = 'monthly' | 'yearly';
export type SortColumn = 'title' | 'price' | 'shipping' | 'listed' | 'status';
export type SortDirection = 'asc' | 'desc';

export interface DashboardCallbacks {
  onSold: (listing: Listing) => void;
  onShip: (listing: Listing) => void;
  onRelist: (listing: Listing) => void;
  onNewItem: () => void;
  onEditListing: (listing: Listing) => void;
}

export interface OverviewState {
  filter: FilterStatus;
  searchQuery: string;
  expandedListing: Listing | null;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  selectedPaths: Set<string>;
}

export interface StatsState {
  statsPeriod: StatsPeriod;
}

export interface DropdownState {
  closeHandler: (() => void) | null;
}

export interface DashboardActions {
  render: () => void;
  refresh: () => void;
  refreshAfterWrite: () => void;
  transitionStatus: (listing: Listing, status: Status) => Promise<void>;
  undoStatus: (listing: Listing, targetStatus: Status) => Promise<void>;
  updateListing: (listing: Listing) => Promise<void>;
  deleteListing: (listing: Listing) => Promise<void>;
}
