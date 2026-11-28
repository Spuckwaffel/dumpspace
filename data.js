let DS = null;

const DS_ENGINES = {
  'Unreal-Engine-5': 'UE5',
  'Unreal-Engine-4': 'UE4',
  'Unreal-Engine-3': 'UE3',
  Unity: 'Unity',
};

const DS_REPO = 'Spuckwaffel/dumpspace';
const DS_DATA_ROOT = 'https://raw.githubusercontent.com/' + DS_REPO + '/refs/heads/main/';

const DS_FILES = {
  classes: 'ClassesInfo.json.gz',
  structs: 'StructsInfo.json.gz',
  functions: 'FunctionsInfo.json.gz',
  enums: 'EnumsInfo.json.gz',
  offsets: 'OffsetsInfo.json.gz',
};

async function dsFetch(path) {
  const response = await fetch(path);

  if (!response.ok) {
    const error = new Error(path + ' returned HTTP ' + response.status);
    error.status = response.status;
    throw error;
  }

  return response;
}

async function dsJson(path) {
  const response = await dsFetch(path);

  return response.json();
}

async function dsGzipJson(path) {
  const response = await dsFetch(path);
  const text = await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).text();

  return JSON.parse(text);
}

const DS_HASH_PATTERN = /^[0-9a-f]{4,64}$/i;
const DS_SHA_PATTERN = /^[0-9a-f]{7,40}$/i;

function dsIsSha(value) {
  return typeof value === 'string' && DS_SHA_PATTERN.test(value);
}

function dsSafeUrl(value) {
  if (typeof value !== 'string' || !value) return '';

  try {
    const url = new URL(value);

    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

function dsNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function dsText(value) {
  return typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
}

function dsType(type) {
  if (!Array.isArray(type)) return ['?', 'D', '', []];

  const subtypes = Array.isArray(type[3]) ? type[3].map(dsType) : [];

  return [dsText(type[0]), dsText(type[1]), dsText(type[2]), subtypes];
}

function dsLookup(entries) {
  const lookup = Object.create(null);

  for (const [name, value] of entries) lookup[name] = value;

  return lookup;
}

function dsEntries(data, normalize) {
  const entries = [];

  for (const entry of data) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;

    const name = Object.keys(entry)[0];
    if (name === undefined) continue;

    const value = normalize(entry[name]);
    if (value !== null) entries.push([name, value]);
  }

  entries.sort((a, b) => a[0].localeCompare(b[0]));

  return dsLookup(entries);
}

function dsMemberValue(value) {
  if (!Array.isArray(value)) return null;

  const member = [dsType(value[0]), dsNumber(value[1]), dsNumber(value[2]), value.length > 3 ? dsNumber(value[3]) : 1];

  if (value.length > 4) member.push(dsNumber(value[4]));

  return member;
}

function dsMembers(members, isLegacyBitfields) {
  if (!Array.isArray(members)) return null;

  const normalized = [];

  for (const member of members) {
    if (!member || typeof member !== 'object' || Array.isArray(member)) continue;

    const memberName = Object.keys(member)[0];
    if (memberName === undefined) continue;

    const value = member[memberName];

    if (memberName === '__InheritInfo') {
      normalized.push({ __InheritInfo: Array.isArray(value) ? value.map(dsText) : [] });
      continue;
    }

    if (memberName === '__MDKClassSize') {
      normalized.push({ __MDKClassSize: dsNumber(value) });
      continue;
    }

    const bitfieldName = isLegacyBitfields ? /^(.*?)\s*:\s*\d+$/.exec(memberName) : null;

    if (bitfieldName && Array.isArray(value)) {
      normalized.push({ [bitfieldName[1]]: [dsType(value[0]), dsNumber(value[1]), dsNumber(value[2]), 1, dsNumber(value[3])] });
      continue;
    }

    const memberValue = dsMemberValue(value);
    if (memberValue) normalized.push({ [memberName]: memberValue });
  }

  return normalized;
}

function dsFunctions(functions) {
  if (!Array.isArray(functions)) return null;

  return functions
    .filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry) && Object.keys(entry).length)
    .map((entry) => {
      const name = Object.keys(entry)[0];
      const value = Array.isArray(entry[name]) ? entry[name] : [];
      const parameters = Array.isArray(value[1]) ? value[1] : [];

      return {
        [name]: [
          dsType(value[0]),
          parameters.filter(Array.isArray).map((parameter) => [dsType(parameter[0]), dsText(parameter[1]), dsText(parameter[2])]),
          dsNumber(value[2]),
          dsText(value[3]),
        ],
      };
    });
}

