const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

const TMDB_TOKEN = import.meta.env.VITE_TMDB_TOKEN

async function tmdbRequest(endpoint) {
  if (!TMDB_TOKEN) {
    throw new Error(
      'TMDB_TOKEN_MISSING: VITE_TMDB_TOKEN не знайдено'
    )
  }

  const response = await fetch(
    `${TMDB_BASE_URL}${endpoint}`,
    {
      method: 'GET',
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${TMDB_TOKEN}`,
      },
    }
  )

  if (!response.ok) {
    const errorText = await response.text()

    throw new Error(
      `TMDB_ERROR_${response.status}: ${errorText}`
    )
  }

  return response.json()
}

export async function searchMedia(query, lang = 'en') {
  const encodedQuery = encodeURIComponent(
    query.trim()
  )
  const tmdbLang = lang === 'uk' ? 'uk-UA' : 'en-US'

  const data = await tmdbRequest(
    `/search/multi?query=${encodedQuery}&language=${tmdbLang}&page=1&include_adult=false`
  )

  if (data.results) {
    data.results = data.results.filter(
      (item) => item.media_type === 'movie' || item.media_type === 'tv'
    )
  }

  return data
}

export async function getMediaDetails(id, mediaType = 'movie', lang = 'en') {
  const tmdbLang = lang === 'uk' ? 'uk-UA' : 'en-US'
  return tmdbRequest(
    `/${mediaType}/${id}?language=${tmdbLang}&append_to_response=credits`
  )
}

export async function getMediaVideos(id, mediaType = 'movie', lang = 'en') {
  const tmdbLang = lang === 'uk' ? 'uk-UA' : 'en-US'
  return tmdbRequest(
    `/${mediaType}/${id}/videos?language=${tmdbLang}`
  )
}

export async function getRandomMedia(lang = 'en', mode = 'popular') {
  const tmdbLang = lang === 'uk' ? 'uk-UA' : 'en-US'
  
  let allResults = []

  if (mode === 'popular') {
    // Тільки популярні з випадкових сторінок 1-10
    const randomPage = Math.floor(Math.random() * 10) + 1
    const [moviesResponse, tvResponse] = await Promise.all([
      tmdbRequest(`/movie/popular?language=${tmdbLang}&page=${randomPage}`),
      tmdbRequest(`/tv/popular?language=${tmdbLang}&page=${randomPage}`)
    ])
    
    allResults = [
      ...(moviesResponse.results || []).map(item => ({ ...item, media_type: 'movie' })),
      ...(tvResponse.results || []).map(item => ({ ...item, media_type: 'tv' }))
    ]
  } 
  else if (mode === 'all') {
    // З усіх категорій: popular, top_rated, now_playing, upcoming
    const categories = ['popular', 'top_rated', 'now_playing', 'upcoming']
    const randomCategory = categories[Math.floor(Math.random() * categories.length)]
    const randomPage = Math.floor(Math.random() * 5) + 1
    
    const [moviesResponse, tvResponse] = await Promise.all([
      tmdbRequest(`/movie/${randomCategory}?language=${tmdbLang}&page=${randomPage}`),
      tmdbRequest(`/tv/popular?language=${tmdbLang}&page=${randomPage}`)
    ])
    
    allResults = [
      ...(moviesResponse.results || []).map(item => ({ ...item, media_type: 'movie' })),
      ...(tvResponse.results || []).map(item => ({ ...item, media_type: 'tv' }))
    ]
  }

  // Перемішуємо та беремо 20 випадкових
  const shuffled = allResults.sort(() => 0.5 - Math.random())
  const randomResults = shuffled.slice(0, 20)

  return { results: randomResults }
}

export function getPosterUrl(
  posterPath,
  size = 'w500'
) {
  if (!posterPath) {
    return null
  }

  return `https://image.tmdb.org/t/p/${size}${posterPath}`
}

export function getBackdropUrl(
  backdropPath,
  size = 'original'
) {
  if (!backdropPath) {
    return null
  }

  return `https://image.tmdb.org/t/p/${size}${backdropPath}`
}

export function getTrailer(videos) {
  if (!videos?.results?.length) return null
  
  // Спочатку шукаємо офіційний трейлер на YouTube
  let trailer = videos.results.find(
    (video) => 
      video.site === 'YouTube' && 
      (video.type === 'Trailer' || video.type === 'Teaser') &&
      video.official === true
  )
  
  // Якщо немає офіційного, беремо будь-який трейлер на YouTube
  if (!trailer) {
    trailer = videos.results.find(
      (video) => 
        video.site === 'YouTube' && 
        (video.type === 'Trailer' || video.type === 'Teaser')
    )
  }
  
  // Якщо все ще немає, беремо будь-яке відео на YouTube
  if (!trailer) {
    trailer = videos.results.find(
      (video) => video.site === 'YouTube'
    )
  }
  
  return trailer
}