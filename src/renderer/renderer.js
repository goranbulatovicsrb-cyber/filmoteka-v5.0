/* ═══════════════════════════════════════════════════════
   FILMOTEKA — Renderer (v2)
   ═══════════════════════════════════════════════════════ */

const state = {
  movies: [], series: [], settings: { apiKey: '' },
  view: 'collection', filter: 'all', sort: 'title', search: '',
  editingId: null, editingSeries: null, scanResults: [],
  curtainOpen: false, filterPanelOpen: false,
  filters: { genres: [], ratingMin: 0, yearMin: 1900, watched: 'all' }
}

// ── Init ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  state.settings = await api.loadSettings()
  const all = await api.loadMovies()
  state.movies = all.filter(m => !m.isSeries)
  state.series = all.filter(m => m.isSeries)
  updateCounts()
  renderShelves()
  api.onMaximized(v => { document.getElementById('btn-maximize').textContent = v ? '❐' : '□' })
})

// ══════════════════════════════════════════════════════════
// CURTAIN
// ══════════════════════════════════════════════════════════
function openCurtain() {
  if (state.curtainOpen) return
  state.curtainOpen = true
  const curtain = document.getElementById('curtain')
  const app = document.getElementById('app')
  curtain.classList.add('opening')
  const flash = document.createElement('div')
  flash.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(255,240,180,0);pointer-events:none;transition:background 0.4s ease'
  document.body.appendChild(flash)
  setTimeout(() => { flash.style.background = 'rgba(255,240,180,0.12)' }, 600)
  setTimeout(() => { flash.style.background = 'rgba(255,240,180,0)' }, 1200)
  setTimeout(() => {
    curtain.style.display = 'none'; flash.remove()
    app.classList.remove('app-hidden'); app.classList.add('app-visible')
  }, 2600)
}

// ══════════════════════════════════════════════════════════
// VIEW SWITCHING
// ══════════════════════════════════════════════════════════
function setView(view, btn) {
  state.view = view
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'))
  if (btn) btn.classList.add('active')
  document.getElementById('nav-subfilters').style.display = view === 'collection' ? 'flex' : 'none'
  document.getElementById('btn-filter-toggle').style.display = (view === 'collection' || view === 'wishlist') ? 'flex' : 'none'
  if (view !== 'collection' && view !== 'wishlist') {
    state.filterPanelOpen = false
    document.getElementById('filter-panel').style.display = 'none'
  }
  document.getElementById('view-collection').style.display = 'none'
  document.getElementById('view-wishlist').style.display   = 'none'
  document.getElementById('view-series').style.display     = 'none'
  document.getElementById('view-dashboard').style.display  = 'none'
  if (view === 'collection') { document.getElementById('view-collection').style.display = 'block'; renderShelves() }
  if (view === 'wishlist')   { document.getElementById('view-wishlist').style.display   = 'block'; renderWishlist() }
  if (view === 'series')     { document.getElementById('view-series').style.display     = 'block'; renderSeries() }
  if (view === 'dashboard')  { document.getElementById('view-dashboard').style.display  = 'block'; renderDashboard() }
}

// ══════════════════════════════════════════════════════════
// FILTER PANEL
// ══════════════════════════════════════════════════════════
function toggleFilterPanel() {
  state.filterPanelOpen = !state.filterPanelOpen
  const panel = document.getElementById('filter-panel')
  panel.style.display = state.filterPanelOpen ? 'flex' : 'none'
  if (state.filterPanelOpen) buildFilterChips()
}

function buildFilterChips() {
  const genres = new Set()
  state.movies.forEach(m => { if (m.genre) m.genre.split(',').forEach(g => genres.add(g.trim())) })
  const container = document.getElementById('filter-genre-chips')
  container.innerHTML = ''
  Array.from(genres).sort().forEach(g => {
    const chip = document.createElement('span')
    chip.className = 'chip' + (state.filters.genres.includes(g) ? ' active' : '')
    chip.textContent = g
    chip.onclick = () => toggleGenreFilter(g, chip)
    container.appendChild(chip)
  })
  // Set watched chips
  document.querySelectorAll('.chip[data-watched]').forEach(c => {
    c.classList.toggle('active', c.dataset.watched === state.filters.watched)
  })
}

function toggleGenreFilter(genre, chip) {
  const idx = state.filters.genres.indexOf(genre)
  if (idx === -1) state.filters.genres.push(genre)
  else state.filters.genres.splice(idx, 1)
  chip.classList.toggle('active', state.filters.genres.includes(genre))
  if (state.view === 'wishlist') renderWishlist()
  else renderShelves()
}

function onFilterRating() {
  const val = parseFloat(document.getElementById('filter-rating-min').value)
  state.filters.ratingMin = val
  document.getElementById('filter-rating-label').textContent = val === 0 ? 'Sve ocjene' : `≥ ${val}`
  if (state.view === 'wishlist') renderWishlist(); else renderShelves()
}

function onFilterYear() {
  const val = parseInt(document.getElementById('filter-year-min').value)
  state.filters.yearMin = val
  document.getElementById('filter-year-label').textContent = val === 1900 ? 'Sve godine' : `od ${val}`
  if (state.view === 'wishlist') renderWishlist(); else renderShelves()
}

function setWatchedFilter(val, el) {
  state.filters.watched = val
  document.querySelectorAll('.chip[data-watched]').forEach(c => c.classList.toggle('active', c.dataset.watched === val))
  if (state.view === 'wishlist') renderWishlist(); else renderShelves()
}

function resetFilters() {
  state.filters = { genres: [], ratingMin: 0, yearMin: 1900, watched: 'all' }
  state.search = ''
  document.getElementById('search-input').value = ''
  document.getElementById('filter-rating-min').value = 0
  document.getElementById('filter-year-min').value = 1900
  document.getElementById('filter-rating-label').textContent = 'Sve ocjene'
  document.getElementById('filter-year-label').textContent = 'Sve godine'
  buildFilterChips()
  if (state.view === 'wishlist') renderWishlist()
  else renderShelves()
  toast('Filteri resetovani', 'info')
}

// ══════════════════════════════════════════════════════════
// COLLECTION SHELVES
// ══════════════════════════════════════════════════════════
function getFilteredMovies() {
  return state.movies
    .filter(m => !m.isWishlist)
    .filter(m => state.filter === 'all' || m.category === state.filter)
    .filter(m => !state.search || m.title.toLowerCase().includes(state.search.toLowerCase()))
    .filter(m => state.filters.genres.length === 0 || state.filters.genres.some(g => (m.genre||'').includes(g)))
    .filter(m => (parseFloat(m.imdbRating)||0) >= state.filters.ratingMin)
    .filter(m => (parseInt(m.year)||0) >= state.filters.yearMin)
    .filter(m => {
      if (state.filters.watched === 'watched')   return m.watched
      if (state.filters.watched === 'unwatched') return !m.watched
      return true
    })
    .sort((a,b) => {
      if (state.sort === 'rating')   return (parseFloat(b.imdbRating)||0) - (parseFloat(a.imdbRating)||0)
      if (state.sort === 'myrating') return (parseInt(b.myRating)||0) - (parseInt(a.myRating)||0)
      if (state.sort === 'year')     return (parseInt(b.year)||0) - (parseInt(a.year)||0)
      if (state.sort === 'date')     return (b.dateAdded||'').localeCompare(a.dateAdded||'')
      return a.title.localeCompare(b.title)
    })
}

