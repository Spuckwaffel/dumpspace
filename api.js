const hashSearch = document.getElementById('hash-search');
const hashResults = document.getElementById('hash-results');

let apiGames = [];

function renderHashResults() {
  const query = hashSearch.value.trim().toLowerCase();

  if (!query) {
    hashResults.innerHTML = '';
    return;
  }

  const matches = apiGames.filter((game) => game.name.toLowerCase().includes(query)).slice(0, 6);

  if (!matches.length) {
    hashResults.innerHTML = '<div class="empty" style="padding: 16px">No games match.</div>';
    return;
  }

  hashResults.innerHTML = matches
    .map(
      (game) =>
        '<div class="hash-row">' + thumbHtml(game) +
        '<a class="name" href="' + escapeHtml(gameUrl(game)) + '">' + highlightMatch(game.name, query) + '</a>' +
        '<span class="mono muted">' + escapeHtml(game.hash) + '</span>' +
        '<button class="button" type="button" data-copy-hash="' + escapeHtml(game.hash) + '">Copy DSAPI</button></div>',
    )
    .join('');
}

function bindEvents() {
  hashSearch.addEventListener('input', renderHashResults);

  document.addEventListener('click', (event) => {
    const hashButton = event.target.closest('[data-copy-hash]');
    if (hashButton) {
      copyText('DSAPI api = DSAPI("' + hashButton.dataset.copyHash + '");', 'Copied');
      return;
    }

    const codeButton = event.target.closest('[data-copy]');
    if (codeButton) copyText(codeButton.parentElement.querySelector('pre').textContent, 'Copied code');
  });
}

async function startApi() {
  bindEvents();

  try {
    const gameList = await dsJson(DS_DATA_ROOT + 'Games/GameList.json');
    apiGames = dsGameList(gameList);
  } catch (error) {
    hashSearch.disabled = true;
    hashSearch.placeholder = 'Couldn’t load games: ' + error.message;
    return;
  }

  renderHashResults();
}

startApi();
