import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { Logger, WatchlistStatus, CreateWatchlistItemDto, UpdateWatchlistItemDto } from '@moviehub/shared';
import { InMemoryStorage } from './storage';

// 加载项目根目录的 .env 文件
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const app = express();
const port = process.env.PORT || 3005;
const logger = new Logger('User-Service');

app.use(cors());
app.use(express.json());

const storage = new InMemoryStorage();

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'user-service' });
});

// Get user info
app.get('/api/user/:userId', (req, res) => {
  try {
    const user = storage.getUser(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (error: any) {
    logger.error('Error in /api/user/:userId:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all users (for demo)
app.get('/api/users', (req, res) => {
  try {
    const users = storage.getAllUsers();
    res.json({ success: true, data: users });
  } catch (error: any) {
    logger.error('Error in /api/users:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's watchlist
app.get('/api/watchlist/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const status = req.query.status as WatchlistStatus | undefined;

    let watchlist;
    if (status) {
      watchlist = storage.getWatchlistByStatus(userId, status);
    } else {
      watchlist = storage.getUserWatchlist(userId);
    }

    res.json({ success: true, data: watchlist });
  } catch (error: any) {
    logger.error('Error in /api/watchlist/:userId:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get watchlist stats
app.get('/api/watchlist/:userId/stats', (req, res) => {
  try {
    const stats = storage.getWatchlistStats(req.params.userId);
    res.json({ success: true, data: stats });
  } catch (error: any) {
    logger.error('Error in /api/watchlist/:userId/stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add movie to watchlist
app.post('/api/watchlist/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const dto: CreateWatchlistItemDto = req.body;

    if (!dto.movieId || !dto.status) {
      return res.status(400).json({ error: 'movieId and status are required' });
    }

    const item = storage.addWatchlistItem(
      userId,
      dto.movieId,
      dto.status,
      dto.rating,
      dto.notes
    );

    logger.info(`Added movie ${dto.movieId} to user ${userId}'s watchlist`);

    res.json({ success: true, data: item });
  } catch (error: any) {
    logger.error('Error in POST /api/watchlist/:userId:', error);
    
    if (error.message === 'Movie already in watchlist') {
      res.status(409).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Update watchlist item
app.patch('/api/watchlist/item/:itemId', (req, res) => {
  try {
    const { itemId } = req.params;
    const updates: UpdateWatchlistItemDto = req.body;

    const item = storage.updateWatchlistItem(itemId, updates);

    logger.info(`Updated watchlist item ${itemId}`);

    res.json({ success: true, data: item });
  } catch (error: any) {
    logger.error('Error in PATCH /api/watchlist/item/:itemId:', error);
    
    if (error.message === 'Watchlist item not found') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Delete watchlist item
app.delete('/api/watchlist/item/:itemId', (req, res) => {
  try {
    const { itemId } = req.params;
    const deleted = storage.deleteWatchlistItem(itemId);

    if (!deleted) {
      return res.status(404).json({ error: 'Watchlist item not found' });
    }

    logger.info(`Deleted watchlist item ${itemId}`);

    res.json({ success: true, message: 'Item deleted' });
  } catch (error: any) {
    logger.error('Error in DELETE /api/watchlist/item/:itemId:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get specific watchlist item
app.get('/api/watchlist/item/:itemId', (req, res) => {
  try {
    const item = storage.getWatchlistItem(req.params.itemId);
    
    if (!item) {
      return res.status(404).json({ error: 'Watchlist item not found' });
    }

    res.json({ success: true, data: item });
  } catch (error: any) {
    logger.error('Error in /api/watchlist/item/:itemId:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  logger.info(`User Service listening on port ${port}`);
});