function renderShelves() {
  const container = document.getElementById('shelves-container')
  const empty     = document.getElementById('empty-state')
  const movies    = getFilteredMovies()
  if (!container) return
  if (movies.length === 0) { container.innerHTML=''; empty.style.display='flex'; return }
  empty.style.display = 'none'
  const perShelf = Math.max(4, Math.floor((window.innerWidth - 50) / 136))
  container.innerHTML = ''
  for (let i = 0; i < movies.length; i += perShelf) {
    container.appendChild(buildShelf(movies.slice(i, i + perShelf)))
  }
}

function buildShelf(movies) {
  const shelf = document.createElement('div'); shelf.className = 'shelf'
  const row   = document.createElement('div'); row.className = 'shelf-movies'
  movies.forEach((m,i) => row.appendChild(buildCard(m,i)))
  const board = document.createElement('div'); board.className = 'shelf-board'
  shelf.appendChild(row); shelf.appendChild(board)
  return shelf
}

function buildCard(movie, idx) {
  const card = document.createElement('div')
  card.className = 'movie-card'; card.style.animationDelay = `${idx*50}ms`
  const hasPoster = movie.poster && movie.poster !== 'N/A' && (movie.poster.startsWith('http') || movie.poster.startsWith('data:'))
  const initial   = (movie.title||'?').charAt(0).toUpperCase()
  const rating    = movie.imdbRating && movie.imdbRating !== 'N/A' ? movie.imdbRating : ''
  const myRating  = movie.myRating ? `Moja: ${movie.myRating}/10` : ''

  card.innerHTML = `
    <div class="movie-poster">
      ${hasPoster
        ? `<img src="${esc(movie.poster)}" alt="${esc(movie.title)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'poster-placeholder\\'><div class=\\'placeholder-initial\\'>${esc(initial)}</div><div class=\\'placeholder-title\\'>${esc(movie.title)}</div></div>'">`
        : `<div class="poster-placeholder"><div class="placeholder-initial">${esc(initial)}</div><div class="placeholder-title">${esc(movie.title)}</div></div>`}
      ${movie.watched     ? '<div class="watched-badge">✓</div>'  : ''}
      ${movie.isWishlist  ? '<div class="wishlist-badge">⭐</div>' : ''}
      <div class="movie-overlay">
        ${rating   ? `<div class="overlay-rating">⭐ ${esc(rating)}</div>` : ''}
        ${myRating ? `<div class="overlay-myrating">🎯 ${esc(myRating)}</div>` : ''}
        ${movie.drive ? `<div class="overlay-drive">💾 ${esc(movie.drive)}</div>` : ''}
        <div class="overlay-actions">
          <button class="overlay-btn" onclick="event.stopPropagation();openDetail('${movie.id}')">Info</button>
          <button class="overlay-btn" onclick="event.stopPropagation();editMovie('${movie.id}')">✏</button>
          <button class="overlay-btn del" onclick="event.stopPropagation();deleteMovie('${movie.id}')">✕</button>
        </div>
      </div>
    </div>
    <div class="movie-info">
      <div class="movie-title">${esc(movie.title)}</div>
      <div class="movie-meta">${movie.year ? esc(movie.year) : ''} ${movie.category === 'domaci' ? '🏠' : '🌍'}</div>
    </div>`

  card.addEventListener('click', () => openDetail(movie.id))
  return card
}

// ══════════════════════════════════════════════════════════
// WISHLIST
// ══════════════════════════════════════════════════════════
function renderWishlist() {
  const container = document.getElementById('wishlist-container')
  const empty     = document.getElementById('empty-wishlist')
  const movies    = state.movies.filter(m => m.isWishlist)
    .filter(m => !state.search || m.title.toLowerCase().includes(state.search.toLowerCase()))
    .sort((a,b) => a.title.localeCompare(b.title))

  if (!container) return
  if (movies.length === 0) { container.innerHTML=''; empty.style.display='flex'; return }
  empty.style.display = 'none'
  const perShelf = Math.max(4, Math.floor((window.innerWidth - 50) / 136))
  container.innerHTML = ''
  for (let i = 0; i < movies.length; i += perShelf) {
    container.appendChild(buildShelf(movies.slice(i, i + perShelf)))
  }
}

// ══════════════════════════════════════════════════════════
// SERIES
// ══════════════════════════════════════════════════════════
function renderSeries() {
  const container = document.getElementById('series-container')
  const empty     = document.getElementById('empty-series')
  const items     = state.series
    .filter(s => !state.search || s.title.toLowerCase().includes(state.search.toLowerCase()))
    .sort((a,b) => a.title.localeCompare(b.title))

  if (!container) return
  if (items.length === 0) { container.innerHTML=''; empty.style.display='flex'; return }
  empty.style.display = 'none'
  container.innerHTML = ''
  items.forEach((s,i) => {
    const card = document.createElement('div')
    card.className = 'series-card'; card.style.animationDelay = `${i*40}ms`
    const hasPoster = s.poster && s.poster !== 'N/A' && (s.poster.startsWith('http') || s.poster.startsWith('data:'))
    const seasonsHtml = (s.seasons||[]).map((sea,idx) => {
      const cls = sea.watched ? 'watched' : sea.watching ? 'watching' : ''
      return `<span class="season-pill ${cls}">S${idx+1}${sea.epCount ? ` (${sea.watchedEp||0}/${sea.epCount})` : ''}</span>`
    }).join('')
    card.innerHTML = `
      <div class="series-poster">
        ${hasPoster ? `<img src="${esc(s.poster)}" alt="${esc(s.title)}">` : '📺'}
      </div>
      <div class="series-info">
        <div class="series-title">${esc(s.title)}</div>
        <div class="series-meta">
          <span>${esc(s.year||'')}</span>
          ${s.imdbRating && s.imdbRating!=='N/A' ? `<span>⭐ ${esc(s.imdbRating)}</span>` : ''}
          ${s.genre ? `<span>${esc(s.genre)}</span>` : ''}
          ${s.drive ? `<span>💾 ${esc(s.drive)}</span>` : ''}
          ${s.watching ? '<span style="color:var(--gold)">▶ Gledam</span>' : ''}
          ${s.watched  ? '<span style="color:var(--green)">✓ Kompletno</span>' : ''}
        </div>
        <div class="series-seasons">${seasonsHtml || '<span style="font-size:11px;color:var(--text3)">Nema sezona</span>'}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0">
        <button class="nav-btn" onclick="event.stopPropagation();editSeries('${s.id}')" style="font-size:11px;padding:5px 8px">✏</button>
        <button class="nav-btn btn-danger" onclick="event.stopPropagation();deleteSeries('${s.id}')" style="font-size:11px;padding:5px 8px">✕</button>
      </div>`
    container.appendChild(card)
  })
}

