const RENDER_BATCH_SIZE = 48;

const SORT_KEYS = ['updated', 'added', 'name', 'engine', 'uploader'];

const savedSort = localStorage.getItem('dumpspace-sort');

const homeState = {
  query: '',
  engine: null,
  uploader: null,
  sort: SORT_KEYS.includes(savedSort) ? savedSort : 'updated',
  view: localStorage.getItem('dumpspace-view') === 'grid' ? 'grid' : 'list',
  focused: -1,
};

let shownGames = [];
let renderToken = 0;

const searchInput = document.getElementById('search');
const gamesHost = document.getElementById('games');
const sortButton = document.getElementById('sort-button');
const sortOptions = document.getElementById('sort-options');

function setSortMenuOpen(open) {
  sortOptions.hidden = !open;
  sortButton.setAttribute('aria-expanded', String(open));

  if (open) sortOptions.querySelector('[aria-selected="true"]').focus();
}

function syncSortMenu() {
  for (const option of sortOptions.querySelectorAll('[data-sort]')) {
    const selected = option.dataset.sort === homeState.sort;
    option.setAttribute('aria-selected', String(selected));

    if (selected) sortButton.textContent = option.textContent;
  }
}

function filteredGames() {
  const query = homeState.query.trim().toLowerCase();

  let games = DS.games;

  if (homeState.engine) games = games.filter((game) => game.engine === homeState.engine);

  if (homeState.uploader) games = games.filter((game) => game.uploader === homeState.uploader);

  if (query) {
    games = games.filter((game) => game.name.toLowerCase().includes(query) || game.uploader.toLowerCase().includes(query));
  }

  const byName = (a, b) => a.name.localeCompare(b.name);
  const sorted = games.slice();

  if (homeState.sort === 'updated') sorted.sort((a, b) => b.uploaded - a.uploaded);

  if (homeState.sort === 'added') sorted.sort((a, b) => b.addedOrder - a.addedOrder);

  if (homeState.sort === 'name') sorted.sort(byName);

  if (homeState.sort === 'engine') {
    sorted.sort((a, b) => ENGINE_ORDER.indexOf(a.engine) - ENGINE_ORDER.indexOf(b.engine) || byName(a, b));
  }

  if (homeState.sort === 'uploader') sorted.sort((a, b) => a.uploader.localeCompare(b.uploader) || byName(a, b));

  return sorted;
}

function renderSidebar() {
  const engineCounts = {};
  for (const game of DS.games) engineCounts[game.engine] = (engineCounts[game.engine] || 0) + 1;

  const engineItems = [[null, 'All games', DS.games.length]].concat(
    ENGINE_ORDER.map((engine) => [engine, ENGINE_NAMES[engine], engineCounts[engine] || 0]),
  );

  document.getElementById('engines').innerHTML = engineItems
    .map(([engine, label, count]) => {
      const current = homeState.engine === engine && !homeState.uploader;

      return (
        '<button class="side-item" type="button" data-engine="' + (engine || '') + '" aria-current="' + current + '">' +
        '<span class="label">' + label + '</span><span class="count">' + count + '</span></button>'
      );
    })
    .join('');

  document.getElementById('contributors').innerHTML = DS.star
    .slice(0, 8)
    .map((contributor) => {
      const current = homeState.uploader === contributor.name;

      return (
        '<div class="side-row"><button class="side-item" type="button" data-uploader="' + escapeHtml(contributor.name) + '" aria-current="' + current + '">' +
        (contributor.avatar ? '<img class="avatar" src="' + escapeHtml(contributor.avatar) + '" alt="" loading="lazy">' : '<span class="avatar"></span>') +
        '<span class="label">' + escapeHtml(contributor.name) + '</span><span class="count">' + escapeHtml(contributor.count) + '</span></button>' +
        (contributor.url
          ? '<a class="side-link" href="' + escapeHtml(contributor.url) + '" target="_blank" rel="noopener" aria-label="' + escapeHtml(contributor.name) + ' on GitHub" title="GitHub profile">' + EXTERNAL_ICON + '</a>'
          : '') +
        '</div>'
      );
    })
    .join('');

  const latestUpload = Math.max(...DS.games.map((game) => game.uploaded));

  document.getElementById('stats').innerHTML =
    '<div class="sidebar-stats">' + DS.games.length + ' games across ' + ENGINE_ORDER.length + ' engines<br>' +
    'Last update ' + timeAgo(latestUpload) + '</div>' +
    '<div class="sidebar-credits"><span>Made with ♡ by Spuckwaffel</span><a href="legal.html">About &amp; legal</a></div>';
}

