export interface User {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WatchlistItem {
  id: string;
  userId: string;
  movieId: string;
  status: WatchlistStatus;
  progress?: number;
  rating?: number;
  notes?: string;
  addedAt: Date;
  updatedAt: Date;
}

export enum WatchlistStatus {
  WANT_TO_WATCH = 'want_to_watch',
  WATCHING = 'watching',
  WATCHED = 'watched'
}

export interface CreateWatchlistItemDto {
  movieId: string;
  status: WatchlistStatus;
  rating?: number;
  notes?: string;
}

export interface UpdateWatchlistItemDto {
  status?: WatchlistStatus;
  progress?: number;
  rating?: number;
  notes?: string;
}