// ══════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════
function renderDashboard() {
  const movies  = state.movies
  const watched = movies.filter(m => m.watched).length
  const rated   = movies.filter(m => m.imdbRating && m.imdbRating !== 'N/A')
  const avgRating = rated.length ? (rated.reduce((s,m) => s+(parseFloat(m.imdbRating)||0),0)/rated.length).toFixed(1) : '–'
  const totalMin  = movies.reduce((s,m) => { const n=parseInt((m.runtime||'0').replace(/[^0-9]/g,'')); return s+(isNaN(n)?0:n) },0)
  const totalH    = Math.round(totalMin/60)

  // Stat cards
  document.getElementById('dash-stats').innerHTML = `
    <div class="dash-stat"><div class="dash-stat-value">${movies.filter(m=>!m.isWishlist).length}</div><div class="dash-stat-label">Ukupno filmova</div></div>
    <div class="dash-stat"><div class="dash-stat-value">${watched}</div><div class="dash-stat-label">Gledano</div><div class="dash-stat-sub">${movies.length ? Math.round(watched/movies.length*100) : 0}%</div></div>
    <div class="dash-stat"><div class="dash-stat-value">${state.movies.filter(m=>m.isWishlist).length}</div><div class="dash-stat-label">Wishlist</div></div>
    <div class="dash-stat"><div class="dash-stat-value">${state.series.length}</div><div class="dash-stat-label">Serije</div></div>
    <div class="dash-stat"><div class="dash-stat-value">${avgRating}</div><div class="dash-stat-label">Prosjek IMDB</div></div>
    <div class="dash-stat"><div class="dash-stat-value">${totalH > 0 ? totalH+'h' : '–'}</div><div class="dash-stat-label">Ukupno trajanje</div><div class="dash-stat-sub">${totalH > 24 ? Math.round(totalH/24)+' dana' : ''}</div></div>
    <div class="dash-stat"><div class="dash-stat-value">${movies.filter(m=>m.category==='domaci').length}</div><div class="dash-stat-label">Domaći filmovi</div></div>
    <div class="dash-stat"><div class="dash-stat-value">${movies.filter(m=>m.category==='strani').length}</div><div class="dash-stat-label">Strani filmovi</div></div>
  `

  // Chart: decades
  const decades = {}
  movies.forEach(m => { const y=parseInt(m.year); if(!isNaN(y)){const d=Math.floor(y/10)*10; decades[d]=(decades[d]||0)+1} })
  renderBarChart('chart-decades', Object.entries(decades).sort((a,b)=>a[0]-b[0]).map(([d,c])=>[d+'s',c]), 'gold')

  // Chart: genres
  const genres = {}
  movies.forEach(m => { (m.genre||'').split(',').map(g=>g.trim()).filter(Boolean).forEach(g => { genres[g]=(genres[g]||0)+1 }) })
  renderBarChart('chart-genres', Object.entries(genres).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([g,c])=>[g,c]), 'blue')

  // Chart: ratings distribution
  const ratingBuckets = {'1-3':0,'4-5':0,'6-7':0,'7-8':0,'8-9':0,'9-10':0}
  movies.forEach(m => { const r=parseFloat(m.imdbRating); if(!isNaN(r)){
    if(r<4)ratingBuckets['1-3']++; else if(r<6)ratingBuckets['4-5']++;
    else if(r<7)ratingBuckets['6-7']++; else if(r<8)ratingBuckets['7-8']++;
    else if(r<9)ratingBuckets['8-9']++; else ratingBuckets['9-10']++
  }})
  renderBarChart('chart-ratings', Object.entries(ratingBuckets).map(([k,v])=>[k,v]), 'green')

  // Chart: directors
  const dirs = {}
  movies.forEach(m => { if(m.director&&m.director!=='N/A')m.director.split(',').forEach(d=>{ const t=d.trim(); if(t)dirs[t]=(dirs[t]||0)+1 }) })
  renderBarChart('chart-directors', Object.entries(dirs).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([d,c])=>[d,c]), 'gold')

  // Chart: drives
  const drives = {}
  movies.forEach(m => { if(m.drive){const k=m.drive.replace(/\\.*/,'').trim()||m.drive.substring(0,15); drives[k]=(drives[k]||0)+1} })
  renderBarChart('chart-drives', Object.entries(drives).sort((a,b)=>b[1]-a[1]).map(([d,c])=>[d,c]), 'blue')

  pickRandomMovie()
}

function renderBarChart(containerId, data, color) {
  const container = document.getElementById(containerId)
  if (!container) return
  const max = Math.max(...data.map(([,v])=>v), 1)
  container.innerHTML = data.length === 0
    ? '<div style="font-size:12px;color:var(--text3);padding:8px">Nema podataka</div>'
    : data.map(([label, val]) => `
      <div class="bar-row">
        <div class="bar-label" title="${esc(label)}">${esc(label)}</div>
        <div class="bar-track">
          <div class="bar-fill ${color}" style="width:${Math.round(val/max*100)}%"></div>
        </div>
        <div class="bar-count">${val}</div>
      </div>`).join('')
}

function pickRandomMovie() {
  const watchable = state.movies.filter(m => !m.watched && !m.isWishlist)
  const pool = watchable.length > 0 ? watchable : state.movies.filter(m=>!m.isWishlist)
  const box = document.getElementById('random-movie-box')
  if (!box) return
  if (pool.length === 0) { box.innerHTML = '<div class="random-empty">Nema filmova u kolekciji</div>'; return }
  const m = pool[Math.floor(Math.random() * pool.length)]
  const hasPoster = m.poster && m.poster !== 'N/A' && (m.poster.startsWith('http')||m.poster.startsWith('data:'))
  box.innerHTML = `
    ${hasPoster ? `<img class="random-poster" src="${esc(m.poster)}" alt="">` : '<div class="random-poster" style="display:flex;align-items:center;justify-content:center;font-size:28px">🎬</div>'}
    <div class="random-info">
      <div class="random-title">${esc(m.title)}</div>
      <div class="random-meta">
        ${m.year ? esc(m.year) : ''} ${m.genre ? '· '+esc(m.genre) : ''}
        ${m.imdbRating&&m.imdbRating!=='N/A' ? ' · ⭐ '+esc(m.imdbRating) : ''}
        ${m.runtime ? ' · '+esc(m.runtime) : ''}
      </div>
      ${m.plot ? `<div style="font-size:11px;color:var(--text2);margin-top:6px;line-height:1.5;max-height:48px;overflow:hidden">${esc(m.plot)}</div>` : ''}
    </div>`
}

// ══════════════════════════════════════════════════════════
// ADD / EDIT MOVIE MODAL
// ══════════════════════════════════════════════════════════
function openAddModal(forWishlist = false) {
  state.editingId = null
  clearAddForm()
  document.getElementById('modal-add-title').textContent = forWishlist ? '⭐ Dodaj na Wishlist' : '＋ Dodaj film'
  document.getElementById('f-wishlist').checked = forWishlist
  openModal('modal-add')
}

function editMovie(id) {
  const m = state.movies.find(x => x.id === id)
  if (!m) return
  state.editingId = id
  clearAddForm()
  document.getElementById('modal-add-title').textContent = '✏ Uredi film'
  document.getElementById('f-title').value     = m.title    || ''
  document.getElementById('f-year').value      = m.year     || ''
  document.getElementById('f-category').value  = m.category || 'strani'
  document.getElementById('f-rating').value    = m.imdbRating && m.imdbRating !== 'N/A' ? m.imdbRating : ''
  document.getElementById('f-myrating').value  = m.myRating || ''
  document.getElementById('f-runtime').value   = m.runtime  || ''
  document.getElementById('f-drive').value     = m.drive    || ''
  document.getElementById('f-filename').value  = m.filename || ''
  document.getElementById('f-genre').value     = m.genre    || ''
  document.getElementById('f-director').value  = m.director || ''
  document.getElementById('f-plot').value      = m.plot     || ''
  document.getElementById('f-watched').checked = m.watched  || false
  document.getElementById('f-wishlist').checked= m.isWishlist || false
  document.getElementById('f-imdbid').value    = m.imdbId   || ''
  document.getElementById('omdb-search-input').value = m.title || ''
  const posterVal = (m.poster && m.poster !== 'N/A') ? m.poster : ''
  document.getElementById('f-poster').value = posterVal.startsWith('data:') ? '' : posterVal
  document.getElementById('f-poster-base64').value = posterVal.startsWith('data:') ? posterVal : ''
  if (posterVal) setPosterPreview(posterVal)
  openModal('modal-add')
}

