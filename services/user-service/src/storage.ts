import { User, WatchlistItem, WatchlistStatus } from '@moviehub/shared';
import { v4 as uuidv4 } from 'uuid';

/**
 * In-memory storage for demo purposes
 * In production, this would be replaced with a database
 */
export class InMemoryStorage {
  private users: Map<string, User> = new Map();
  private watchlist: Map<string, WatchlistItem> = new Map();

  constructor() {
    // Create a default demo user
    const demoUser: User = {
      id: 'demo-user-1',
      username: 'demo',
      email: 'demo@moviehub.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(demoUser.id, demoUser);
  }

  // User operations
  getUser(userId: string): User | undefined {
    return this.users.get(userId);
  }

  getAllUsers(): User[] {
    return Array.from(this.users.values());
  }

  // Watchlist operations
  getUserWatchlist(userId: string): WatchlistItem[] {
    return Array.from(this.watchlist.values())
      .filter(item => item.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  getWatchlistItem(itemId: string): WatchlistItem | undefined {
    return this.watchlist.get(itemId);
  }

  findWatchlistItem(userId: string, movieId: string): WatchlistItem | undefined {
    return Array.from(this.watchlist.values())
      .find(item => item.userId === userId && item.movieId === movieId);
  }

  addWatchlistItem(
    userId: string,
    movieId: string,
    status: WatchlistStatus,
    rating?: number,
    notes?: string
  ): WatchlistItem {
    // Check if already exists
    const existing = this.findWatchlistItem(userId, movieId);
    if (existing) {
      throw new Error('Movie already in watchlist');
    }

    const item: WatchlistItem = {
      id: uuidv4(),
      userId,
      movieId,
      status,
      progress: 0,
      rating,
      notes,
      addedAt: new Date(),
      updatedAt: new Date(),
    };

    this.watchlist.set(item.id, item);
    return item;
  }

  updateWatchlistItem(
    itemId: string,
    updates: {
      status?: WatchlistStatus;
      progress?: number;
      rating?: number;
      notes?: string;
    }
  ): WatchlistItem {
    const item = this.watchlist.get(itemId);
    if (!item) {
      throw new Error('Watchlist item not found');
    }

    const updated: WatchlistItem = {
      ...item,
      ...updates,
      updatedAt: new Date(),
    };

    this.watchlist.set(itemId, updated);
    return updated;
  }

  deleteWatchlistItem(itemId: string): boolean {
    return this.watchlist.delete(itemId);
  }

  getWatchlistByStatus(userId: string, status: WatchlistStatus): WatchlistItem[] {
    return Array.from(this.watchlist.values())
      .filter(item => item.userId === userId && item.status === status)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  getWatchlistStats(userId: string): {
    total: number;
    wantToWatch: number;
    watching: number;
    watched: number;
  } {
    const userItems = this.getUserWatchlist(userId);
    
    return {
      total: userItems.length,
      wantToWatch: userItems.filter(item => item.status === WatchlistStatus.WANT_TO_WATCH).length,
      watching: userItems.filter(item => item.status === WatchlistStatus.WATCHING).length,
      watched: userItems.filter(item => item.status === WatchlistStatus.WATCHED).length,
    };
  }
}

