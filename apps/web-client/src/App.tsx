import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { mcpClient } from './services/mcpClient';
import RadarChart from './components/RadarChart';
import NetworkGraph from './components/NetworkGraph';

interface Movie {
  id: string;
  title: string;
  year?: number;
  genres?: string[];
  plot?: string;
  poster?: string;
  backdrop?: string;
  ratings: Array<{ source: string; value: number; maxValue: number; votes?: number }>;
  sources: string[];
  aggregatedRating?: {
    score: number;
    breakdown: Record<string, number>;
  };
  cast?: string[];
  directors?: string[];
}

interface MovieDetail extends Movie {
  aiSummary?: {
    summary: string;
    highlights: string[];
    similarMovies: string[];
  };
}

interface WatchlistItem {
  id: string;
  movieId: string;
  status: string;
  rating?: number;
  progress?: number;
  notes?: string;
  addedAt: string;
  updatedAt: string;
}

const API_BASE = '/api';
const DEFAULT_USER_ID = 'demo-user-1';

function App() {
  const [query, setQuery] = useState('');
  const [movies, setMovies] = useState<Movie[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [watchlistMovies, setWatchlistMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
    if (saved === 'dark' || saved === 'light') return saved;
    const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  });
  
  const [useMCP, setUseMCP] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<MovieDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'watchlist'>('search');
  const [watchlistFilter, setWatchlistFilter] = useState<string>('all');
  const [sortMode, setSortMode] = useState<string>('relevance');
  const [allMovies, setAllMovies] = useState<Movie[]>([]);
  const [clearingCache, setClearingCache] = useState(false);

  /** 清除搜索缓存 */
  const clearCache = async () => {
    setClearingCache(true);
    try {
      const response = await axios.delete(`${API_BASE}/cache/clear?type=search`);
      if (response.data.success) {
        alert('搜索缓存已清除！');
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
      alert('清除缓存失败，请稍后重试');
    } finally {
      setClearingCache(false);
    }
  };

  /** 客户端排序函数 */
  const sortMovies = (movies: Movie[], mode: string): Movie[] => {
    if (!movies || movies.length === 0) return movies;
    
    const list = [...movies];
    switch (mode) {
      case 'year_desc':
        return list.sort((a, b) => (b.year || 0) - (a.year || 0));
      case 'year_asc':
        return list.sort((a, b) => (a.year || 0) - (b.year || 0));
      case 'title_az':
        return list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      case 'title_za':
        return list.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
      case 'votes_desc': {
        return list.sort((a, b) => {
          const votesA = (a.ratings || []).reduce((sum, r) => sum + (r.votes || 0), 0);
          const votesB = (b.ratings || []).reduce((sum, r) => sum + (r.votes || 0), 0);
          return votesB - votesA;
        });
      }
      case 'votes_asc': {
        return list.sort((a, b) => {
          const votesA = (a.ratings || []).reduce((sum, r) => sum + (r.votes || 0), 0);
          const votesB = (b.ratings || []).reduce((sum, r) => sum + (r.votes || 0), 0);
          return votesA - votesB;
        });
      }
      case 'rating_desc': {
        return list.sort((a, b) => {
          const scoreA = a.aggregatedRating?.score || 0;
          const scoreB = b.aggregatedRating?.score || 0;
          return scoreB - scoreA;
        });
      }
      case 'rating_asc': {
        return list.sort((a, b) => {
          const scoreA = a.aggregatedRating?.score || 0;
          const scoreB = b.aggregatedRating?.score || 0;
          return scoreA - scoreB;
        });
      }
      case 'relevance':
      default:
        return list;
    }
  };

  /** 应用主题到文档 */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  /** 当排序模式或电影列表变化时重新排序 */
  useEffect(() => {
    if (allMovies && allMovies.length > 0) {
      if (sortMode === 'relevance') {
        setMovies([...allMovies]);
      } else {
        const sorted = sortMovies(allMovies, sortMode);
        setMovies(sorted);
      }
      setCurrentPage(1);
    }
  }, [sortMode, allMovies]);

  /** 搜索电影 */
  const searchMovies = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setCurrentPage(1);
    
    try {
      if (useMCP) {
        const response = await mcpClient.executeWorkflow({
          query: query,
          userId: DEFAULT_USER_ID
        });
        
        if (response.success && response.result?.result) {
          const mcpMovies = response.result.result.results.map((movie: any) => {
            let movieId: string;
            if (movie.imdbId) {
              movieId = `omdb-${movie.imdbId}`;
            } else if (movie.tmdbId || movie.id) {
              movieId = `tmdb-${movie.tmdbId || movie.id}`;
            } else if (movie.tvmazeId) {
              movieId = `tvmaze-${movie.tvmazeId}`;
            } else {
              movieId = `mcp-${movie.title}-${movie.year}`;
            }

            return {
              id: movieId,
              title: movie.title,
              year: movie.year,
              genres: movie.genres || [],
              plot: movie.overview || movie.plot || movie.description,
              poster: movie.poster || movie.posterPath || movie.posterURL,
              backdrop: movie.backdrop || movie.backdropPath || movie.backdropURL,
              ratings: movie.ratings || [{
                source: 'TMDB',
                value: movie.rating || movie.voteAverage || 0,
                maxValue: 10,
                votes: movie.voteCount || 0
              }],
              sources: response.result?.result?.sources || ['mcp'],
              aggregatedRating: movie.aggregatedRating || {
                score: movie.rating || movie.voteAverage || 0,
                breakdown: { tmdb: movie.rating || movie.voteAverage || 0 }
              },
              cast: movie.cast || [],
              directors: movie.directors || movie.director ? [movie.director] : [],
              externalIds: {
                tmdb: movie.tmdbId || movie.id,
                imdb: movie.imdbId,
                tvmaze: movie.tvmazeId
              }
            };
          });
          
          setAllMovies(mcpMovies);
        } else {
          setError(response.error || 'MCP search failed');
        }
      } else {
        const response = await axios.get(`${API_BASE}/search`, {
          params: { query, limit: 64 },
        });
        
        if (response.data.success) {
          const fetchedMovies = response.data.data || [];
          setAllMovies(fetchedMovies);
        } else {
          setError('No movies found');
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to search movies');
    } finally {
      setLoading(false);
    }
  };

  /** 处理回车键搜索 */
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchMovies();
    }
  };

  /** 打开电影详情 */
  const openMovieDetail = async (movie: Movie) => {
    setSelectedMovie(movie as MovieDetail);
    setLoadingDetail(true);

    try {
      const response = await axios.get(`${API_BASE}/movie/${movie.id}/summary`);
      if (response.data.success) {
        setSelectedMovie({
          ...response.data.data.movie,
          aiSummary: response.data.data.aiSummary,
        });
      }
    } catch (err) {
      console.error('Failed to load movie details:', err);
      setSelectedMovie(movie as MovieDetail);
    } finally {
      setLoadingDetail(false);
    }
  };

  /** ESC键关闭弹窗 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedMovie(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /** 加载观影清单 */
  const loadWatchlist = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.get(`${API_BASE}/users/${DEFAULT_USER_ID}/watchlist`);
      
      if (response.data.success) {
        const items = response.data.data || [];
        setWatchlist(items);
        
        const moviePromises = items.map((item: WatchlistItem) =>
          axios.get(`${API_BASE}/movie/${item.movieId}`).catch(() => null)
        );
        
        const movieResponses = await Promise.all(moviePromises);
        const moviesData = movieResponses
          .filter(res => res && res.data.success)
          .map(res => res!.data.data);
        
        setWatchlistMovies(moviesData);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load watchlist');
    } finally {
      setLoading(false);
    }
  };

  /** 添加到观影清单 */
  const addToWatchlist = async (movieId: string, status: string) => {
    try {
      await axios.post(`${API_BASE}/users/${DEFAULT_USER_ID}/watchlist`, {
        movieId,
        status,
      });
      alert('Added to watchlist!');
      
      if (activeTab === 'watchlist') {
        loadWatchlist();
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add to watchlist');
    }
  };

  /** 从观影清单移除 */
  const removeFromWatchlist = async (itemId: string) => {
    try {
      await axios.delete(`${API_BASE}/watchlist/item/${itemId}`);
      alert('Removed from watchlist!');
      loadWatchlist();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to remove from watchlist');
    }
  };

  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  /** 更新观影清单项（带防抖） */
  const updateWatchlistItem = useCallback(async (
    itemId: string, 
    updates: { status?: string; progress?: number; rating?: number; notes?: string }
  ) => {
    try {
      if (updates.progress !== undefined) {
        if (updateTimerRef.current) {
          clearTimeout(updateTimerRef.current);
        }
        
        updateTimerRef.current = setTimeout(async () => {
          try {
            await axios.patch(`${API_BASE}/watchlist/item/${itemId}`, updates);
            setWatchlist(prev => prev.map(item => 
              item.id === itemId ? { ...item, ...updates } : item
            ));
          } catch (err: any) {
            console.error('Failed to update progress:', err);
          }
        }, 300);
      } else {
        await axios.patch(`${API_BASE}/watchlist/item/${itemId}`, updates);
        loadWatchlist();
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update watchlist item');
    }
  }, []);

  /** 切换到观影清单时加载数据 */
  useEffect(() => {
    if (activeTab === 'watchlist') {
      loadWatchlist();
    }
  }, [activeTab]);

  return (
    <div className="container">
      <header className="header">
        <div className="theme-toggle">
          <button
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="icon-button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
          >
            {theme === 'dark' ? '🌙' : '☀️'}
          </button>
        </div>
        <h1>🎬 MovieHub</h1>
        <p>Multi-Source Movie Aggregation Platform</p>
      </header>

      <div className="search-section">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            Search Movies
          </button>
          <button
            className={`tab ${activeTab === 'watchlist' ? 'active' : ''}`}
            onClick={() => setActiveTab('watchlist')}
          >
            My Watchlist
          </button>
        </div>

        {activeTab === 'search' && (
          <>
            <div className="search-controls">
              <div className="search-box">
                <input
                  type="text"
                  className="search-input"
                  placeholder={useMCP ? "Ask anything about movies... (e.g., 'Find sci-fi movies from 2020', 'Show me Christopher Nolan films')" : "Search for movies... (e.g., Dune, Inception, The Matrix)"}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                />
                <button
                  className="search-button"
                  onClick={searchMovies}
                  disabled={loading}
                >
                  {loading ? 'Searching...' : 'Search'}
                </button>
              </div>
              
              <div className="search-options">
                <div className="mode-toggle">
                  <div className="segmented" role="tablist" aria-label="Search Mode">
                    <button
                      type="button"
                      className={`segment ${!useMCP ? 'active' : ''}`}
                      onClick={() => setUseMCP(false)}
                      aria-pressed={!useMCP}
                      role="tab"
                      aria-selected={!useMCP}
                      title="关键词搜索"
                    >
                      🔎 关键词搜索
                    </button>
                    <button
                      type="button"
                      className={`segment ${useMCP ? 'active' : ''}`}
                      onClick={() => setUseMCP(true)}
                      aria-pressed={useMCP}
                      role="tab"
                      aria-selected={useMCP}
                      title="AI智能搜索"
                    >
                      🤖 AI智能搜索
                    </button>
                  </div>
                </div>

                <div className="sort-controls">
                  <label className="sort-label">排序方式:</label>
                  <select
                    className="sort-select"
                    aria-label="Sort results"
                    value={sortMode}
                    onChange={(e) => {
                      setSortMode(e.target.value);
                    }}
                    title="排序"
                  >
                    <option value="relevance">按相关度</option>
                    <option value="year_desc">年份(新→旧)</option>
                    <option value="year_asc">年份(旧→新)</option>
                    <option value="title_az">标题(A→Z)</option>
                    <option value="title_za">标题(Z→A)</option>
                    <option value="votes_desc">投票数(高→低)</option>
                    <option value="votes_asc">投票数(低→高)</option>
                  </select>
                  
                  <button
                    className="clear-cache-button"
                    onClick={clearCache}
                    disabled={clearingCache}
                    title="清除搜索缓存"
                  >
                    {clearingCache ? '清除中...' : '🗑️ 清除缓存'}
                  </button>
                </div>
              </div>
            </div>

            {error && <div className="error">{error}</div>}
          </>
        )}

        {activeTab === 'watchlist' && (
          <div className="watchlist-filters">
            <button
              className={`filter-button ${watchlistFilter === 'all' ? 'active' : ''}`}
              onClick={() => setWatchlistFilter('all')}
            >
              📋 全部 ({watchlist.length})
            </button>
            <button
              className={`filter-button ${watchlistFilter === 'want_to_watch' ? 'active' : ''}`}
              onClick={() => setWatchlistFilter('want_to_watch')}
            >
              📌 想看 ({watchlist.filter(item => item.status === 'want_to_watch').length})
            </button>
            <button
              className={`filter-button ${watchlistFilter === 'watching' ? 'active' : ''}`}
              onClick={() => setWatchlistFilter('watching')}
            >
              ▶️ 在看 ({watchlist.filter(item => item.status === 'watching').length})
            </button>
            <button
              className={`filter-button ${watchlistFilter === 'watched' ? 'active' : ''}`}
              onClick={() => setWatchlistFilter('watched')}
            >
              ✅ 看过 ({watchlist.filter(item => item.status === 'watched').length})
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="loading">
          {activeTab === 'search' ? 'Searching across multiple sources...' : 'Loading your watchlist...'}
        </div>
      )}

      {activeTab === 'search' && !loading && movies.length > 0 && (
        <div className="movies-grid">
          {movies
            .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
            .map((movie) => (
            <div
              key={movie.id}
              className="movie-card"
              onClick={() => openMovieDetail(movie)}
            >
              {movie.poster ? (
                <img src={movie.poster} alt={movie.title} className="movie-poster" />
              ) : (
                <div className="movie-poster" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '3rem' }}>
                  🎬
                </div>
              )}
              <div className="movie-info">
                <div className="movie-title">{movie.title}</div>
                <div className="movie-year">{movie.year}</div>
                {movie.aggregatedRating && (
                  <div className="movie-rating">
                    <span className="rating-badge">
                      ⭐ {movie.aggregatedRating.score.toFixed(1)}/10
                    </span>
                  </div>
                )}
                <div className="movie-sources">
                  {movie.sources.map((source) => (
                    <span key={source} className="source-badge">
                      {source.toUpperCase()}
                    </span>
                  ))}
                </div>
                {movie.genres && movie.genres.length > 0 && (
                  <div className="movie-genres">
                    {movie.genres.slice(0, 3).join(', ')}
                  </div>
                )}
                <button
                  className="watchlist-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    addToWatchlist(movie.id, 'want_to_watch');
                  }}
                >
                  + Add to Watchlist
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'search' && !loading && movies.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
          <button
            className="filter-button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            aria-label="Previous page"
            title="上一页"
          >
            ◀
          </button>
          {Array.from({ length: Math.ceil(movies.length / itemsPerPage) }, (_, i) => i + 1).map((pageNum) => (
            <button
              key={pageNum}
              className={`filter-button ${currentPage === pageNum ? 'active' : ''}`}
              onClick={() => setCurrentPage(pageNum)}
              aria-current={currentPage === pageNum ? 'page' : undefined}
            >
              {pageNum}
            </button>
          ))}
          <button
            className="filter-button"
            disabled={currentPage >= Math.ceil(movies.length / itemsPerPage)}
            onClick={() => setCurrentPage(p => Math.min(Math.ceil(movies.length / itemsPerPage), p + 1))}
            aria-label="Next page"
            title="下一页"
          >
            ▶
          </button>
        </div>
      )}

      {activeTab === 'watchlist' && !loading && watchlistMovies.length > 0 && (
        <div className="movies-grid">
          {watchlistMovies
            .filter((movie) => {
              const item = watchlist.find(i => i.movieId === movie.id);
              return watchlistFilter === 'all' || item?.status === watchlistFilter;
            })
            .map((movie) => {
            const watchlistItem = watchlist.find(item => item.movieId === movie.id);
            return (
              <div
                key={movie.id}
                className="movie-card watchlist-card"
              >
                <div onClick={() => openMovieDetail(movie)} style={{ cursor: 'pointer' }}>
                  {movie.poster ? (
                    <img src={movie.poster} alt={movie.title} className="movie-poster" />
                  ) : (
                    <div className="movie-poster" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '3rem' }}>
                      🎬
                    </div>
                  )}
                </div>
                <div className="movie-info">
                  <div className="movie-title">{movie.title}</div>
                  <div className="movie-year">{movie.year}</div>
                  
                  {watchlistItem && (
                    <div style={{ marginTop: '10px', marginBottom: '10px' }}>
                      <select
                        className="status-select"
                        value={watchlistItem.status}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateWatchlistItem(watchlistItem.id, { status: e.target.value });
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="want_to_watch">📌 想看</option>
                        <option value="watching">▶️ 在看</option>
                        <option value="watched">✅ 看过</option>
                      </select>
                    </div>
                  )}

                  {watchlistItem && watchlistItem.status === 'watching' && (
                    <div 
                      className="progress-wrapper"
                      style={{ marginBottom: '10px' }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ 
                        fontSize: '0.8rem', 
                        color: '#666', 
                        marginBottom: '5px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span>观看进度</span>
                        <span style={{ 
                          fontWeight: '600', 
                          color: 'var(--primary-500)',
                          fontSize: '0.9rem'
                        }}>
                          {watchlistItem.progress || 0}%
                        </span>
                      </div>
                      <div 
                        className="progress-container"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={watchlistItem.progress || 0}
                          className="progress-slider"
                          onInput={(e) => {
                            const target = e.target as HTMLInputElement;
                            setWatchlist(prev => prev.map(item => 
                              item.id === watchlistItem.id 
                                ? { ...item, progress: parseInt(target.value) } 
                                : item
                            ));
                            updateWatchlistItem(watchlistItem.id, { 
                              progress: parseInt(target.value) 
                            });
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          title={`拖动调整进度: ${watchlistItem.progress || 0}%`}
                        />
                        <div 
                          className="progress-fill" 
                          style={{ width: `${watchlistItem.progress || 0}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {watchlistItem && watchlistItem.status === 'watched' && (
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '5px' }}>
                        我的评分: {watchlistItem.rating ? `${watchlistItem.rating}/10` : '未评分'}
                      </div>
                      <div className="rating-stars">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                          <span
                            key={star}
                            className={`star ${watchlistItem.rating && star <= watchlistItem.rating ? 'filled' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateWatchlistItem(watchlistItem.id, { rating: star });
                            }}
                          >
                            {watchlistItem.rating && star <= watchlistItem.rating ? '⭐' : '☆'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {watchlistItem && (
                    <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '8px' }}>
                      添加于: {new Date(watchlistItem.addedAt).toLocaleDateString('zh-CN')}
                    </div>
                  )}

                  <button
                    className="watchlist-button"
                    style={{ background: '#f44336' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (watchlistItem && confirm('确定要从观影清单中移除吗？')) {
                        removeFromWatchlist(watchlistItem.id);
                      }
                    }}
                  >
                    🗑️ 移除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && movies.length === 0 && activeTab === 'search' && (
        <div className="empty-state">
          <h2>🔍 Search for Movies</h2>
          <p>Enter a movie title to search across multiple sources</p>
        </div>
      )}

      {!loading && watchlistMovies.length === 0 && activeTab === 'watchlist' && (
        <div className="empty-state">
          <h2>📝 Your Watchlist is Empty</h2>
          <p>Search for movies and add them to your watchlist</p>
        </div>
      )}

      {selectedMovie && (
        <div className="modal-overlay" onClick={() => setSelectedMovie(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedMovie(null)}>
              ×
            </button>
            
            <div className="modal-header">
              {selectedMovie.backdrop ? (
                <img src={selectedMovie.backdrop} alt="" className="modal-backdrop" />
              ) : (
                <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '4rem' }}>
                  🎬
                </div>
              )}
            </div>

            <div className="modal-body">
              <h2 className="modal-title">{selectedMovie.title}</h2>
              <div className="modal-meta">
                {selectedMovie.year} • {selectedMovie.genres?.join(', ')}
              </div>

              {selectedMovie.plot && (
                <div className="modal-section">
                  <h3>Plot</h3>
                  <p>{selectedMovie.plot}</p>
                </div>
              )}

              {selectedMovie.cast && selectedMovie.cast.length > 0 && (
                <div className="modal-section">
                  <h3>Cast</h3>
                  <p>{selectedMovie.cast.slice(0, 5).join(', ')}</p>
                </div>
              )}

              {selectedMovie.directors && selectedMovie.directors.length > 0 && (
                <div className="modal-section">
                  <h3>Directors</h3>
                  <p>{selectedMovie.directors.join(', ')}</p>
                </div>
              )}

              <div className="modal-section">
                <h3>📊 Ratings Comparison</h3>
                
                {/* 数据来源统计 */}
                <div className="source-stats">
                  <div className="source-stat">
                    <div className="source-stat-label">Data Sources</div>
                    <div className="source-stat-value">{selectedMovie.sources.length}</div>
                  </div>
                  {selectedMovie.aggregatedRating && (
                    <div className="source-stat">
                      <div className="source-stat-label">Weighted Score</div>
                      <div className="source-stat-value">
                        {selectedMovie.aggregatedRating.score.toFixed(1)}/10
                      </div>
                    </div>
                  )}
                  <div className="source-stat">
                    <div className="source-stat-label">Total Ratings</div>
                    <div className="source-stat-value">{selectedMovie.ratings.length}</div>
                  </div>
                </div>

                <div className="rating-chart">
                  {selectedMovie.ratings.map((rating) => {
                    const percentage = (rating.value / rating.maxValue) * 100;
                    const normalizedScore = (rating.value / rating.maxValue) * 10;
                    return (
                      <div key={rating.source} className="rating-bar-container">
                        <div className="rating-bar-label">
                          <strong>{rating.source}</strong>
                          <span>{rating.value}/{rating.maxValue}</span>
                        </div>
                        <div className="rating-bar-background">
                          <div 
                            className="rating-bar-fill" 
                            style={{ width: `${percentage}%` }}
                          >
                            {normalizedScore.toFixed(1)}/10
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: '15px' }}>
                  <strong style={{ fontSize: '0.9rem', color: '#666' }}>Sources: </strong>
                  {selectedMovie.sources.map((source) => (
                    <span key={source} className="source-badge" style={{ marginLeft: '5px' }}>
                      {source.toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>

              {loadingDetail && (
                <div className="modal-section">
                  <p>Loading AI-powered insights...</p>
                </div>
              )}

              {!loadingDetail && selectedMovie.ratings && selectedMovie.ratings.length > 0 && (
                <div className="visualization-container">
                  <div className="visualization-section">
                    <h3>📊 评分雷达图</h3>
                    <RadarChart ratings={selectedMovie.ratings} />
                  </div>

                  {selectedMovie.aiSummary?.similarMovies && selectedMovie.aiSummary.similarMovies.length > 0 && (
                    <div className="visualization-section">
                      <h3>🕸️ 相似作品网络</h3>
                      <NetworkGraph 
                        centerMovie={{
                          id: selectedMovie.id,
                          title: selectedMovie.title,
                          year: selectedMovie.year,
                          poster: selectedMovie.poster
                        }}
                        similarMovies={selectedMovie.aiSummary.similarMovies.map((movie, idx) => ({
                          id: `similar-${idx}`,
                          title: movie,
                          similarity: Math.random() * 0.4 + 0.6
                        }))}
                      />
                    </div>
                  )}
                </div>
              )}

              {!loadingDetail && selectedMovie.aiSummary && (
                <>

                  <div className="modal-section">
                    <h3>🤖 AI Summary</h3>
                    <div className="ai-summary">
                      <p>{selectedMovie.aiSummary.summary}</p>
                    </div>
                  </div>

                  {selectedMovie.aiSummary.highlights.length > 0 && (
                    <div className="modal-section">
                      <h3>✨ Highlights</h3>
                      <ul className="highlights-list">
                        {selectedMovie.aiSummary.highlights.map((highlight, idx) => (
                          <li key={idx}>{highlight}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedMovie.aiSummary.similarMovies.length > 0 && (
                    <div className="modal-section">
                      <h3>🎯 Similar Movies</h3>
                      <div className="similar-movies">
                        {selectedMovie.aiSummary.similarMovies.map((movie, idx) => (
                          <span key={idx} className="similar-movie-tag">
                            {movie}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