function renderHeader() {
  let title = 'All games';

  if (homeState.engine) title = ENGINE_NAMES[homeState.engine];

  if (homeState.uploader) title = 'Updated by ' + homeState.uploader;

  document.getElementById('library-title').textContent = title;
  document.getElementById('library-count').textContent = shownGames.length;

  for (const button of document.querySelectorAll('[data-view]')) {
    button.setAttribute('aria-pressed', String(button.dataset.view === homeState.view));
  }
}

function gameRowHtml(game, index, query) {
  const focused = index === homeState.focused ? ' data-focused' : '';

  return (
    '<div class="game-row" data-index="' + index + '"' + focused + '>' +
    thumbHtml(game) +
    '<div style="min-width: 0"><a class="name stretched-link" href="' + escapeHtml(gameUrl(game)) + '">' + highlightMatch(game.name, query) + '</a>' +
    '<div class="sub">' + uploaderLinkHtml(game.uploader, game.uploaderLink, query) + '</div></div>' +
    '<div class="engine-cell"><span class="tag">' + escapeHtml(game.engine) + '</span></div>' +
    '<div class="when">' + timeAgo(game.uploaded) + '</div></div>'
  );
}

function gameCardHtml(game, index, query) {
  return (
    '<div class="game-card" data-index="' + index + '">' +
    thumbHtml(game) +
    '<a class="name stretched-link" href="' + escapeHtml(gameUrl(game)) + '">' + highlightMatch(game.name, query) + '</a>' +
    '<div class="sub">' + uploaderLinkHtml(game.uploader, game.uploaderLink, query) +
    '<span class="num">' + escapeHtml(game.engine) + ' · ' + timeAgo(game.uploaded) + '</span></div></div>'
  );
}

function renderGames() {
  shownGames = filteredGames();

  if (homeState.focused >= shownGames.length) homeState.focused = shownGames.length - 1;

  renderHeader();

  const token = ++renderToken;

  if (!shownGames.length) {
    gamesHost.innerHTML = '<div class="empty">No games match “' + escapeHtml(homeState.query.trim()) + '”.</div>';
    return;
  }

  const query = homeState.query.trim().toLowerCase();
  const isGrid = homeState.view === 'grid';
  const itemHtml = isGrid ? gameCardHtml : gameRowHtml;

  gamesHost.innerHTML = '<div class="' + (isGrid ? 'game-grid' : 'game-list') + '"></div>';
  const container = gamesHost.firstChild;

  const appendBatch = (start) => {
    if (token !== renderToken) return;

    const end = Math.min(shownGames.length, start + RENDER_BATCH_SIZE);
    const batch = shownGames.slice(start, end).map((game, offset) => itemHtml(game, start + offset, query));

    container.insertAdjacentHTML('beforeend', batch.join(''));

    if (end < shownGames.length) requestAnimationFrame(() => appendBatch(end));
  };

  appendBatch(0);
}

function renderActivity() {
  const now = Date.now() / 1000;

  const groups = [
    ['Today', 86400],
    ['This week', 604800],
    ['This month', 2592000],
    ['Earlier', Infinity],
  ];

  let html = '';
  let currentGroup = null;

  for (const update of DS.recent.slice(0, 40)) {
    const age = now - update.uploaded;
    const group = groups.find(([, limit]) => age < limit)[0];

    if (group !== currentGroup) {
      html += '<div class="activity-group">' + group + '</div>';
      currentGroup = group;
    }

    const verb = update.type === 'Added' ? '<span class="verb-added">Added</span>' : '<span class="faint">Updated</span>';

    html +=
      '<div class="activity-item">' +
      thumbHtml(update.game) +
      '<div style="min-width: 0"><a class="title stretched-link" href="' + escapeHtml(gameUrl(update.game)) + '">' + verb + ' <b>' + escapeHtml(update.game.name) + '</b></a>' +
      '<div class="meta">' + uploaderLinkHtml(update.uploader, update.uploaderLink) + ' · ' + timeAgo(update.uploaded) + '</div></div></div>';
  }

  document.getElementById('activity').innerHTML = html;
}

