import { useEffect, useState, useRef } from 'react'
import './App.css'
import Auth from './Auth'
import { dict } from './i18n'
import { supabase } from './services/supabase'
import {
  getBackdropUrl,
  getMediaDetails,
  getMediaVideos,
  getPosterUrl,
  getRandomMedia,
  getTrailer,
  searchMedia,
} from './services/tmdb'

function App() {
  const [lang, setLang] = useState(() => localStorage.getItem('mymovies_lang') || 'en')
  
  useEffect(() => {
    localStorage.setItem('mymovies_lang', lang)
  }, [lang])

  const t = dict[lang]

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
  const [isRandomMode, setIsRandomMode] = useState(false)
  const [randomMode, setRandomMode] = useState('popular')
  const [showRandomMenu, setShowRandomMenu] = useState(false)
  const randomMenuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (randomMenuRef.current && !randomMenuRef.current.contains(event.target)) {
        setShowRandomMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const [selectedMovie, setSelectedMovie] = useState(null)
  const [currentPage, setCurrentPage] = useState('home')

  // =========================
  // TRAILER MODAL
  // =========================

  const [trailerModal, setTrailerModal] = useState({
    isOpen: false,
    videoKey: null,
    title: '',
  })

  // =========================
  // SUPABASE MOVIE LIBRARY
  // =========================

  const [watchlist, setWatchlist] = useState([])
  const [watched, setWatched] = useState([])
  const [savingMovieId, setSavingMovieId] = useState(null)
  const [libraryError, setLibraryError] = useState('')

  useEffect(() => {
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
      setIsRandomMode(false)
      return
    }

    try {
      setLoading(true)
      setError('')
      setSelectedMovie(null)
      setCurrentPage('home')
      setIsRandomMode(false)

      const data = await searchMedia(trimmedQuery, lang)

      setMovies(data.results || [])
    } catch (error) {
      console.error('SEARCH ERROR:', error)
      setMovies([])
      setError(t.errTmdb)
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
  // RANDOM MEDIA
  // =========================

  async function handleRandomMedia() {
    try {
      setLoading(true)
      setError('')
      setSelectedMovie(null)
      setCurrentPage('home')
      setIsRandomMode(true)
      setQuery('')
      setShowRandomMenu(false)

      const data = await getRandomMedia(lang, randomMode)

      setMovies(data.results || [])
    } catch (error) {
      console.error('RANDOM MEDIA ERROR:', error)
      setMovies([])
      setError(t.errTmdb)
    } finally {
      setLoading(false)
    }
  }

  async function handleRefreshRandom() {
    if (!isRandomMode) return
    await handleRandomMedia()
  }

  function handleRandomModeChange(mode) {
    setRandomMode(mode)
    setShowRandomMenu(false)
    setTimeout(() => handleRandomMedia(), 100)
  }

  // =========================
  // MOVIE DETAILS
  // =========================

  async function handleMovieClick(mediaId, mediaType = 'movie') {
    try {
      setLoading(true)
      setError('')

      const movieData = await getMediaDetails(mediaId, mediaType, lang)
      
      setSelectedMovie({ ...movieData, media_type: mediaType })

      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      })
    } catch (error) {
      console.error('MEDIA DETAILS ERROR:', error)
      setError(t.errDetails)
    } finally {
      setLoading(false)
    }
  }

  // =========================
  // TRAILER HANDLER
  // =========================

  async function handleWatchTrailer(mediaId, mediaType, title) {
    try {
      setLoading(true)
      setError('')

      const videos = await getMediaVideos(mediaId, mediaType, lang)
      const trailer = getTrailer(videos)

      if (trailer) {
        setTrailerModal({
          isOpen: true,
          videoKey: trailer.key,
          title: title,
        })
      } else {
        setError(t.noTrailer)
        setTimeout(() => setError(''), 3000)
      }
    } catch (error) {
      console.error('TRAILER ERROR:', error)
      setError(t.trailerUnavailable)
      setTimeout(() => setError(''), 3000)
    } finally {
      setLoading(false)
    }
  }

  function closeTrailerModal() {
    setTrailerModal({
      isOpen: false,
      videoKey: null,
      title: '',
    })
  }

  // =========================
  // NAVIGATION
  // =========================

function handleBackToHome() {
    setSelectedMovie(null)
    setCurrentPage('home')
    // НЕ скидаємо isRandomMode - зберігаємо стан
    // setIsRandomMode(false) - видаляємо цей рядок

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  function handleOpenWatchlist() {
    setSelectedMovie(null)
    setCurrentPage('watchlist')
    // При переході на Watchlist вимикаємо random режим
    setIsRandomMode(false)

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  function handleOpenWatched() {
    setSelectedMovie(null)
    setCurrentPage('watched')
    // При переході на Watched вимикаємо random режим
    setIsRandomMode(false)

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
      title: movie.title || movie.name,
      poster_path: movie.poster_path,
      backdrop_path: movie.backdrop_path,
      release_date: movie.release_date || movie.first_air_date,
      vote_average: movie.vote_average,
      overview: movie.overview,
      media_type: movie.media_type || 'movie'
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
      setLibraryError(`${t.errAddWatchlist} ${error.message}`)
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
      setLibraryError(`${t.errRemWatchlist} ${error.message}`)
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
      title: movie.title || movie.name,
      poster_path: movie.poster_path,
      backdrop_path: movie.backdrop_path,
      release_date: movie.release_date || movie.first_air_date,
      vote_average: movie.vote_average,
      overview: movie.overview,
      media_type: movie.media_type || 'movie'
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
      setLibraryError(`${t.errAddWatched} ${watchedError.message}`)
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
      setLibraryError(`${t.errRemWatched} ${error.message}`)
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
    if (!minutes) return t.na
    const hours = Math.floor(minutes / 60)
    const remaining = minutes % 60
    
    const hLabel = lang === 'uk' ? 'год' : 'h'
    const mLabel = lang === 'uk' ? 'хв' : 'min'

    if (hours === 0) return `${remaining} ${mLabel}`
    return `${hours}${hLabel} ${remaining}${mLabel}`
  }

  function formatMoney(amount) {
    if (!amount) return t.na

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  function getDirector(movie) {
    if (movie.media_type === 'tv' && movie.created_by?.length > 0) {
      return { name: movie.created_by[0].name, job: t.creator }
    }
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
          <p className="auth-subtitle">{t.loadingApp}</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <Auth lang={lang} setLang={setLang} t={t} />
  }

  // =========================
  // RENDER
  // =========================

  return (
    <div className="app">

      <header className="header">
        <button
          className="logo"
          onClick={handleBackToHome}
        >
          <span className="logo-icon">🎬</span>
          <span>MyMovies</span>
        </button>

        <nav className="navigation">
          <button
            className={currentPage === 'home' ? 'nav-active' : ''}
            onClick={handleBackToHome}
          >
            {t.home}
          </button>
          <button
            className={currentPage === 'watchlist' ? 'nav-active' : ''}
            onClick={handleOpenWatchlist}
          >
            {t.watchlist}
            {watchlist.length > 0 && (
              <span className="watchlist-count">{watchlist.length}</span>
            )}
          </button>
          <button
            className={currentPage === 'watched' ? 'nav-active' : ''}
            onClick={handleOpenWatched}
          >
            {t.watched}
            {watched.length > 0 && (
              <span className="watched-count">{watched.length}</span>
            )}
          </button>
        </nav>

        <div className="user-section">
          
          <div className="lang-switcher">
            <button 
              className={lang === 'en' ? 'active' : ''} 
              onClick={() => setLang('en')}
            >EN</button>
            <button 
              className={lang === 'uk' ? 'active' : ''} 
              onClick={() => setLang('uk')}
            >UA</button>
          </div>

          <span className="user-name">
            {session.user.user_metadata?.username || t.userFallback}
          </span>

          <button
            className="logout-button"
            onClick={async () => {
              await supabase.auth.signOut()
            }}
          >
            {t.logout}
          </button>
        </div>
      </header>

      <main>
        {libraryError && (
          <div className="library-error">
            {libraryError}
            <button type="button" onClick={() => setLibraryError('')}>
              ×
            </button>
          </div>
        )}

        {selectedMovie ? (
          <MovieDetails
            movie={selectedMovie}
            onBack={handleBackToHome}
            formatRuntime={formatRuntime}
            formatMoney={formatMoney}
            getDirector={getDirector}
            getMainCast={getMainCast}
            isInWatchlist={isInWatchlist(selectedMovie.id)}
            isWatched={isWatched(selectedMovie.id)}
            saving={savingMovieId === selectedMovie.id}
            onToggleWatchlist={() => toggleWatchlist(selectedMovie)}
            onToggleWatched={() => toggleWatched(selectedMovie)}
            onWatchTrailer={() => handleWatchTrailer(selectedMovie.id, selectedMovie.media_type, selectedMovie.title || selectedMovie.name)}
            t={t}
          />
        ) : currentPage === 'watchlist' ? (
          <WatchlistPage
            watchlist={watchlist}
            onMovieClick={handleMovieClick}
            onRemove={removeFromWatchlist}
            onBack={handleBackToHome}
            t={t}
          />
        ) : currentPage === 'watched' ? (
          <WatchedPage
            watched={watched}
            onMovieClick={handleMovieClick}
            onRemove={removeFromWatched}
            onBack={handleBackToHome}
            t={t}
            lang={lang}
          />
        ) : (
          <>
            <section className="hero">
              <div className="hero-content">
                <p className="eyebrow">{t.heroEyebrow}</p>
                <h1>
                  {t.heroTitle1}
                  <br />
                  <span>{t.heroTitle2}</span>
                </h1>
                <p className="hero-description">{t.heroDesc}</p>
                
                <div className="search-container">
                  <div className="search-icon">⌕</div>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t.searchPlaceholder}
                  />
                  <button onClick={handleSearch} disabled={loading}>
                    {loading ? t.searchingBtn : t.searchBtn}
                  </button>
                  
                  <div className="random-wrapper" ref={randomMenuRef}>
                    <button 
                      className="random-button" 
                      onClick={() => setShowRandomMenu(!showRandomMenu)}
                      disabled={loading}
                      title={t.randomBtn}
                    >
                      🎲
                      <span className="random-arrow">▾</span>
                    </button>
                    
                    {showRandomMenu && (
                      <div className="random-menu">
                        <div className="random-menu-title">{t.randomFilterLabel}</div>
                        <button 
                          className={`random-menu-item ${randomMode === 'popular' ? 'active' : ''}`}
                          onClick={() => handleRandomModeChange('popular')}
                        >
                          <span className="random-menu-icon">🔥</span>
                          <span className="random-menu-label">{t.randomPopular}</span>
                          {randomMode === 'popular' && <span className="random-menu-check">✓</span>}
                        </button>
                        <button 
                          className={`random-menu-item ${randomMode === 'all' ? 'active' : ''}`}
                          onClick={() => handleRandomModeChange('all')}
                        >
                          <span className="random-menu-icon">🌍</span>
                          <span className="random-menu-label">{t.randomAll}</span>
                          {randomMode === 'all' && <span className="random-menu-check">✓</span>}
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {isRandomMode && (
                    <button 
                      className="refresh-button" 
                      onClick={handleRefreshRandom}
                      disabled={loading}
                      title={t.refreshRandom}
                    >
                      ↻
                    </button>
                  )}
                </div>
              </div>
            </section>

            <section className="movies-section">
              <div className="section-title">
                <div>
                  <p className="section-label">
                    {isRandomMode ? '🎲' : t.resultsLabel}
                  </p>
                  <h2>
                    {isRandomMode 
                      ? t.randomTitle
                      : query.trim()
                        ? `${t.resultsFor} "${query}"`
                        : t.searchTitle}
                  </h2>
                  {isRandomMode && (
                    <p className="random-description">
                      {randomMode === 'popular' && t.randomPopular}
                      {randomMode === 'all' && t.randomAll}
                    </p>
                  )}
                </div>
                {movies.length > 0 && (
                  <span className="result-count">
                    {movies.length} {t.resultsCount}
                  </span>
                )}
              </div>

              {loading && (
                <div className="message">
                  <div className="spinner" />
                  <p>{isRandomMode ? t.loadingRandom : t.loading}</p>
                </div>
              )}

              {!loading && error && (
                <div className="message error-message">
                  <div className="message-icon">⚠️</div>
                  <p>{error}</p>
                </div>
              )}

              {!loading && !error && !isRandomMode && query.trim() && movies.length === 0 && (
                <div className="message">
                  <div className="message-icon">🎬</div>
                  <p>{t.noResults}</p>
                </div>
              )}

              {!loading && !error && isRandomMode && movies.length === 0 && (
                <div className="message">
                  <div className="message-icon">🎲</div>
                  <p>{t.noResults}</p>
                </div>
              )}

              {!loading && !error && !isRandomMode && !query.trim() && movies.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">🎥</div>
                  <h3>{t.emptySearchTitle}</h3>
                  <p>{t.emptySearchDesc}</p>
                </div>
              )}

              {!loading && movies.length > 0 && (
                <div className="movie-grid">
                  {movies.map((movie) => {
                    const posterUrl = getPosterUrl(movie.poster_path)
                    const dateString = movie.release_date || movie.first_air_date
                    const year = dateString ? dateString.slice(0, 4) : t.na
                    const title = movie.title || movie.name
                    const mediaType = movie.media_type || 'movie'
                    const isTv = mediaType === 'tv'
                    const rating = typeof movie.vote_average === 'number'
                        ? movie.vote_average.toFixed(1)
                        : t.na

                    return (
                      <article
                        className="movie-card"
                        key={movie.id}
                        onClick={() => handleMovieClick(movie.id, mediaType)}
                      >
                        <div className="poster-container">
                          {posterUrl ? (
                            <img src={posterUrl} alt={`${title} poster`} />
                          ) : (
                            <div className="no-poster">
                              {isTv ? '📺' : '🎬'}
                            </div>
                          )}
                          {isWatched(movie.id) && (
                            <div className="watched-badge">✓</div>
                          )}
                          {isInWatchlist(movie.id) && !isWatched(movie.id) && (
                            <div className="watchlist-badge">+</div>
                          )}
                          <div className="poster-overlay">
                            <button
                              className="details-button"
                              onClick={(event) => {
                                event.stopPropagation()
                                handleMovieClick(movie.id, mediaType)
                              }}
                            >
                              {t.viewDetails}
                            </button>
                          </div>
                        </div>

                        <div className="movie-info">
                          <h3>{title}</h3>
                          <div className="movie-meta">
                            <div>
                              <span>{year}</span>
                              <span className="media-type-tag">
                                {isTv ? t.tvBadge : t.movieBadge}
                              </span>
                            </div>
                            <span className="rating">★ {rating}</span>
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

      {/* TRAILER MODAL */}
      {trailerModal.isOpen && trailerModal.videoKey && (
        <div className="trailer-modal-overlay" onClick={closeTrailerModal}>
          <div className="trailer-modal" onClick={(e) => e.stopPropagation()}>
            <button className="trailer-modal-close" onClick={closeTrailerModal}>
              ×
            </button>
            <h3 className="trailer-modal-title">{trailerModal.title}</h3>
            <div className="trailer-modal-video">
              <iframe
                src={`https://www.youtube.com/embed/${trailerModal.videoKey}?autoplay=1&rel=0`}
                title={`${trailerModal.title} trailer`}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function WatchlistPage({ watchlist, onMovieClick, onRemove, onBack, t }) {
  return (
    <section className="watchlist-page">
      <div className="watchlist-header">
        <div>
          <p className="section-label">{t.libraryLabel}</p>
          <h1 className="watchlist-title">{t.myWatchlist}</h1>
          <p className="watchlist-description">{t.watchlistDesc}</p>
        </div>
        <div className="watchlist-total">
          <span>{watchlist.length}</span>
          <small>{watchlist.length === 1 ? t.titleSingle : t.titlePlural}</small>
        </div>
      </div>

      {watchlist.length === 0 ? (
        <div className="watchlist-empty">
          <div className="watchlist-empty-icon">🍿</div>
          <h2>{t.emptyWatchlist}</h2>
          <p>{t.emptyWatchlistDesc}</p>
          <button className="watchlist-home-button" onClick={onBack}>
            {t.findTitles}
          </button>
        </div>
      ) : (
        <div className="watchlist-grid">
          {watchlist.map((movie) => {
            const posterUrl = getPosterUrl(movie.poster_path)
            const dateString = movie.release_date || movie.first_air_date
            const year = dateString ? dateString.slice(0, 4) : t.na
            const title = movie.title || movie.name
            const mediaType = movie.media_type || 'movie'
            const isTv = mediaType === 'tv'

            return (
              <article className="watchlist-card" key={movie.id}>
                <div
                  className="watchlist-poster"
                  onClick={() => onMovieClick(movie.id, mediaType)}
                >
                  {posterUrl ? (
                    <img src={posterUrl} alt={title} />
                  ) : (
                    <div className="no-poster">{isTv ? '📺' : '🎬'}</div>
                  )}
                  <div className="watchlist-poster-overlay">
                    <span>{t.viewDetails}</span>
                  </div>
                </div>

                <div className="watchlist-card-info">
                  <div>
                    <h3>{title}</h3>
                    <div className="movie-meta">
                      <div>
                        <span>{year}</span>
                        <span className="media-type-tag">
                          {isTv ? t.tvBadge : t.movieBadge}
                        </span>
                      </div>
                      <span className="rating">
                        ★ {movie.vote_average?.toFixed(1) || t.na}
                      </span>
                    </div>
                  </div>
                  <button
                    className="remove-button"
                    onClick={() => onRemove(movie.id)}
                  >
                    {t.removeBtn}
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

function WatchedPage({ watched, onMovieClick, onRemove, onBack, t, lang }) {
  return (
    <section className="watchlist-page">
      <div className="watchlist-header">
        <div>
          <p className="section-label">{t.libraryLabel}</p>
          <h1 className="watchlist-title">{t.watchedTitle}</h1>
          <p className="watchlist-description">{t.watchedDesc}</p>
        </div>
        <div className="watchlist-total">
          <span>{watched.length}</span>
          <small>{watched.length === 1 ? t.titleSingle : t.titlePlural}</small>
        </div>
      </div>

      {watched.length === 0 ? (
        <div className="watchlist-empty">
          <div className="watchlist-empty-icon">🎬</div>
          <h2>{t.emptyWatched}</h2>
          <p>{t.emptyWatchedDesc}</p>
          <button className="watchlist-home-button" onClick={onBack}>
            {t.findTitles}
          </button>
        </div>
      ) : (
        <div className="watchlist-grid">
          {watched.map((movie) => {
            const posterUrl = getPosterUrl(movie.poster_path)
            const dateString = movie.release_date || movie.first_air_date
            const year = dateString ? dateString.slice(0, 4) : t.na
            const title = movie.title || movie.name
            const mediaType = movie.media_type || 'movie'
            const isTv = mediaType === 'tv'

            const watchedDate = movie.watchedAt
              ? new Date(movie.watchedAt).toLocaleDateString(
                  lang === 'uk' ? 'uk-UA' : 'en-US',
                  { day: 'numeric', month: 'short', year: 'numeric' }
                )
              : t.na

            return (
              <article className="watchlist-card" key={movie.id}>
                <div
                  className="watchlist-poster"
                  onClick={() => onMovieClick(movie.id, mediaType)}
                >
                  {posterUrl ? (
                    <img src={posterUrl} alt={title} />
                  ) : (
                    <div className="no-poster">{isTv ? '📺' : '🎬'}</div>
                  )}
                  <div className="watched-page-badge">✓ {t.watchedBadge}</div>
                  <div className="watchlist-poster-overlay">
                    <span>{t.viewDetails}</span>
                  </div>
                </div>

                <div className="watchlist-card-info">
                  <div>
                    <h3>{title}</h3>
                    <div className="movie-meta">
                      <div>
                        <span>{year}</span>
                        <span className="media-type-tag">
                          {isTv ? t.tvBadge : t.movieBadge}
                        </span>
                      </div>
                      <span className="rating">
                        ★ {movie.vote_average?.toFixed(1) || t.na}
                      </span>
                    </div>
                    <div className="watched-date">
                      {t.watchedOn} {watchedDate}
                    </div>
                  </div>
                  <button
                    className="remove-button"
                    onClick={() => onRemove(movie.id)}
                  >
                    {t.removeBtn}
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
  onWatchTrailer,
  t
}) {
  const posterUrl = getPosterUrl(movie.poster_path, 'w780')
  const backdropUrl = getBackdropUrl(movie.backdrop_path)
  const director = getDirector(movie)
  const cast = getMainCast(movie)
  const title = movie.title || movie.name
  const isTv = movie.media_type === 'tv'
  const dateString = movie.release_date || movie.first_air_date
  const year = dateString ? dateString.slice(0, 4) : t.na
  const rating = typeof movie.vote_average === 'number'
      ? movie.vote_average.toFixed(1)
      : t.na

  const runtimeText = isTv
    ? (movie.number_of_seasons ? `${movie.number_of_seasons} ${t.seasons}` : t.tvBadge)
    : formatRuntime(movie.runtime)

  return (
    <section className="details-page">
      {backdropUrl && (
        <div
          className="details-backdrop"
          style={{ backgroundImage: `url("${backdropUrl}")` }}
        />
      )}
      <div className="details-backdrop-overlay" />

      <div className="details-content">
        <button className="back-button" onClick={onBack}>
          ← {t.back}
        </button>

        <div className="details-main">
          <div className="details-poster-wrapper">
            {posterUrl ? (
              <img className="details-poster" src={posterUrl} alt={title} />
            ) : (
              <div className="details-no-poster">{isTv ? '📺' : '🎬'}</div>
            )}
          </div>

          <div className="details-info">
            <p className="details-label">{isTv ? t.tvShowLabel : t.movieLabel}</p>
            <h1 className="details-title">{title}</h1>
            
            {movie.tagline && (
              <p className="details-tagline">"{movie.tagline}"</p>
            )}

            <div className="details-meta">
              <span>{year}</span>
              <span>•</span>
              <span>{runtimeText}</span>
              <span>•</span>
              <span className="details-rating">★ {rating}</span>
            </div>

            {movie.genres?.length > 0 && (
              <div className="genre-list">
                {movie.genres.map((genre) => (
                  <span className="genre" key={genre.id}>
                    {genre.name}
                  </span>
                ))}
              </div>
            )}

            <p className="details-overview">
              {movie.overview || t.noDesc}
            </p>

            <div className="details-actions">
              <button
                className={isInWatchlist ? 'primary-action in-watchlist' : 'primary-action'}
                onClick={onToggleWatchlist}
                disabled={saving}
              >
                {saving ? t.saving : isInWatchlist ? `✓ ${t.inWatchlist}` : `+ ${t.addWatchlist}`}
              </button>

              <button
                className={isWatched ? 'secondary-action watched-action' : 'secondary-action'}
                onClick={onToggleWatched}
                disabled={saving}
              >
                {saving ? t.saving : isWatched ? `✓ ${t.watchedBadge}` : `✓ ${t.markWatched}`}
              </button>

              <button
                className="trailer-button"
                onClick={onWatchTrailer}
                disabled={saving}
              >
                ▶ {t.watchTrailer}
              </button>
            </div>

            <div className="details-extra">
              {director && (
                <div className="extra-item">
                  <span className="extra-label">
                    {director.job === 'Creator' ? t.creator : t.director}
                  </span>
                  <span className="extra-value">{director.name}</span>
                </div>
              )}

              <div className="extra-item">
                <span className="extra-label">{t.releaseDate}</span>
                <span className="extra-value">{dateString || t.na}</span>
              </div>

              {!isTv && (
                <>
                  <div className="extra-item">
                    <span className="extra-label">{t.budget}</span>
                    <span className="extra-value">{formatMoney(movie.budget)}</span>
                  </div>
                  <div className="extra-item">
                    <span className="extra-label">{t.revenue}</span>
                    <span className="extra-value">{formatMoney(movie.revenue)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {cast.length > 0 && (
          <section className="cast-section">
            <div className="details-section-heading">
              <p className="section-label">{t.castLabel}</p>
              <h2>{t.topCast}</h2>
            </div>
            <div className="cast-grid">
              {cast.map((person) => {
                const profileUrl = getPosterUrl(person.profile_path, 'w185')
                return (
                  <div className="cast-card" key={person.id}>
                    <div className="cast-photo">
                      {profileUrl ? (
                        <img src={profileUrl} alt={person.name} />
                      ) : (
                        <div className="no-cast-photo">👤</div>
                      )}
                    </div>
                    <div className="cast-info">
                      <strong>{person.name}</strong>
                      <span>{person.character || t.unknownRole}</span>
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