function clearAddForm() {
  ;['f-title','f-year','f-rating','f-myrating','f-runtime','f-drive','f-filename','f-genre','f-director','f-poster','f-plot','f-imdbid','f-poster-base64','omdb-search-input','omdb-year-input']
    .forEach(id => { const el = document.getElementById(id); if(el) el.value = '' })
  document.getElementById('f-category').value = 'strani'
  document.getElementById('f-watched').checked  = false
  document.getElementById('f-wishlist').checked  = false
  document.getElementById('omdb-status').textContent = ''
  document.getElementById('omdb-results').style.display = 'none'
  resetPosterPreview()
}

function saveMovie() {
  const title = document.getElementById('f-title').value.trim()
  if (!title) { toast('Unesite naziv filma', 'error'); return }
  const b64  = document.getElementById('f-poster-base64').value
  const url  = document.getElementById('f-poster').value.trim()
  const movie = {
    id:         state.editingId || genId(),
    title, isSeries: false,
    year:       document.getElementById('f-year').value.trim(),
    category:   document.getElementById('f-category').value,
    imdbRating: document.getElementById('f-rating').value.trim() || 'N/A',
    myRating:   document.getElementById('f-myrating').value.trim() || '',
    runtime:    document.getElementById('f-runtime').value.trim(),
    drive:      document.getElementById('f-drive').value.trim(),
    filename:   document.getElementById('f-filename').value.trim(),
    genre:      document.getElementById('f-genre').value.trim(),
    director:   document.getElementById('f-director').value.trim(),
    poster:     b64 || url || 'N/A',
    plot:       document.getElementById('f-plot').value.trim(),
    watched:    document.getElementById('f-watched').checked,
    isWishlist: document.getElementById('f-wishlist').checked,
    imdbId:     document.getElementById('f-imdbid').value.trim(),
    dateAdded:  state.editingId ? (state.movies.find(m=>m.id===state.editingId)?.dateAdded||today()) : today()
  }
  if (state.editingId) {
    const idx = state.movies.findIndex(m => m.id === state.editingId)
    if (idx !== -1) state.movies[idx] = movie
    toast('Film ažuriran ✓', 'success')
  } else {
    state.movies.push(movie)
    toast('Film dodat ✓', 'success')
  }
  persist(); updateCounts()
  if (state.view === 'collection') renderShelves()
  else if (state.view === 'wishlist') renderWishlist()
  closeModal('modal-add')
}

function deleteMovie(id) {
  const m = state.movies.find(x => x.id === id)
  if (!m || !confirm(`Brisati "${m.title}"?`)) return
  state.movies = state.movies.filter(x => x.id !== id)
  persist(); updateCounts()
  renderShelves(); renderWishlist()
  toast('Film obrisan', 'info')
}

function toggleWatched(id) {
  const m = state.movies.find(x => x.id === id)
  if (!m) return
  m.watched = !m.watched
  persist(); renderShelves(); renderWishlist()
  closeModal('modal-detail')
  toast(m.watched ? '✓ Označeno kao gledano' : 'Označeno kao negledano', 'info')
}

// ══════════════════════════════════════════════════════════
// SERIES MODAL
// ══════════════════════════════════════════════════════════
function openSeriesModal() {
  state.editingSeries = null
  clearSeriesForm()
  document.getElementById('modal-series-title').textContent = '📺 Dodaj seriju'
  openModal('modal-series')
}

function editSeries(id) {
  const s = state.series.find(x => x.id === id)
  if (!s) return
  state.editingSeries = id
  clearSeriesForm()
  document.getElementById('modal-series-title').textContent = '✏ Uredi seriju'
  document.getElementById('s-title').value    = s.title    || ''
  document.getElementById('s-year').value     = s.year     || ''
  document.getElementById('s-rating').value   = s.imdbRating && s.imdbRating !== 'N/A' ? s.imdbRating : ''
  document.getElementById('s-myrating').value = s.myRating || ''
  document.getElementById('s-seasons').value  = s.seasons?.length || ''
  document.getElementById('s-drive').value    = s.drive    || ''
  document.getElementById('s-genre').value    = s.genre    || ''
  document.getElementById('s-plot').value     = s.plot     || ''
  document.getElementById('s-watched').checked   = s.watched  || false
  document.getElementById('s-watching').checked  = s.watching || false
  document.getElementById('s-imdbid').value   = s.imdbId   || ''
  const posterVal = (s.poster && s.poster !== 'N/A') ? s.poster : ''
  document.getElementById('s-poster').value = posterVal.startsWith('data:') ? '' : posterVal
  document.getElementById('s-poster-base64').value = posterVal.startsWith('data:') ? posterVal : ''
  if (posterVal) { document.getElementById('s-poster-preview-img').src=posterVal; document.getElementById('s-poster-preview-img').style.display='block'; document.getElementById('s-poster-preview-empty').style.display='none' }
  if (s.seasons?.length) buildSeasonInputs(s.seasons)
  openModal('modal-series')
}

function clearSeriesForm() {
  ;['s-title','s-year','s-rating','s-myrating','s-seasons','s-drive','s-genre','s-plot','s-imdbid','s-poster','s-poster-base64','s-omdb-input']
    .forEach(id => { const el=document.getElementById(id); if(el)el.value='' })
  document.getElementById('s-watched').checked  = false
  document.getElementById('s-watching').checked = false
  document.getElementById('s-omdb-status').textContent = ''
  document.getElementById('s-omdb-results').style.display = 'none'
  document.getElementById('season-inputs-wrap').innerHTML = ''
  document.getElementById('s-poster-preview-img').style.display = 'none'
  document.getElementById('s-poster-preview-empty').style.display = 'flex'
}

function buildSeasonInputs(existingSeasons) {
  const n = parseInt(document.getElementById('s-seasons').value) || 0
  const wrap = document.getElementById('season-inputs-wrap')
  if (n === 0 || n > 30) { wrap.innerHTML=''; return }
  wrap.innerHTML = `<div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--text2);margin-bottom:8px">Sezone</div>`
  for (let i = 0; i < n; i++) {
    const ex = existingSeasons?.[i] || {}
    const row = document.createElement('div'); row.className = 'season-input-row'
    row.innerHTML = `
      <label>Sezona ${i+1}</label>
      <input type="number" class="season-ep-input" id="s-ep-${i}" placeholder="Ep." min="1" value="${ex.epCount||''}" style="width:60px">
      <input type="number" class="season-ep-input" id="s-wep-${i}" placeholder="Gledano" min="0" value="${ex.watchedEp||''}" style="width:80px">
      <label class="checkbox-label"><input type="checkbox" id="s-ws-${i}" ${ex.watched?'checked':''}> ✓</label>
    `
    wrap.appendChild(row)
  }
}

function saveSeries() {
  const title = document.getElementById('s-title').value.trim()
  if (!title) { toast('Unesite naziv serije', 'error'); return }
  const n = parseInt(document.getElementById('s-seasons').value) || 0
  const seasons = []
  for (let i = 0; i < n; i++) {
    seasons.push({
      epCount:   parseInt(document.getElementById(`s-ep-${i}`)?.value)  || 0,
      watchedEp: parseInt(document.getElementById(`s-wep-${i}`)?.value) || 0,
      watched:   document.getElementById(`s-ws-${i}`)?.checked || false,
      watching:  false
    })
  }
  const b64 = document.getElementById('s-poster-base64').value
  const url = document.getElementById('s-poster').value.trim()
  const series = {
    id:         state.editingSeries || genId(),
    isSeries:   true, title,
    year:       document.getElementById('s-year').value.trim(),
    imdbRating: document.getElementById('s-rating').value.trim() || 'N/A',
    myRating:   document.getElementById('s-myrating').value.trim() || '',
    drive:      document.getElementById('s-drive').value.trim(),
    genre:      document.getElementById('s-genre').value.trim(),
    plot:       document.getElementById('s-plot').value.trim(),
    watched:    document.getElementById('s-watched').checked,
    watching:   document.getElementById('s-watching').checked,
    imdbId:     document.getElementById('s-imdbid').value.trim(),
    poster:     b64 || url || 'N/A',
    seasons,
    dateAdded:  today()
  }
  if (state.editingSeries) {
    const idx = state.series.findIndex(s => s.id === state.editingSeries)
    if (idx !== -1) state.series[idx] = series
    toast('Serija ažurirana ✓', 'success')
  } else {
    state.series.push(series)
    toast('Serija dodana ✓', 'success')
  }
  persist(); updateCounts(); renderSeries()
  closeModal('modal-series')
}

