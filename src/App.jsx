
import { useEffect, useState } from 'react'
import './App.css'
import Auth from './Auth'
import { supabase } from './services/supabase'
import {
  getBackdropUrl,
  getMovieDetails,
  getPosterUrl,
  searchMovies,
} from './services/tmdb'

function App() {
  // =========================
  // SUPABASE AUTH
  // =========================

  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session)
        setAuthLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setAuthLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const [query, setQuery] = useState('')
  const [movies, setMovies] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [selectedMovie, setSelectedMovie] = useState(null)
  const [currentPage, setCurrentPage] = useState('home')

  // =========================
  // SUPABASE MOVIE LIBRARY
  // =========================

  const [watchlist, setWatchlist] = useState([])
  const [watched, setWatched] = useState([])
  const [savingMovieId, setSavingMovieId] = useState(null)
  const [libraryError, setLibraryError] = useState('')

  useEffect(() => {
    // Remove old local data from previous versions.
    // The application now uses Supabase only.
    localStorage.removeItem('mymovies_watchlist')
    localStorage.removeItem('mymovies_watched')
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadLibrary() {
      if (!session?.user?.id) {
        setWatchlist([])
        setWatched([])
        return
      }

      setWatchlist([])
      setWatched([])
      setLibraryError('')

      const { data, error } = await supabase
        .from('movie_lists')
        .select('movie_id, list_type, movie_data, watched_at')
        .eq('user_id', session.user.id)

      if (cancelled) return

      if (error) {
        console.error('LIBRARY LOAD ERROR:', error)
        setWatchlist([])
        setWatched([])
        return
      }

      const nextWatchlist = []
      const nextWatched = []

      for (const row of data || []) {
        const movie = {
          ...(row.movie_data || {}),
          id: Number(row.movie_id),
        }

        if (row.list_type === 'watchlist') {
          nextWatchlist.push(movie)
        } else if (row.list_type === 'watched') {
          nextWatched.push({
            ...movie,
            watchedAt: row.watched_at || movie.watchedAt,
          })
        }
      }

      setWatchlist(nextWatchlist)
      setWatched(nextWatched)
    }

    loadLibrary()

    return () => {
      cancelled = true
    }
  }, [session?.user?.id])

  // =========================
  // SEARCH
  // =========================

  async function handleSearch() {
    const trimmedQuery = query.trim()

    if (!trimmedQuery) {
      setMovies([])
      setError('')
      return
    }

    try {
      setLoading(true)
      setError('')
      setSelectedMovie(null)
      setCurrentPage('home')

      const data = await searchMovies(trimmedQuery)

      setMovies(data.results || [])
    } catch (error) {
      console.error('SEARCH ERROR:', error)

      setMovies([])
      setError(
        'Не вдалося завантажити фільми. Перевір підключення до TMDB.'
      )
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter') {
      handleSearch()
    }
  }

  // =========================
  // MOVIE DETAILS
  // =========================

  async function handleMovieClick(movieId) {
    try {
      setLoading(true)
      setError('')

      const movie = await getMovieDetails(movieId)

      setSelectedMovie(movie)

      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      })
    } catch (error) {
      console.error('MOVIE DETAILS ERROR:', error)

      setError(
        'Не вдалося завантажити інформацію про фільм.'
      )
    } finally {
      setLoading(false)
    }
  }

  // =========================
  // NAVIGATION
  // =========================

  function handleBackToHome() {
    setSelectedMovie(null)
    setCurrentPage('home')

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  function handleOpenWatchlist() {
    setSelectedMovie(null)
    setCurrentPage('watchlist')

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  function handleOpenWatched() {
    setSelectedMovie(null)
    setCurrentPage('watched')

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  // =========================
  // WATCHLIST
  // =========================

  function isInWatchlist(movieId) {
    return watchlist.some(
      (movie) => movie.id === movieId
    )
  }

  async function addToWatchlist(movie) {
    if (!session?.user?.id || isInWatchlist(movie.id)) return

    setSavingMovieId(movie.id)
    setLibraryError('')

    const movieData = {
      id: movie.id,
      title: movie.title,
      poster_path: movie.poster_path,
      backdrop_path: movie.backdrop_path,
      release_date: movie.release_date,
      vote_average: movie.vote_average,
      overview: movie.overview,
    }

    const { error } = await supabase
      .from('movie_lists')
      .insert({
        user_id: session.user.id,
        movie_id: Number(movie.id),
        list_type: 'watchlist',
        movie_data: movieData,
      })

    if (error) {
      console.error('WATCHLIST ADD ERROR:', error)
      setLibraryError(`Не вдалося додати у Watchlist: ${error.message}`)
      setSavingMovieId(null)
      return
    }

    setWatchlist((current) => [...current, movieData])
    setSavingMovieId(null)
  }

  async function removeFromWatchlist(movieId) {
    if (!session?.user?.id) return

    setSavingMovieId(movieId)
    setLibraryError('')

    const { error } = await supabase
      .from('movie_lists')
      .delete()
      .eq('user_id', session.user.id)
      .eq('movie_id', Number(movieId))
      .eq('list_type', 'watchlist')

    if (error) {
      console.error('WATCHLIST REMOVE ERROR:', error)
      setLibraryError(`Не вдалося видалити з Watchlist: ${error.message}`)
      setSavingMovieId(null)
      return
    }

    setWatchlist((current) =>
      current.filter((movie) => movie.id !== movieId)
    )
    setSavingMovieId(null)
  }

  async function toggleWatchlist(movie) {
    if (isInWatchlist(movie.id)) {
      await removeFromWatchlist(movie.id)
    } else {
      await addToWatchlist(movie)
    }
  }

  // =========================
  // WATCHED
  // =========================

  function isWatched(movieId) {
    return watched.some(
      (movie) => movie.id === movieId
    )
  }

  async function addToWatched(movie) {
    if (!session?.user?.id || isWatched(movie.id)) return

    setSavingMovieId(movie.id)
    setLibraryError('')

    const watchedAt = new Date().toISOString()

    const movieData = {
      id: movie.id,
      title: movie.title,
      poster_path: movie.poster_path,
      backdrop_path: movie.backdrop_path,
      release_date: movie.release_date,
      vote_average: movie.vote_average,
      overview: movie.overview,
    }

    const { error: watchedError } = await supabase
      .from('movie_lists')
      .insert({
        user_id: session.user.id,
        movie_id: Number(movie.id),
        list_type: 'watched',
        movie_data: movieData,
        watched_at: watchedAt,
      })

    if (watchedError) {
      console.error('WATCHED ADD ERROR:', watchedError)
      setLibraryError(`Не вдалося позначити як переглянуте: ${watchedError.message}`)
      setSavingMovieId(null)
      return
    }

    const { error: watchlistError } = await supabase
      .from('movie_lists')
      .delete()
      .eq('user_id', session.user.id)
      .eq('movie_id', Number(movie.id))
      .eq('list_type', 'watchlist')

    if (watchlistError) {
      console.error('WATCHLIST REMOVE AFTER WATCHED ERROR:', watchlistError)
    }

    setWatched((current) => [
      ...current,
      {
        ...movieData,
        watchedAt,
      },
    ])

    setWatchlist((current) =>
      current.filter((item) => item.id !== movie.id)
    )

    setSavingMovieId(null)
  }

  async function removeFromWatched(movieId) {
    if (!session?.user?.id) return

    setSavingMovieId(movieId)
    setLibraryError('')

    const { error } = await supabase
      .from('movie_lists')
      .delete()
      .eq('user_id', session.user.id)
      .eq('movie_id', Number(movieId))
      .eq('list_type', 'watched')

    if (error) {
      console.error('WATCHED REMOVE ERROR:', error)
      setLibraryError(`Не вдалося прибрати з Watched: ${error.message}`)
      setSavingMovieId(null)
      return
    }

    setWatched((current) =>
      current.filter((movie) => movie.id !== movieId)
    )
    setSavingMovieId(null)
  }

  async function toggleWatched(movie) {
    if (isWatched(movie.id)) {
      await removeFromWatched(movie.id)
    } else {
      await addToWatched(movie)
    }
  }

  // =========================
  // HELPERS
  // =========================

  function formatRuntime(minutes) {
    if (!minutes) return 'N/A'

    const hours = Math.floor(minutes / 60)
    const remaining = minutes % 60

    if (hours === 0) {
      return `${remaining} min`
    }

    return `${hours}h ${remaining}min`
  }

  function formatMoney(amount) {
    if (!amount) return 'N/A'

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  function getDirector(movie) {
    return movie.credits?.crew?.find(
      (person) => person.job === 'Director'
    )
  }

  function getMainCast(movie) {
    return movie.credits?.cast?.slice(0, 8) || []
  }

  // =========================
  // AUTH SCREEN
  // =========================

  if (authLoading) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">🎬</div>
          <h1>MyMovies</h1>
          <p className="auth-subtitle">Завантаження...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <Auth />
  }

  // =========================
  // RENDER
  // =========================

  return (
    <div className="app">

      {/* HEADER */}

      <header className="header">
        <button
          className="logo"
          onClick={handleBackToHome}
        >
          <span className="logo-icon">
            🎬
          </span>

          <span>MyMovies</span>
        </button>

        <nav className="navigation">

          <button
            className={
              currentPage === 'home'
                ? 'nav-active'
                : ''
            }
            onClick={handleBackToHome}
          >
            Home
          </button>

          <button
            className={
              currentPage === 'watchlist'
                ? 'nav-active'
                : ''
            }
            onClick={handleOpenWatchlist}
          >
            Watchlist

            {watchlist.length > 0 && (
              <span className="watchlist-count">
                {watchlist.length}
              </span>
            )}
          </button>

          <button
            className={
              currentPage === 'watched'
                ? 'nav-active'
                : ''
            }
            onClick={handleOpenWatched}
          >
            Watched

            {watched.length > 0 && (
              <span className="watched-count">
                {watched.length}
              </span>
            )}
          </button>

        </nav>

        <div className="user-section">
          <span className="user-name">
            {session.user.user_metadata?.username || 'User'}
          </span>

          <button
            className="logout-button"
            onClick={async () => {
              await supabase.auth.signOut()
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <main>

        {libraryError && (
          <div className="library-error">
            {libraryError}
            <button
              type="button"
              onClick={() => setLibraryError('')}
            >
              ×
            </button>
          </div>
        )}

        {/* =========================
            MOVIE DETAILS
        ========================= */}

        {selectedMovie ? (

          <MovieDetails
            movie={selectedMovie}
            onBack={handleBackToHome}
            formatRuntime={formatRuntime}
            formatMoney={formatMoney}
            getDirector={getDirector}
            getMainCast={getMainCast}
            isInWatchlist={isInWatchlist(
              selectedMovie.id
            )}
            isWatched={isWatched(
              selectedMovie.id
            )}
            saving={savingMovieId === selectedMovie.id}
            onToggleWatchlist={() =>
              toggleWatchlist(selectedMovie)
            }
            onToggleWatched={() =>
              toggleWatched(selectedMovie)
            }
          />

        ) : currentPage === 'watchlist' ? (

          <WatchlistPage
            watchlist={watchlist}
            onMovieClick={handleMovieClick}
            onRemove={removeFromWatchlist}
            onBack={handleBackToHome}
          />

        ) : currentPage === 'watched' ? (

          <WatchedPage
            watched={watched}
            onMovieClick={handleMovieClick}
            onRemove={removeFromWatched}
            onBack={handleBackToHome}
          />

        ) : (

          <>
            {/* HERO */}

            <section className="hero">
              <div className="hero-content">

                <p className="eyebrow">
                  YOUR PERSONAL MOVIE LIBRARY
                </p>

                <h1>
                  What do you want
                  <br />
                  <span>to watch?</span>
                </h1>

                <p className="hero-description">
                  Find movies, build your
                  watchlist and keep track
                  of everything you've
                  watched.
                </p>

                <div className="search-container">

                  <div className="search-icon">
                    ⌕
                  </div>

                  <input
                    value={query}
                    onChange={(event) =>
                      setQuery(
                        event.target.value
                      )
                    }
                    onKeyDown={handleKeyDown}
                    placeholder="Search for a movie..."
                  />

                  <button
                    onClick={handleSearch}
                    disabled={loading}
                  >
                    {loading
                      ? 'Searching...'
                      : 'Search'}
                  </button>

                </div>

              </div>
            </section>

            {/* SEARCH RESULTS */}

            <section className="movies-section">

              <div className="section-title">

                <div>
                  <p className="section-label">
                    MOVIES
                  </p>

                  <h2>
                    {query.trim()
                      ? `Results for "${query}"`
                      : 'Search for a movie'}
                  </h2>
                </div>

                {movies.length > 0 && (
                  <span className="result-count">
                    {movies.length} results
                  </span>
                )}

              </div>

              {loading && (
                <div className="message">
                  <div className="spinner" />
                  <p>Loading...</p>
                </div>
              )}

              {!loading && error && (
                <div className="message error-message">
                  <div className="message-icon">
                    ⚠️
                  </div>

                  <p>{error}</p>
                </div>
              )}

              {!loading &&
                !error &&
                query.trim() &&
                movies.length === 0 && (
                  <div className="message">
                    <div className="message-icon">
                      🎬
                    </div>

                    <p>No movies found.</p>
                  </div>
                )}

              {!query.trim() && (
                <div className="empty-state">

                  <div className="empty-icon">
                    🎥
                  </div>

                  <h3>
                    Find your next movie
                  </h3>

                  <p>
                    Enter a movie title above
                    and we'll show you the
                    results.
                  </p>

                </div>
              )}

              {!loading &&
                movies.length > 0 && (

                  <div className="movie-grid">

                    {movies.map((movie) => {

                      const posterUrl =
                        getPosterUrl(
                          movie.poster_path
                        )

                      const year =
                        movie.release_date
                          ? movie.release_date.slice(
                              0,
                              4
                            )
                          : 'N/A'

                      const rating =
                        typeof movie.vote_average ===
                        'number'
                          ? movie.vote_average.toFixed(
                              1
                            )
                          : 'N/A'

                      return (
                        <article
                          className="movie-card"
                          key={movie.id}
                          onClick={() =>
                            handleMovieClick(
                              movie.id
                            )
                          }
                        >

                          <div className="poster-container">

                            {posterUrl ? (
                              <img
                                src={posterUrl}
                                alt={`${movie.title} poster`}
                              />
                            ) : (
                              <div className="no-poster">
                                🎬
                              </div>
                            )}

                            {isWatched(
                              movie.id
                            ) && (
                              <div className="watched-badge">
                                ✓
                              </div>
                            )}

                            {isInWatchlist(
                              movie.id
                            ) &&
                              !isWatched(
                                movie.id
                              ) && (
                                <div className="watchlist-badge">
                                  +
                                </div>
                              )}

                            <div className="poster-overlay">

                              <button
                                className="details-button"
                                onClick={(event) => {
                                  event.stopPropagation()

                                  handleMovieClick(
                                    movie.id
                                  )
                                }}
                              >
                                View details
                              </button>

                            </div>

                          </div>

                          <div className="movie-info">

                            <h3>
                              {movie.title}
                            </h3>

                            <div className="movie-meta">

                              <span>
                                {year}
                              </span>

                              <span className="rating">
                                ★ {rating}
                              </span>

                            </div>

                          </div>

                        </article>
                      )
                    })}

                  </div>
                )}

            </section>
          </>
        )}

      </main>
    </div>
  )
}


/* =========================================
   WATCHLIST PAGE
========================================= */

function WatchlistPage({
  watchlist,
  onMovieClick,
  onRemove,
  onBack,
}) {
  return (
    <section className="watchlist-page">

      <div className="watchlist-header">

        <div>

          <p className="section-label">
            YOUR LIBRARY
          </p>

          <h1 className="watchlist-title">
            My Watchlist
          </h1>

          <p className="watchlist-description">
            Movies you want to watch later.
          </p>

        </div>

        <div className="watchlist-total">

          <span>
            {watchlist.length}
          </span>

          <small>
            {watchlist.length === 1
              ? 'movie'
              : 'movies'}
          </small>

        </div>

      </div>

      {watchlist.length === 0 ? (

        <div className="watchlist-empty">

          <div className="watchlist-empty-icon">
            🍿
          </div>

          <h2>
            Your Watchlist is empty
          </h2>

          <p>
            Search for movies and add them
            here to watch later.
          </p>

          <button
            className="watchlist-home-button"
            onClick={onBack}
          >
            Find movies
          </button>

        </div>

      ) : (

        <div className="watchlist-grid">

          {watchlist.map((movie) => {

            const posterUrl =
              getPosterUrl(
                movie.poster_path
              )

            const year =
              movie.release_date
                ? movie.release_date.slice(
                    0,
                    4
                  )
                : 'N/A'

            return (
              <article
                className="watchlist-card"
                key={movie.id}
              >

                <div
                  className="watchlist-poster"
                  onClick={() =>
                    onMovieClick(movie.id)
                  }
                >

                  {posterUrl ? (
                    <img
                      src={posterUrl}
                      alt={movie.title}
                    />
                  ) : (
                    <div className="no-poster">
                      🎬
                    </div>
                  )}

                  <div className="watchlist-poster-overlay">
                    <span>
                      View details
                    </span>
                  </div>

                </div>

                <div className="watchlist-card-info">

                  <div>

                    <h3>
                      {movie.title}
                    </h3>

                    <div className="movie-meta">

                      <span>
                        {year}
                      </span>

                      <span className="rating">
                        ★{' '}
                        {movie.vote_average?.toFixed(
                          1
                        ) || 'N/A'}
                      </span>

                    </div>

                  </div>

                  <button
                    className="remove-button"
                    onClick={() =>
                      onRemove(movie.id)
                    }
                  >
                    Remove
                  </button>

                </div>

              </article>
            )
          })}

        </div>
      )}

    </section>
  )
}


/* =========================================
   WATCHED PAGE
========================================= */

function WatchedPage({
  watched,
  onMovieClick,
  onRemove,
  onBack,
}) {
  return (
    <section className="watchlist-page">

      <div className="watchlist-header">

        <div>

          <p className="section-label">
            YOUR LIBRARY
          </p>

          <h1 className="watchlist-title">
            Watched Movies
          </h1>

          <p className="watchlist-description">
            Movies you've already watched.
          </p>

        </div>

        <div className="watchlist-total">

          <span>
            {watched.length}
          </span>

          <small>
            {watched.length === 1
              ? 'movie'
              : 'movies'}
          </small>

        </div>

      </div>

      {watched.length === 0 ? (

        <div className="watchlist-empty">

          <div className="watchlist-empty-icon">
            🎬
          </div>

          <h2>
            You haven't watched anything yet
          </h2>

          <p>
            Mark movies as watched and
            they'll appear here.
          </p>

          <button
            className="watchlist-home-button"
            onClick={onBack}
          >
            Find movies
          </button>

        </div>

      ) : (

        <div className="watchlist-grid">

          {watched.map((movie) => {

            const posterUrl =
              getPosterUrl(
                movie.poster_path
              )

            const year =
              movie.release_date
                ? movie.release_date.slice(
                    0,
                    4
                  )
                : 'N/A'

            const watchedDate =
              movie.watchedAt
                ? new Date(
                    movie.watchedAt
                  ).toLocaleDateString(
                    'en-US',
                    {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    }
                  )
                : 'Unknown'

            return (
              <article
                className="watchlist-card"
                key={movie.id}
              >

                <div
                  className="watchlist-poster"
                  onClick={() =>
                    onMovieClick(movie.id)
                  }
                >

                  {posterUrl ? (
                    <img
                      src={posterUrl}
                      alt={movie.title}
                    />
                  ) : (
                    <div className="no-poster">
                      🎬
                    </div>
                  )}

                  <div className="watched-page-badge">
                    ✓ Watched
                  </div>

                  <div className="watchlist-poster-overlay">
                    <span>
                      View details
                    </span>
                  </div>

                </div>

                <div className="watchlist-card-info">

                  <div>

                    <h3>
                      {movie.title}
                    </h3>

                    <div className="movie-meta">

                      <span>
                        {year}
                      </span>

                      <span className="rating">
                        ★{' '}
                        {movie.vote_average?.toFixed(
                          1
                        ) || 'N/A'}
                      </span>

                    </div>

                    <div className="watched-date">
                      Watched {watchedDate}
                    </div>

                  </div>

                  <button
                    className="remove-button"
                    onClick={() =>
                      onRemove(movie.id)
                    }
                  >
                    Remove
                  </button>

                </div>

              </article>
            )
          })}

        </div>
      )}

    </section>
  )
}


/* =========================================
   MOVIE DETAILS
========================================= */

function MovieDetails({
  movie,
  onBack,
  formatRuntime,
  formatMoney,
  getDirector,
  getMainCast,
  isInWatchlist,
  isWatched,
  saving,
  onToggleWatchlist,
  onToggleWatched,
}) {
  const posterUrl = getPosterUrl(
    movie.poster_path,
    'w780'
  )

  const backdropUrl = getBackdropUrl(
    movie.backdrop_path
  )

  const director = getDirector(movie)
  const cast = getMainCast(movie)

  const year = movie.release_date
    ? movie.release_date.slice(0, 4)
    : 'N/A'

  const rating =
    typeof movie.vote_average === 'number'
      ? movie.vote_average.toFixed(1)
      : 'N/A'

  return (
    <section className="details-page">

      {backdropUrl && (
        <div
          className="details-backdrop"
          style={{
            backgroundImage: `url("${backdropUrl}")`,
          }}
        />
      )}

      <div className="details-backdrop-overlay" />

      <div className="details-content">

        <button
          className="back-button"
          onClick={onBack}
        >
          ← Back
        </button>

        <div className="details-main">

          <div className="details-poster-wrapper">

            {posterUrl ? (
              <img
                className="details-poster"
                src={posterUrl}
                alt={movie.title}
              />
            ) : (
              <div className="details-no-poster">
                🎬
              </div>
            )}

          </div>

          <div className="details-info">

            <p className="details-label">
              MOVIE
            </p>

            <h1 className="details-title">
              {movie.title}
            </h1>

            {movie.tagline && (
              <p className="details-tagline">
                "{movie.tagline}"
              </p>
            )}

            <div className="details-meta">

              <span>{year}</span>

              <span>•</span>

              <span>
                {formatRuntime(
                  movie.runtime
                )}
              </span>

              <span>•</span>

              <span className="details-rating">
                ★ {rating}
              </span>

            </div>

            {movie.genres?.length > 0 && (
              <div className="genre-list">

                {movie.genres.map((genre) => (
                  <span
                    className="genre"
                    key={genre.id}
                  >
                    {genre.name}
                  </span>
                ))}

              </div>
            )}

            <p className="details-overview">
              {movie.overview ||
                'No description available.'}
            </p>

            <div className="details-actions">

              <button
                className={
                  isInWatchlist
                    ? 'primary-action in-watchlist'
                    : 'primary-action'
                }
                onClick={onToggleWatchlist}
                disabled={saving}
              >
                {saving
                  ? 'Зберігаємо...'
                  : isInWatchlist
                    ? '✓ In Watchlist'
                    : '+ Add to Watchlist'}
              </button>

              <button
                className={
                  isWatched
                    ? 'secondary-action watched-action'
                    : 'secondary-action'
                }
                onClick={onToggleWatched}
                disabled={saving}
              >
                {saving
                  ? 'Зберігаємо...'
                  : isWatched
                    ? '✓ Watched'
                    : '✓ Mark as Watched'}
              </button>

            </div>

            <div className="details-extra">

              {director && (
                <div className="extra-item">

                  <span className="extra-label">
                    Director
                  </span>

                  <span className="extra-value">
                    {director.name}
                  </span>

                </div>
              )}

              <div className="extra-item">

                <span className="extra-label">
                  Release date
                </span>

                <span className="extra-value">
                  {movie.release_date ||
                    'N/A'}
                </span>

              </div>

              <div className="extra-item">

                <span className="extra-label">
                  Budget
                </span>

                <span className="extra-value">
                  {formatMoney(
                    movie.budget
                  )}
                </span>

              </div>

              <div className="extra-item">

                <span className="extra-label">
                  Revenue
                </span>

                <span className="extra-value">
                  {formatMoney(
                    movie.revenue
                  )}
                </span>

              </div>

            </div>

          </div>

        </div>

        {cast.length > 0 && (
          <section className="cast-section">

            <div className="details-section-heading">

              <p className="section-label">
                CAST
              </p>

              <h2>Top Cast</h2>

            </div>

            <div className="cast-grid">

              {cast.map((person) => {

                const profileUrl =
                  getPosterUrl(
                    person.profile_path,
                    'w185'
                  )

                return (
                  <div
                    className="cast-card"
                    key={person.id}
                  >

                    <div className="cast-photo">

                      {profileUrl ? (
                        <img
                          src={profileUrl}
                          alt={person.name}
                        />
                      ) : (
                        <div className="no-cast-photo">
                          👤
                        </div>
                      )}

                    </div>

                    <div className="cast-info">

                      <strong>
                        {person.name}
                      </strong>

                      <span>
                        {person.character ||
                          'Unknown role'}
                      </span>

                    </div>

                  </div>
                )
              })}

            </div>

          </section>
        )}

      </div>

    </section>
  )
}

export default App