function dsEnum(value) {
  if (!Array.isArray(value) || !Array.isArray(value[0])) return null;

  const values = value[0]
    .filter((item) => item && typeof item === 'object' && !Array.isArray(item) && Object.keys(item).length)
    .map((item) => {
      const name = Object.keys(item)[0];

      return { [name]: dsNumber(item[name]) };
    });

  return [values, dsText(value[1])];
}

function dsIsSafeSegment(segment) {
  return typeof segment === 'string' && segment.length > 0 && !/[\/\\?#%\u0000-\u001f]/.test(segment) && !segment.startsWith('.');
}

function dsGame(game) {
  if (!game || typeof game !== 'object') return null;

  if (typeof game.hash !== 'string' || !DS_HASH_PATTERN.test(game.hash)) return null;

  if (!Object.hasOwn(DS_ENGINES, game.engine) || !dsIsSafeSegment(game.location)) return null;

  const uploader = game.uploader && typeof game.uploader === 'object' ? game.uploader : {};

  return {
    hash: game.hash,
    name: dsText(game.name),
    engine: DS_ENGINES[game.engine],
    uploaded: Math.floor(dsNumber(game.uploaded) / 1000),
    uploader: dsText(uploader.name),
    uploaderLink: dsSafeUrl(uploader.link),
    directory: 'Games/' + game.engine + '/' + game.location + '/',
  };
}

function dsGameList(gameList) {
  const listed = gameList && Array.isArray(gameList.games) ? gameList.games : [];
  const games = [];

  listed.forEach((listedGame, index) => {
    const game = dsGame(listedGame);
    if (game) games.push({ ...game, addedOrder: index });
  });

  return games;
}

async function loadHomeData() {
  const [gameList, starboard, updates] = await Promise.all([
    dsJson(DS_DATA_ROOT + 'Games/GameList.json'),
    dsJson(DS_DATA_ROOT + 'Games/Starboard.json'),
    dsJson(DS_DATA_ROOT + 'Recent/GameUpdates.json'),
  ]);

  const games = dsGameList(gameList);
  const gamesByHash = new Map(games.map((game) => [game.hash, game]));

  const star = (Array.isArray(starboard) ? starboard : [])
    .filter((contributor) => contributor && typeof contributor === 'object')
    .map((contributor) => ({
      name: dsText(contributor.name),
      count: dsNumber(contributor.count),
      url: dsSafeUrl(contributor.url),
      avatar: dsSafeUrl(contributor.aurl),
    }))
    .sort((a, b) => b.count - a.count);

  const updateList = updates && Array.isArray(updates.updates) ? updates.updates : [];

  const recent = updateList
    .filter((update) => update && gamesByHash.has(update.hash))
    .map((update) => {
      const uploader = update.uploader && typeof update.uploader === 'object' ? update.uploader : {};

      return {
        type: update.type === 'Added' ? 'Added' : 'Updated',
        game: gamesByHash.get(update.hash),
        uploaded: Math.floor(dsNumber(update.uploaded) / 1000),
        uploader: dsText(uploader.name),
        uploaderLink: dsSafeUrl(uploader.link),
      };
    })
    .sort((a, b) => b.uploaded - a.uploaded);

  return { games, star, recent };
}

function dsFileUrl(game, type, sha) {
  const path = game.directory + DS_FILES[type];
  if (!sha) return DS_DATA_ROOT + path;

  if (!dsIsSha(sha)) throw new Error('"' + sha + '" is not a commit hash');

  return 'https://raw.githubusercontent.com/' + DS_REPO + '/' + sha + '/' + path;
}

function dsTypeData(type, info) {
  const isLegacyBitfields = info.version === 10201;

  if (type === 'classes' || type === 'structs') return dsEntries(info.data, (members) => dsMembers(members, isLegacyBitfields));

  if (type === 'functions') return dsEntries(info.data, dsFunctions);

  if (type === 'enums') return dsEntries(info.data, dsEnum);

  return info.data.filter((offset) => Array.isArray(offset) && offset.length >= 2).map((offset) => [dsText(offset[0]), dsNumber(offset[1])]);
}

async function dsSectionInfo(game, type, sha) {
  try {
    const info = await dsGzipJson(dsFileUrl(game, type, sha));

    return { ...info, data: Array.isArray(info.data) ? info.data : [], missing: false };
  } catch (error) {
    if (error.status === 404) return { data: [], missing: true };

    throw error;
  }
}

async function loadGameType(game, type, sha = null) {
  const info = await dsSectionInfo(game, type, sha);

  return { data: dsTypeData(type, info), missing: info.missing };
}

async function loadGameData(hash, sha = null) {
  const gameList = await dsJson(DS_DATA_ROOT + 'Games/GameList.json');

  const game = dsGameList(gameList).find((entry) => entry.hash === hash);
  if (!game) throw new Error('No game with hash "' + hash + '" in GameList.json');

  if (sha && !dsIsSha(sha)) throw new Error('"' + sha + '" is not a commit hash');

  const [classesInfo, structsInfo, offsetsInfo] = await Promise.all([
    dsSectionInfo(game, 'classes', sha),
    dsSectionInfo(game, 'structs', sha),
    dsSectionInfo(game, 'offsets', sha),
  ]);

  const classes = dsTypeData('classes', classesInfo);
  const structs = dsTypeData('structs', structsInfo);

  const children = Object.create(null);
  for (const [name, members] of Object.entries(classes).concat(Object.entries(structs))) {
    const inheritInfo = members.find((member) => member.__InheritInfo);
    const parent = inheritInfo && inheritInfo.__InheritInfo[0];
    if (!parent) continue;

    (children[parent] ||= []).push(name);
  }

  const credit = offsetsInfo.credit && typeof offsetsInfo.credit === 'object' ? offsetsInfo.credit : {};

  const missing = [
    ['classes', classesInfo],
    ['structs', structsInfo],
    ['offsets', offsetsInfo],
  ]
    .filter(([, info]) => info.missing)
    .map(([type]) => type);

  return {
    game,
    sha,
    classes,
    structs,
    children,
    offsets: dsTypeData('offsets', offsetsInfo),
    dumper: dsText(credit.dumper_used),
    dumperLink: dsSafeUrl(credit.dumper_link),
    functions: null,
    enums: null,
    missing,
  };
}

async function loadGameHistory(game) {
  const path = game.directory.replace(/\/$/, '');
  const seen = new Set();
  const versions = [];

  let from = 'main';

  for (let page = 0; page < 10; page++) {
    const url = 'https://api.github.com/repos/' + DS_REPO + '/commits?path=' + encodeURIComponent(path) + '&per_page=100&sha=' + from;

    let commits;

    try {
      commits = await dsJson(url);
    } catch (error) {
      if (/HTTP 403|HTTP 429/.test(error.message)) {
        throw new Error('GitHub’s API limit was reached (60 requests an hour without signing in). Try again later.');
      }

      throw error;
    }

    let foundMerge = false;

    for (const commit of Array.isArray(commits) ? commits : []) {
      if (!commit || !dsIsSha(commit.sha) || seen.has(commit.sha)) continue;

      seen.add(commit.sha);

      if (!Array.isArray(commit.parents) || commit.parents.length < 2) continue;

      foundMerge = true;

      const message = dsText(commit.commit && commit.commit.message);
      const author = (commit.commit && commit.commit.author) || {};
      const uploader = /from ([A-Za-z0-9-]+)\//.exec(message);
      const pullRequest = /#(\d+)/.exec(message);

      versions.push({
        sha: commit.sha,
        date: Math.floor(dsNumber(Date.parse(author.date)) / 1000),
        uploader: uploader ? uploader[1] : dsText(author.name),
        pullRequest: pullRequest ? pullRequest[1] : null,
      });
    }

    if (commits.length < 100 || !foundMerge) break;

    from = commits[commits.length - 1].sha;
  }

  return versions;
}