function moveFocus(step) {
  if (homeState.view !== 'list' || !shownGames.length) return;

  homeState.focused = Math.min(shownGames.length - 1, Math.max(0, homeState.focused + step));

  for (const row of gamesHost.querySelectorAll('[data-focused]')) row.removeAttribute('data-focused');

  const row = gamesHost.querySelector('[data-index="' + homeState.focused + '"]');
  if (!row) return;

  row.setAttribute('data-focused', '');
  row.scrollIntoView({ block: 'nearest' });
}

function bindEvents() {
  searchInput.addEventListener('input', () => {
    homeState.query = searchInput.value;
    homeState.focused = -1;
    renderGames();
  });

  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveFocus(1);
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveFocus(-1);
    }

    if (event.key === 'Enter' && shownGames.length) {
      const game = shownGames[Math.max(0, homeState.focused)];
      location.href = gameUrl(game);
    }

    if (event.key === 'Escape') {
      searchInput.value = '';
      homeState.query = '';
      homeState.focused = -1;
      searchInput.blur();
      renderGames();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== '/' || isTyping(event)) return;

    event.preventDefault();
    searchInput.focus();
    searchInput.select();
  });

  document.querySelector('.sidebar').addEventListener('click', (event) => {
    const item = event.target.closest('.side-item');
    if (!item) return;

    if (item.dataset.uploader !== undefined) {
      homeState.uploader = homeState.uploader === item.dataset.uploader ? null : item.dataset.uploader;
      homeState.engine = null;
    } else {
      homeState.engine = item.dataset.engine || null;
      homeState.uploader = null;
    }

    homeState.focused = -1;
    renderSidebar();
    renderGames();
  });

  sortButton.addEventListener('click', () => setSortMenuOpen(sortOptions.hidden));

  sortButton.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown') return;

    event.preventDefault();
    setSortMenuOpen(true);
  });

  sortOptions.addEventListener('click', (event) => {
    const option = event.target.closest('[data-sort]');
    if (!option) return;

    homeState.sort = option.dataset.sort;
    localStorage.setItem('dumpspace-sort', homeState.sort);
    syncSortMenu();

    setSortMenuOpen(false);
    sortButton.focus();
    renderGames();
  });

  sortOptions.addEventListener('keydown', (event) => {
    const options = [...sortOptions.querySelectorAll('[data-sort]')];
    const index = options.indexOf(document.activeElement);

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      options[(index + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length].focus();
    }

    if (event.key === 'Escape' || event.key === 'Tab') {
      setSortMenuOpen(false);
      sortButton.focus();
    }
  });

  document.addEventListener('pointerdown', (event) => {
    if (sortOptions.hidden || event.target.closest('#sort-menu')) return;

    setSortMenuOpen(false);

    const swallowClick = (clickEvent) => {
      clickEvent.preventDefault();
      clickEvent.stopPropagation();
    };

    document.addEventListener('click', swallowClick, { capture: true, once: true });
    document.addEventListener('pointerup', () => setTimeout(() => document.removeEventListener('click', swallowClick, true)), { once: true });
  });

  document.querySelector('.segmented').addEventListener('click', (event) => {
    const button = event.target.closest('[data-view]');
    if (!button) return;

    homeState.view = button.dataset.view;
    localStorage.setItem('dumpspace-view', homeState.view);
    renderGames();
  });
}

async function startHome() {
  try {
    DS = await loadHomeData();
  } catch (error) {
    gamesHost.innerHTML = '<div class="empty">Couldn’t load games: ' + escapeHtml(error.message) + '</div>';
    return;
  }

  bindEvents();

  syncSortMenu();

  renderSidebar();

  enableHorizontalStrip(document.querySelector('.sidebar'));

  renderGames();

  renderActivity();
}

startHome();
