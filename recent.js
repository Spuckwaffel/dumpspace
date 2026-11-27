const PAGE_SIZE = 100;

const recentState = {
  type: 'all',
  query: '',
  limit: PAGE_SIZE,
};

const updatesHost = document.getElementById('updates');
const filterInput = document.getElementById('filter');
const typeFilter = document.getElementById('type-filter');

function dayLabel(seconds) {
  return new Date(seconds * 1000).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function clockLabel(seconds) {
  return new Date(seconds * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function filteredUpdates() {
  const query = recentState.query.trim().toLowerCase();

  return DS.recent.filter((update) => {
    if (recentState.type !== 'all' && update.type !== recentState.type) return false;

    if (!query) return true;

    return update.game.name.toLowerCase().includes(query) || update.uploader.toLowerCase().includes(query);
  });
}

function renderStats() {
  const monthAgo = Date.now() / 1000 - 2592000;

  const addedCount = DS.recent.filter((update) => update.type === 'Added').length;
  const lastMonthCount = DS.recent.filter((update) => update.uploaded >= monthAgo).length;
  const latest = DS.recent.length ? timeAgo(DS.recent[0].uploaded) : '—';

  const stats = [
    [DS.recent.length.toLocaleString(), 'updates'],
    [addedCount.toLocaleString(), 'games added'],
    [lastMonthCount.toLocaleString(), 'in the last 30 days'],
    [latest, 'latest update'],
  ];

  document.getElementById('stats').innerHTML = stats.map(([value, label]) => '<div><b>' + value + '</b><span>' + label + '</span></div>').join('');
}

function updateRowHtml(update, query) {
  const verb = update.type === 'Added' ? '<span class="verb-added">Added</span>' : '<span class="faint">Updated</span>';

  return (
    '<div class="update-row">' +
    '<span class="time">' + clockLabel(update.uploaded) + '</span>' +
    thumbHtml(update.game) +
    '<div style="min-width: 0"><a class="title stretched-link" href="' + escapeHtml(gameUrl(update.game)) + '">' + verb + ' <b>' + highlightMatch(update.game.name, query) + '</b></a>' +
    '<div class="meta">by ' + uploaderLinkHtml(update.uploader, update.uploaderLink, query) + '</div></div>' +
    '<div class="engine-cell"><span class="tag">' + escapeHtml(update.game.engine) + '</span></div></div>'
  );
}

function renderUpdates() {
  const updates = filteredUpdates();
  const query = recentState.query.trim().toLowerCase();

  if (!updates.length) {
    updatesHost.innerHTML = '<div class="empty">No updates match.</div>';
    return;
  }

  let html = '';
  let currentDay = null;

  for (const update of updates.slice(0, recentState.limit)) {
    const day = dayLabel(update.uploaded);

    if (day !== currentDay) {
      html += '<div class="day-heading">' + day + '</div>';
      currentDay = day;
    }

    html += updateRowHtml(update, query);
  }

  const remaining = updates.length - recentState.limit;

  if (remaining > 0) {
    html += '<div class="load-more"><button class="button" type="button" id="load-more">Show ' + Math.min(PAGE_SIZE, remaining) + ' more</button></div>';
  }

  updatesHost.innerHTML = html;
}

function bindEvents() {
  filterInput.addEventListener('input', () => {
    recentState.query = filterInput.value;
    recentState.limit = PAGE_SIZE;
    renderUpdates();
  });

  typeFilter.addEventListener('click', (event) => {
    const button = event.target.closest('[data-type]');
    if (!button) return;

    recentState.type = button.dataset.type;
    recentState.limit = PAGE_SIZE;

    for (const typeButton of typeFilter.querySelectorAll('[data-type]')) {
      typeButton.setAttribute('aria-pressed', String(typeButton === button));
    }

    renderUpdates();
  });

  updatesHost.addEventListener('click', (event) => {
    if (!event.target.closest('#load-more')) return;

    recentState.limit += PAGE_SIZE;
    renderUpdates();
  });
}

async function startRecent() {
  try {
    DS = await loadHomeData();
  } catch (error) {
    updatesHost.innerHTML = '<div class="empty">Couldn’t load updates: ' + escapeHtml(error.message) + '</div>';
    return;
  }

  bindEvents();

  renderStats();

  renderUpdates();
}

startRecent();
