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

export async function searchMovies(query) {
  const encodedQuery = encodeURIComponent(
    query.trim()
  )

  return tmdbRequest(
    `/search/movie?query=${encodedQuery}&language=en-US&page=1&include_adult=false`
  )
}

export async function getMovieDetails(movieId) {
  return tmdbRequest(
    `/movie/${movieId}?language=en-US&append_to_response=credits`
  )
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