function deleteSeries(id) {
  const s = state.series.find(x => x.id === id)
  if (!s || !confirm(`Brisati seriju "${s.title}"?`)) return
  state.series = state.series.filter(x => x.id !== id)
  persist(); updateCounts(); renderSeries()
  toast('Serija obrisana', 'info')
}

// ══════════════════════════════════════════════════════════
// SERIES OMDB
// ══════════════════════════════════════════════════════════
async function fetchSeriesOmdb() {
  const title = document.getElementById('s-omdb-input').value.trim()
  if (!title || !state.settings.apiKey) { toast('Unesite naziv i API ključ', 'error'); return }
  const statusEl  = document.getElementById('s-omdb-status')
  const resultsEl = document.getElementById('s-omdb-results')
  statusEl.textContent = '⏳ Pretražujem...'
  statusEl.className   = 'omdb-status loading'
  resultsEl.style.display = 'none'

  const multi = await api.searchOmdbMulti({ title, apiKey: state.settings.apiKey })
  if (multi?.Search?.length > 0) {
    resultsEl.innerHTML = ''
    resultsEl.style.display = 'flex'
    multi.Search.slice(0,5).forEach(item => {
      const div = document.createElement('div'); div.className = 'omdb-result-item'
      div.innerHTML = `${item.Poster&&item.Poster!=='N/A'?`<img src="${esc(item.Poster)}" onerror="this.style.display='none'">`:''}<div class="omdb-result-info"><div class="omdb-result-title">${esc(item.Title)}</div><div class="omdb-result-meta">${esc(item.Year)} · ${esc(item.Type)}</div></div>`
      div.addEventListener('click', async () => {
        const r = await api.searchOmdbId({ imdbId: item.imdbID, apiKey: state.settings.apiKey })
        if (r?.Response === 'True') {
          document.getElementById('s-title').value   = r.Title    || ''
          document.getElementById('s-year').value    = r.Year     || ''
          document.getElementById('s-rating').value  = r.imdbRating&&r.imdbRating!=='N/A'?r.imdbRating:''
          document.getElementById('s-genre').value   = r.Genre    || ''
          document.getElementById('s-plot').value    = r.Plot     || ''
          document.getElementById('s-imdbid').value  = r.imdbID   || ''
          if (r.Poster&&r.Poster!=='N/A') {
            document.getElementById('s-poster').value = r.Poster
            document.getElementById('s-poster-preview-img').src = r.Poster
            document.getElementById('s-poster-preview-img').style.display = 'block'
            document.getElementById('s-poster-preview-empty').style.display = 'none'
          }
          if (r.totalSeasons) document.getElementById('s-seasons').value = r.totalSeasons
          resultsEl.style.display = 'none'
          statusEl.textContent = `✓ ${r.Title}`; statusEl.className = 'omdb-status success'
        }
      })
      resultsEl.appendChild(div)
    })
    statusEl.textContent = `Pronađeno ${multi.Search.length}`; statusEl.className = 'omdb-status success'
  } else {
    statusEl.textContent = '✗ Nije pronađeno'; statusEl.className = 'omdb-status error'
  }
}

function onSeriesPosterChange(input) {
  const file = input.files?.[0]; if (!file) return
  const reader = new FileReader()
  reader.onload = e => {
    document.getElementById('s-poster-base64').value = e.target.result
    document.getElementById('s-poster').value = ''
    document.getElementById('s-poster-preview-img').src = e.target.result
    document.getElementById('s-poster-preview-img').style.display = 'block'
    document.getElementById('s-poster-preview-empty').style.display = 'none'
  }
  reader.readAsDataURL(file); input.value = ''
}
function onSeriesPosterUrl(url) {
  document.getElementById('s-poster-base64').value = ''
  if (url?.startsWith('http')) { document.getElementById('s-poster-preview-img').src=url; document.getElementById('s-poster-preview-img').style.display='block'; document.getElementById('s-poster-preview-empty').style.display='none' }
}

// ══════════════════════════════════════════════════════════
// DETAIL MODAL
// ══════════════════════════════════════════════════════════
function openDetail(id) {
  const m = state.movies.find(x => x.id === id)
  if (!m) return
  const hasPoster = m.poster && m.poster !== 'N/A' && (m.poster.startsWith('http')||m.poster.startsWith('data:'))
  const rating = m.imdbRating && m.imdbRating !== 'N/A' ? m.imdbRating : '–'
  document.getElementById('modal-detail-content').innerHTML = `
    <div class="detail-layout">
      <div class="detail-poster">
        ${hasPoster ? `<img src="${esc(m.poster)}" alt="${esc(m.title)}">` : `<div style="width:170px;height:252px;border-radius:8px;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:48px">🎬</div>`}
      </div>
      <div class="detail-info">
        <div class="detail-title">${esc(m.title)}</div>
        <div class="detail-year">${esc(m.year||'')} · ${m.category==='domaci'?'🏠 Domaći':'🌍 Strani'}</div>
        <div class="detail-rating-bar">
          <div class="detail-imdb">⭐ ${esc(rating)}</div>
          <div class="detail-imdb-label">IMDB</div>
          ${m.myRating ? `<div class="detail-imdb" style="background:rgba(100,180,255,0.2);color:#74b9ff">🎯 ${esc(m.myRating)}/10</div><div class="detail-imdb-label">Moja ocjena</div>` : ''}
          ${m.watched   ? '<div class="detail-imdb" style="background:rgba(46,204,113,0.2);color:#2ecc71">✓ Gledano</div>' : ''}
          ${m.isWishlist? '<div class="detail-imdb" style="background:rgba(245,197,24,0.2);color:var(--gold)">⭐ Wishlist</div>' : ''}
        </div>
        <div class="detail-meta-grid">
          ${m.genre    ?`<div class="detail-meta-item span2"><label>Žanr</label><span>${esc(m.genre)}</span></div>`:''}
          ${m.runtime  ?`<div class="detail-meta-item"><label>Trajanje</label><span>${esc(m.runtime)}</span></div>`:''}
          ${m.director ?`<div class="detail-meta-item"><label>Reditelj</label><span>${esc(m.director)}</span></div>`:''}
          ${m.language ?`<div class="detail-meta-item"><label>Jezik</label><span>${esc(m.language)}</span></div>`:''}
          ${m.country  ?`<div class="detail-meta-item"><label>Zemlja</label><span>${esc(m.country)}</span></div>`:''}
          ${m.drive    ?`<div class="detail-meta-item span2"><label>Lokacija</label><span>💾 ${esc(m.drive)}</span></div>`:''}
          ${m.filename ?`<div class="detail-meta-item span2"><label>Fajl</label><span style="font-size:10px;color:var(--text2)">${esc(m.filename)}</span></div>`:''}
          ${m.awards   ?`<div class="detail-meta-item span2"><label>Nagrade</label><span style="font-size:11px">${esc(m.awards)}</span></div>`:''}
        </div>
        ${m.plot?`<div class="detail-plot">${esc(m.plot)}</div>`:''}
        <div class="detail-actions">
          <button class="nav-btn" onclick="editMovie('${m.id}');closeModal('modal-detail')">✏ Uredi</button>
          <button class="nav-btn" onclick="toggleWatched('${m.id}')">${m.watched?'○ Negledano':'✓ Gledano'}</button>
          ${m.drive?`<button class="nav-btn" onclick="api.openInExplorer('${esc(m.drive)}')">📁 Otvori</button>`:''}
          <button class="nav-btn btn-danger" onclick="deleteMovie('${m.id}');closeModal('modal-detail')">🗑 Briši</button>
        </div>
      </div>
    </div>`
  openModal('modal-detail')
}

