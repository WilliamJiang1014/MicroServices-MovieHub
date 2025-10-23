import { Logger, Movie, Rating } from '@moviehub/shared';

export class MovieAggregator {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('MovieAggregator');
  }

  /**
   * Merge multiple movie records into a single comprehensive record
   */
  mergeMovies(movies: Movie[]): Movie {
    if (movies.length === 0) {
      throw new Error('No movies to merge');
    }

    if (movies.length === 1) {
      return movies[0];
    }

    this.logger.info(`Merging ${movies.length} movie records`);

    // Start with the first movie as base
    const merged: Movie = { ...movies[0] };
    
    // Collect all ratings
    const allRatings: Rating[] = [];
    const allSources: Set<string> = new Set(movies[0].sources);

    // Merge fields from all movies
    for (const movie of movies) {
      // Collect ratings
      allRatings.push(...movie.ratings);
      
      // Collect sources
      movie.sources?.forEach(source => allSources.add(source));

      // Merge external IDs
      merged.externalIds = {
        ...merged.externalIds,
        ...movie.externalIds,
      };

      // Prefer non-empty values
      if (!merged.plot && movie.plot) merged.plot = movie.plot;
      if (!merged.poster && movie.poster) merged.poster = movie.poster;
      if (!merged.backdrop && movie.backdrop) merged.backdrop = movie.backdrop;
      if (!merged.runtime && movie.runtime) merged.runtime = movie.runtime;
      if (!merged.releaseDate && movie.releaseDate) merged.releaseDate = movie.releaseDate;

      // Merge arrays (deduplicate)
      if (movie.genres) {
        merged.genres = [...new Set([...(merged.genres || []), ...movie.genres])];
      }
      if (movie.directors) {
        merged.directors = [...new Set([...(merged.directors || []), ...movie.directors])];
      }
      if (movie.cast) {
        merged.cast = [...new Set([...(merged.cast || []), ...movie.cast])];
      }
    }

    // Deduplicate ratings by source
    const ratingMap = new Map<string, Rating>();
    for (const rating of allRatings) {
      const existing = ratingMap.get(rating.source);
      if (!existing || (rating.votes && (!existing.votes || rating.votes > existing.votes))) {
        ratingMap.set(rating.source, rating);
      }
    }

    merged.ratings = Array.from(ratingMap.values());
    merged.sources = Array.from(allSources);

    this.logger.info(`Merged movie: ${merged.title} from ${merged.sources.length} sources`);
    
    return merged;
  }

  /**
   * Calculate a weighted average rating across different sources
   */
  calculateWeightedRating(movie: Movie): { score: number; breakdown: Record<string, number> } {
    const weights: Record<string, number> = {
      imdb: 0.4,
      tmdb: 0.3,
      rotten_tomatoes: 0.2,
      metacritic: 0.1,
    };

    let totalWeight = 0;
    let weightedSum = 0;
    const breakdown: Record<string, number> = {};

    for (const rating of movie.ratings) {
      const weight = weights[rating.source] || 0.1;
      
      // Normalize to 0-10 scale
      const normalizedValue = (rating.value / rating.maxValue) * 10;
      
      weightedSum += normalizedValue * weight;
      totalWeight += weight;
      breakdown[rating.source] = normalizedValue;
    }

    const score = totalWeight > 0 ? weightedSum / totalWeight : 0;

    return {
      score: Math.round(score * 10) / 10,
      breakdown,
    };
  }

  /**
   * Deduplicate movies based on title and year
   */
  deduplicateMovies(movies: Movie[]): Movie[] {
    const uniqueMovies = new Map<string, Movie[]>();

    // Group movies by title + year
    for (const movie of movies) {
      const key = `${movie.title.toLowerCase()}-${movie.year || 'unknown'}`;
      if (!uniqueMovies.has(key)) {
        uniqueMovies.set(key, []);
      }
      uniqueMovies.get(key)!.push(movie);
    }

    // Merge grouped movies
    const result: Movie[] = [];
    for (const [key, group] of uniqueMovies.entries()) {
      try {
        const merged = this.mergeMovies(group);
        result.push(merged);
      } catch (error) {
        this.logger.error(`Error merging movies for key ${key}:`, error);
      }
    }

    this.logger.info(`Deduplicated ${movies.length} movies to ${result.length} unique movies`);

    return result;
  }

  /**
   * Sort movies by relevance (title match, year match, etc.)
   */
  sortByRelevance(movies: Movie[], searchQuery?: string): Movie[] {
    if (!searchQuery) {
      // Fallback to rating-based sorting if no search query
      return this.sortByRating(movies);
    }

    const query = searchQuery.toLowerCase();
    
    return movies.sort((a, b) => {
      const scoreA = this.calculateRelevanceScore(a, query);
      const scoreB = this.calculateRelevanceScore(b, query);
      
      // Higher relevance score first
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      
      // If relevance is equal, fall back to rating
      const ratingA = this.calculateWeightedRating(a).score;
      const ratingB = this.calculateWeightedRating(b).score;
      return ratingB - ratingA;
    });
  }

  /**
   * Calculate relevance score based on search query
   */
  private calculateRelevanceScore(movie: Movie, query: string): number {
    let score = 0;
    
    // Title exact match (highest priority)
    if (movie.title.toLowerCase() === query) {
      score += 100;
    }
    // Title starts with query
    else if (movie.title.toLowerCase().startsWith(query)) {
      score += 80;
    }
    // Title contains query
    else if (movie.title.toLowerCase().includes(query)) {
      score += 60;
    }
    
    // Original title match
    if (movie.originalTitle) {
      if (movie.originalTitle.toLowerCase() === query) {
        score += 90;
      } else if (movie.originalTitle.toLowerCase().startsWith(query)) {
        score += 70;
      } else if (movie.originalTitle.toLowerCase().includes(query)) {
        score += 50;
      }
    }
    
    // Year match (if query contains year)
    const yearMatch = query.match(/\b(19|20)\d{2}\b/);
    if (yearMatch && movie.year) {
      const queryYear = parseInt(yearMatch[0]);
      const yearDiff = Math.abs(movie.year - queryYear);
      if (yearDiff === 0) {
        score += 40;
      } else if (yearDiff <= 2) {
        score += 20;
      }
    }
    
    // Genre match
    if (movie.genres) {
      const genreMatch = movie.genres.some(genre => 
        genre.toLowerCase().includes(query) || query.includes(genre.toLowerCase())
      );
      if (genreMatch) {
        score += 30;
      }
    }
    
    // Director/Cast match
    if (movie.directors) {
      const directorMatch = movie.directors.some(director => 
        director.toLowerCase().includes(query)
      );
      if (directorMatch) {
        score += 25;
      }
    }
    
    if (movie.cast) {
      const castMatch = movie.cast.some(actor => 
        actor.toLowerCase().includes(query)
      );
      if (castMatch) {
        score += 20;
      }
    }
    
    return score;
  }

  /**
   * Sort movies by rating (original sortByRelevance logic)
   */
  private sortByRating(movies: Movie[]): Movie[] {
    return movies.sort((a, b) => {
      const scoreA = this.calculateWeightedRating(a).score;
      const scoreB = this.calculateWeightedRating(b).score;

      // Higher score first
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }

      // Then by number of ratings (more is better)
      const votesA = a.ratings.reduce((sum, r) => sum + (r.votes || 0), 0);
      const votesB = b.ratings.reduce((sum, r) => sum + (r.votes || 0), 0);

      return votesB - votesA;
    });
  }

  /**
   * Sort movies by given mode
   * modes: 'relevance' | 'year_desc' | 'year_asc' | 'title_az' | 'title_za' | 'votes_desc' | 'votes_asc'
   */
  sortMovies(movies: Movie[], mode: string | undefined, searchQuery?: string): Movie[] {
    const list = [...movies];
    switch (mode) {
      case 'year_desc':
        return list.sort((a, b) => (b.year || 0) - (a.year || 0));
      case 'year_asc':
        return list.sort((a, b) => (a.year || 0) - (b.year || 0));
      case 'title_az':
        return list.sort((a, b) => a.title.localeCompare(b.title));
      case 'title_za':
        return list.sort((a, b) => b.title.localeCompare(a.title));
      case 'votes_desc': {
        return list.sort((a, b) => {
          const votesA = a.ratings.reduce((sum, r) => sum + (r.votes || 0), 0);
          const votesB = b.ratings.reduce((sum, r) => sum + (r.votes || 0), 0);
          return votesB - votesA;
        });
      }
      case 'votes_asc': {
        return list.sort((a, b) => {
          const votesA = a.ratings.reduce((sum, r) => sum + (r.votes || 0), 0);
          const votesB = b.ratings.reduce((sum, r) => sum + (r.votes || 0), 0);
          return votesA - votesB;
        });
      }
      case 'relevance':
      default:
        return this.sortByRelevance(list, searchQuery);
    }
  }
}