// ══════════════════════════════════════════════════════════
// OMDB (movies)
// ══════════════════════════════════════════════════════════
async function fetchOmdb() {
  const title = document.getElementById('omdb-search-input').value.trim()
  const year  = document.getElementById('omdb-year-input').value.trim()
  if (!title) { toast('Unesite naziv', 'error'); return }
  if (!state.settings.apiKey) { toast('Unesite API ključ u ⚙ Postavke', 'error'); return }
  const statusEl  = document.getElementById('omdb-status')
  const resultsEl = document.getElementById('omdb-results')
  const btn       = document.getElementById('omdb-fetch-btn')
  statusEl.textContent = '⏳ Pretražujem IMDB...'; statusEl.className = 'omdb-status loading'
  resultsEl.style.display = 'none'; btn.disabled = true

  const multi = await api.searchOmdbMulti({ title, apiKey: state.settings.apiKey })
  if (multi?.Search?.length > 0) {
    resultsEl.innerHTML = ''; resultsEl.style.display = 'flex'
    multi.Search.slice(0,6).forEach(item => {
      const div = document.createElement('div'); div.className = 'omdb-result-item'
      div.innerHTML = `${item.Poster&&item.Poster!=='N/A'?`<img src="${esc(item.Poster)}" onerror="this.style.display='none'">`:''}<div class="omdb-result-info"><div class="omdb-result-title">${esc(item.Title)}</div><div class="omdb-result-meta">${esc(item.Year)} · ${esc(item.Type)}</div></div>`
      div.addEventListener('click', () => fetchOmdbById(item.imdbID))
      resultsEl.appendChild(div)
    })
    statusEl.textContent = `Pronađeno ${multi.Search.length} rezultata`; statusEl.className = 'omdb-status success'
  } else {
    const r = await api.searchOmdb({ title, year, apiKey: state.settings.apiKey })
    if (r?.Response === 'True') { fillFormFromOmdb(r); statusEl.textContent = `✓ ${r.Title}`; statusEl.className = 'omdb-status success' }
    else { statusEl.textContent = '✗ Nije pronađeno na IMDB'; statusEl.className = 'omdb-status error' }
  }
  btn.disabled = false
}

async function fetchOmdbById(imdbId) {
  const statusEl = document.getElementById('omdb-status')
  statusEl.textContent = '⏳ Učitavam...'; statusEl.className = 'omdb-status loading'
  const r = await api.searchOmdbId({ imdbId, apiKey: state.settings.apiKey })
  if (r?.Response === 'True') {
    fillFormFromOmdb(r)
    document.getElementById('omdb-results').style.display = 'none'
    statusEl.textContent = `✓ Podaci preuzeti: ${r.Title}`; statusEl.className = 'omdb-status success'
  } else { statusEl.textContent = '✗ Greška'; statusEl.className = 'omdb-status error' }
}

function fillFormFromOmdb(data) {
  document.getElementById('f-title').value    = data.Title    || ''
  document.getElementById('f-year').value     = data.Year     || ''
  document.getElementById('f-rating').value   = data.imdbRating&&data.imdbRating!=='N/A'?data.imdbRating:''
  document.getElementById('f-runtime').value  = data.Runtime  || ''
  document.getElementById('f-genre').value    = data.Genre    || ''
  document.getElementById('f-director').value = data.Director || ''
  document.getElementById('f-plot').value     = data.Plot     || ''
  document.getElementById('f-imdbid').value   = data.imdbID   || ''
  document.getElementById('omdb-search-input').value = data.Title || ''
  const poster = data.Poster && data.Poster !== 'N/A' ? data.Poster : ''
  document.getElementById('f-poster').value = poster
  document.getElementById('f-poster-base64').value = ''
  if (poster) { setPosterPreview(poster); setPosterStatus('✓ Poster preuzet sa IMDB-a','success') }
  else { resetPosterPreview(); setPosterStatus('⚠ Poster nije na IMDB — postavi vlastiti','') }
}

// ══════════════════════════════════════════════════════════
// POSTER HELPERS
// ══════════════════════════════════════════════════════════
function setPosterPreview(src) {
  const img=document.getElementById('poster-preview-img'), empty=document.getElementById('poster-preview-empty')
  if(img){img.src=src;img.style.display='block'};if(empty)empty.style.display='none'
}
function resetPosterPreview() {
  const img=document.getElementById('poster-preview-img'),empty=document.getElementById('poster-preview-empty')
  if(img){img.src='';img.style.display='none'};if(empty)empty.style.display='flex'
  setPosterStatus('','')
}
function setPosterStatus(msg,type) {
  const el=document.getElementById('poster-status'); if(!el)return
  el.textContent=msg
  el.style.color=type==='success'?'#2ecc71':type==='warn'?'#f39c12':type==='error'?'#e74c3c':'var(--text3)'
}
function onPosterUrlChange(url) {
  document.getElementById('f-poster-base64').value=''
  if(url?.startsWith('http')){setPosterPreview(url);setPosterStatus('','')}
  else if(!url)resetPosterPreview()
}
function onPosterFileChange(input) {
  const file=input.files?.[0]; if(!file)return
  const reader=new FileReader()
  reader.onload=e=>{
    document.getElementById('f-poster-base64').value=e.target.result
    document.getElementById('f-poster').value=''
    setPosterPreview(e.target.result); setPosterStatus('✓ Vlastita slika uploadovana','success')
  }
  reader.readAsDataURL(file); input.value=''
}

// ══════════════════════════════════════════════════════════
// SCAN FOLDER
// ══════════════════════════════════════════════════════════
function openScanModal() {
  document.getElementById('scan-path').value = ''
  document.getElementById('scan-drive').value = ''
  document.getElementById('scan-list').innerHTML = ''
  document.getElementById('scan-footer').style.display = 'none'
  document.getElementById('scan-progress-bar').style.display = 'none'
  document.getElementById('scan-start-btn').disabled = false
  state.scanResults = []
  openModal('modal-scan')
}

async function pickScanFolder() {
  const folder = await api.openFolderDialog()
  if (folder) {
    document.getElementById('scan-path').value = folder
    const m = folder.match(/^([A-Za-z]:)/); if(m&&!document.getElementById('scan-drive').value) document.getElementById('scan-drive').value=m[1]
  }
}

async function startScan() {
  const folderPath = document.getElementById('scan-path').value.trim()
  if (!folderPath) { toast('Odaberite folder', 'error'); return }
  const category      = document.getElementById('scan-category').value
  const drive         = document.getElementById('scan-drive').value.trim()
  const skipExisting  = document.getElementById('scan-skip-existing').checked
  const fetchOmdbData = document.getElementById('scan-fetch-omdb').checked && state.settings.apiKey
  const btn = document.getElementById('scan-start-btn'); btn.disabled = true

  const result = await api.scanFolder(folderPath)
  if (result.error) { toast(`Greška: ${result.error}`, 'error'); btn.disabled=false; return }

  let files = result.files || []
  if (skipExisting) {
    const existing = new Set(state.movies.map(m=>m.filename?.toLowerCase()))
    files = files.filter(f=>!existing.has(f.toLowerCase()))
  }
  if (files.length === 0) { toast('Nema novih video fajlova', 'info'); btn.disabled=false; return }

  const progressBar  = document.getElementById('scan-progress-bar')
  const progressFill = document.getElementById('scan-progress-fill')
  const progressText = document.getElementById('scan-progress-text')
  const progressPct  = document.getElementById('scan-progress-pct')
  const listEl       = document.getElementById('scan-list')
  progressBar.style.display='block'; listEl.innerHTML=''; state.scanResults=[]

  for (let i=0; i<files.length; i++) {
    const file=files[i], parsed=parseFilename(file)
    progressFill.style.width=Math.round((i+1)/files.length*100)+'%'
    progressPct.textContent=Math.round((i+1)/files.length*100)+'%'
    progressText.textContent=`Skeniranje: ${file}`
    const item=document.createElement('div'); item.className='scan-item loading'; item.id=`si-${i}`
    item.innerHTML=`<div class="scan-item-status">⏳</div><div class="scan-item-info"><div class="scan-item-title">${esc(parsed.title)}</div><div class="scan-item-meta">${esc(parsed.year||'')} · ${esc(file)}</div></div>`
    listEl.appendChild(item); listEl.scrollTop=listEl.scrollHeight

    let movieData={id:genId(),title:parsed.title,year:parsed.year||'',category,drive,filename:file,poster:'N/A',imdbRating:'N/A',dateAdded:today(),watched:false,isSeries:false}

    if (fetchOmdbData) {
      await sleep(300)
      const omdb=await api.searchOmdb({title:parsed.title,year:parsed.year,apiKey:state.settings.apiKey})
      if (omdb?.Response==='True') {
        movieData={...movieData,title:omdb.Title||parsed.title,year:omdb.Year||parsed.year,imdbRating:omdb.imdbRating||'N/A',runtime:omdb.Runtime||'',genre:omdb.Genre||'',director:omdb.Director||'',poster:omdb.Poster!=='N/A'?omdb.Poster:'N/A',plot:omdb.Plot||'',imdbId:omdb.imdbID||'',language:omdb.Language||'',country:omdb.Country||'',imdbVotes:omdb.imdbVotes||'',awards:omdb.Awards||''}
        item.className='scan-item found'
        item.innerHTML=`${omdb.Poster&&omdb.Poster!=='N/A'?`<img src="${esc(omdb.Poster)}" onerror="this.style.display='none'">`:''}<div class="scan-item-info"><div class="scan-item-title">${esc(movieData.title)}</div><div class="scan-item-meta">${esc(movieData.year)} · ⭐ ${esc(movieData.imdbRating)}</div></div><div class="scan-item-status">✅</div>`
      } else {
        item.className='scan-item notfound'
        item.innerHTML=`<div class="scan-item-status">⚠</div><div class="scan-item-info"><div class="scan-item-title">${esc(parsed.title)}</div><div class="scan-item-meta">Nije na IMDB · ${esc(file)}</div></div>`
      }
    } else { item.className='scan-item found'; item.querySelector('.scan-item-status').textContent='✓' }

    state.scanResults.push(movieData)
  }

  progressText.textContent='Skeniranje završeno!'
  document.getElementById('scan-summary').textContent=`${state.scanResults.length} filmova`
  document.getElementById('scan-footer').style.display='flex'; btn.disabled=false
}

function addScannedMovies() {
  if (!state.scanResults.length) return
  state.movies.push(...state.scanResults)
  persist(); updateCounts(); renderShelves()
  closeModal('modal-scan')
  toast(`${state.scanResults.length} filmova dodano ✓`, 'success')
  state.scanResults=[]
}

function parseFilename(filename) {
  let name=filename.replace(/\.[^.]+$/,'')
  const yearMatch=name.match(/[\[(]?((?:19|20)\d{2})[\])]?/)
  const year=yearMatch?yearMatch[1]:''
  if (yearMatch) name=name.slice(0,yearMatch.index)
  name=name.replace(/\b(?:1080[pi]|720[pi]|4[Kk]|BluRay|BDRip|BRRip|DVDRip|WEBRip|WEB[-.]?DL|HEVC|x26[45]|h\.?26[45]|XviD|DivX|YIFY|YTS|RARBG|FGT|AAC|AC3|DTS|Atmos)\b.*/gi,'')
  name=name.replace(/[._]/g,' ').replace(/^[-–\s[\]()]+|[-–\s[\]()]+$/g,'').replace(/\s{2,}/g,' ').trim()
  return { title:name||filename, year }
}

// ══════════════════════════════════════════════════════════
// EXPORT
// ══════════════════════════════════════════════════════════
function openExportModal() {
  document.getElementById('export-status').textContent = ''
  openModal('modal-export')
}

async function doExportCsv() {
  const all = [...state.movies, ...state.series]
  const headers = ['Naziv','Godina','Kategorija','IMDB ocjena','Moja ocjena','Trajanje','Žanr','Reditelj','Hard disk','Fajl','Gledano','Wishlist','Radnja','IMDB ID']
  const rows = all.map(m => [
    m.title, m.year, m.isSeries?'Serija':(m.category==='domaci'?'Domaći':'Strani'),
    m.imdbRating||'', m.myRating||'', m.runtime||'', m.genre||'', m.director||'',
    m.drive||'', m.filename||'', m.watched?'Da':'Ne', m.isWishlist?'Da':'Ne',
    (m.plot||'').replace(/"/g,"'"), m.imdbId||''
  ].map(v => `"${v}"`).join(','))
  const csv = [headers.join(','), ...rows].join('\r\n')
  const statusEl = document.getElementById('export-status')
  statusEl.style.color = 'var(--gold)'; statusEl.textContent = '⏳ Snimam fajl...'
  const r = await api.exportCsv(csv)
  if (r.ok) { statusEl.style.color='#2ecc71'; statusEl.textContent=`✓ Snimljeno: ${r.path}`; toast('CSV exportovan ✓','success') }
  else { statusEl.style.color='#e74c3c'; statusEl.textContent=r.error||'Greška' }
}

async function doExportPdf() {
  const statusEl = document.getElementById('export-status')
  statusEl.style.color='var(--gold)'; statusEl.textContent='⏳ Generiram PDF...'
  const movies = state.movies.filter(m=>!m.isWishlist)
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; background:#fff; color:#111; padding:20px; }
  h1 { font-size:26px; text-align:center; margin-bottom:4px; letter-spacing:3px; }
  .sub { text-align:center; font-size:12px; color:#666; margin-bottom:20px; }
  .section-title { font-size:14px; font-weight:bold; margin:18px 0 8px; padding:6px 10px; background:#f0f0f0; border-left:4px solid #c9a227; }
  table { width:100%; border-collapse:collapse; margin-bottom:16px; font-size:11px; }
  th { background:#1a1a2e; color:#f5c518; padding:7px 8px; text-align:left; font-size:10px; letter-spacing:0.5px; }
  td { padding:6px 8px; border-bottom:1px solid #eee; vertical-align:top; }
  tr:nth-child(even) td { background:#f9f9f9; }
  .rating { font-weight:bold; color:#c9a227; }
  .watched { color:#27ae60; font-weight:bold; }
  .footer { text-align:center; font-size:10px; color:#999; margin-top:20px; padding-top:10px; border-top:1px solid #eee; }
</style></head><body>
<h1>🎬 FILMOTEKA</h1>
<div class="sub">Kolekcija filmova · Exportovano ${new Date().toLocaleDateString('bs')} · Ukupno: ${movies.length} filmova</div>
<div class="section-title">🌍 Strani filmovi (${movies.filter(m=>m.category==='strani').length})</div>
<table><tr><th>#</th><th>Naziv</th><th>Godina</th><th>Ocjena</th><th>Trajanje</th><th>Žanr</th><th>Reditelj</th><th>Hard disk</th><th>Status</th></tr>
${movies.filter(m=>m.category==='strani').map((m,i)=>`<tr><td>${i+1}</td><td><b>${esc(m.title)}</b></td><td>${esc(m.year||'')}</td><td class="rating">${esc(m.imdbRating||'–')}</td><td>${esc(m.runtime||'')}</td><td>${esc(m.genre||'')}</td><td>${esc(m.director||'')}</td><td style="font-size:9px">${esc(m.drive||'')}</td><td class="${m.watched?'watched':''}">${m.watched?'✓ Gledan':'○'}</td></tr>`).join('')}
</table>
<div class="section-title">🏠 Domaći filmovi (${movies.filter(m=>m.category==='domaci').length})</div>
<table><tr><th>#</th><th>Naziv</th><th>Godina</th><th>Ocjena</th><th>Trajanje</th><th>Žanr</th><th>Reditelj</th><th>Hard disk</th><th>Status</th></tr>
${movies.filter(m=>m.category==='domaci').map((m,i)=>`<tr><td>${i+1}</td><td><b>${esc(m.title)}</b></td><td>${esc(m.year||'')}</td><td class="rating">${esc(m.imdbRating||'–')}</td><td>${esc(m.runtime||'')}</td><td>${esc(m.genre||'')}</td><td>${esc(m.director||'')}</td><td style="font-size:9px">${esc(m.drive||'')}</td><td class="${m.watched?'watched':''}">${m.watched?'✓ Gledan':'○'}</td></tr>`).join('')}
</table>
${state.series.length>0?`<div class="section-title">📺 Serije (${state.series.length})</div><table><tr><th>#</th><th>Naziv</th><th>Godine</th><th>Ocjena</th><th>Sezone</th><th>Status</th></tr>${state.series.map((s,i)=>`<tr><td>${i+1}</td><td><b>${esc(s.title)}</b></td><td>${esc(s.year||'')}</td><td class="rating">${esc(s.imdbRating||'–')}</td><td>${s.seasons?.length||0}</td><td class="${s.watched?'watched':''}">${s.watched?'✓ Kompletno':s.watching?'▶ Gledam':'○'}</td></tr>`).join('')}</table>`:''}
<div class="footer">Filmoteka Cinema Catalog · ${new Date().getFullYear()}</div>
</body></html>`

  const r = await api.exportPdf(html)
  if (r.ok) { statusEl.style.color='#2ecc71'; statusEl.textContent=`✓ PDF otvoren`; toast('PDF exportovan ✓','success') }
  else { statusEl.style.color='#e74c3c'; statusEl.textContent=r.error||'Greška' }
}

async function doExportJson() {
  const statusEl = document.getElementById('export-status')
  const all = [...state.movies, ...state.series]
  const json = JSON.stringify(all, null, 2)
  const blob = new Blob([json], {type:'application/json'})
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a'); a.href=url; a.download=`filmoteka-backup-${today()}.json`; a.click()
  URL.revokeObjectURL(url)
  statusEl.style.color='#2ecc71'; statusEl.textContent='✓ JSON backup preuzet'
  toast('JSON backup preuzet ✓','success')
}

// ══════════════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════════════
function openSettingsModal() { document.getElementById('settings-apikey').value=state.settings.apiKey||''; openModal('modal-settings') }
async function saveSettings() {
  state.settings.apiKey=document.getElementById('settings-apikey').value.trim()
  await api.saveSettings(state.settings); closeModal('modal-settings'); toast('Postavke sačuvane ✓','success')
}

// ══════════════════════════════════════════════════════════
// NAV HELPERS
// ══════════════════════════════════════════════════════════
function setFilter(filter, btn) {
  state.filter = filter
  document.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'))
  if (btn) btn.classList.add('active')
  renderShelves()
}
function setSort(val) { state.sort=val; renderShelves() }
function onSearch(val) {
  state.search = val
  if (state.view==='collection') renderShelves()
  else if (state.view==='wishlist') renderWishlist()
  else if (state.view==='series') renderSeries()
}
function updateCounts() {
  const films = state.movies.filter(m=>!m.isWishlist)
  document.getElementById('count-all').textContent    = films.length
  document.getElementById('count-wish').textContent   = state.movies.filter(m=>m.isWishlist).length
  document.getElementById('count-series').textContent = state.series.length
  document.getElementById('count-domaci').textContent = films.filter(m=>m.category==='domaci').length
  document.getElementById('count-strani').textContent = films.filter(m=>m.category==='strani').length
  const rated = films.filter(m=>m.imdbRating&&m.imdbRating!=='N/A')
  const avg = rated.length?(rated.reduce((s,m)=>s+(parseFloat(m.imdbRating)||0),0)/rated.length).toFixed(1):'–'
  document.getElementById('titlebar-stats').textContent = `${films.length} filmova · ⭐ Prosjek ${avg} · ${state.series.length} serija`
}

// ══════════════════════════════════════════════════════════
// MODAL HELPERS
// ══════════════════════════════════════════════════════════
function openModal(id) { document.getElementById(id).style.display='flex' }
function closeModal(id, event) {
  if (event && event.target !== document.getElementById(id)) return
  document.getElementById(id).style.display='none'
}
document.addEventListener('keydown', e => {
  if (e.key==='Escape') { ['modal-add','modal-series','modal-detail','modal-scan','modal-export','modal-settings'].forEach(id=>{ const el=document.getElementById(id); if(el&&el.style.display!=='none')el.style.display='none' }); if(!state.curtainOpen)openCurtain() }
})

// ══════════════════════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════════════════════
function genId() { return Date.now().toString(36)+Math.random().toString(36).slice(2,7) }
function today() { return new Date().toISOString().slice(0,10) }
function sleep(ms) { return new Promise(r=>setTimeout(r,ms)) }
function esc(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;') }
async function persist() { await api.saveMovies([...state.movies,...state.series]) }
function openLink(url) { const a=document.createElement('a');a.href=url;a.click() }
function toast(msg,type='info') {
  const c=document.getElementById('toast-container'),d=document.createElement('div')
  d.className=`toast ${type}`;d.textContent=msg;c.appendChild(d);setTimeout(()=>d.remove(),3500)
}
window.addEventListener('resize', () => { if(state.curtainOpen&&state.view==='collection')renderShelves() })

// Expose globals
Object.assign(window, {
  openCurtain, setView, setFilter, setSort, onSearch,
  toggleFilterPanel, onFilterRating, onFilterYear, setWatchedFilter, resetFilters,
  openAddModal, editMovie, deleteMovie, saveMovie, toggleWatched, openDetail,
  openSeriesModal, editSeries, deleteSeries, saveSeries, fetchSeriesOmdb, buildSeasonInputs,
  onSeriesPosterChange, onSeriesPosterUrl,
  fetchOmdb, openScanModal, pickScanFolder, startScan, addScannedMovies,
  openExportModal, doExportCsv, doExportPdf, doExportJson,
  openSettingsModal, saveSettings, closeModal, openLink,
  onPosterUrlChange, onPosterFileChange, pickRandomMovie
})
