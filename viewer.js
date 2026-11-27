const TYPES = [
  { key: 'classes', label: 'Classes', kind: 'class' },
  { key: 'structs', label: 'Structs', kind: 'struct' },
  { key: 'functions', label: 'Functions', kind: 'functions' },
  { key: 'enums', label: 'Enums', kind: 'enum' },
  { key: 'offsets', label: 'Offsets', kind: 'offsets' },
];

const KIND_LABELS = {
  pointer: 'Pointer',
  struct: 'Embedded struct',
  container: 'Container',
  bitfield: 'Bitfield',
  enum: 'Enum',
  value: 'Value',
};

const ENTRY_VIEWS = [
  ['fields', 'Fields'],
  ['hierarchy', 'Hierarchy'],
  ['namespace', 'Namespace'],
  ['mdk', 'MDK'],
];

const ENUM_VIEWS = [
  ['fields', 'Values'],
  ['cpp', 'C++'],
];

const SYMBOL_ROW_HEIGHT = 26;

const DEPTH_OPTIONS = [
  [1, '1'],
  [2, '2'],
  [3, '3'],
  [4, '4'],
  [0, 'All'],
];

const HIERARCHY_LIMIT = 1500;

const DIFF_LABELS = {
  added: 'New',
  changed: 'Changed',
  removed: 'Removed',
};

const DIFF_LETTERS = {
  added: 'A',
  changed: 'M',
  removed: 'D',
};

const nameCollator = new Intl.Collator();

const COPY_ICON =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="9" y="9" width="12" height="12" rx="2"></rect><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"></path></svg>';

const LINK_ICON =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"></path><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"></path></svg>';

function linkButtonHtml(className, type, name, member = null) {
  const url = new URL('viewer.html' + viewUrl(type, name, member), location.href).href;
  const label = member || name || 'Global offsets';

  return (
    '<button class="' + className + '" type="button" data-copy-link="' + escapeHtml(url) + '" data-link-label="' + escapeHtml(label) + '" ' +
    'aria-label="Copy link to ' + escapeHtml(label) + '" title="Copy link">' + LINK_ICON + '</button>'
  );
}

function copyButtonHtml(text, message, label) {
  return (
    '<button class="row-link" type="button" data-copy-text="' + escapeHtml(text) + '" data-copy-message="' + escapeHtml(message) + '" ' +
    'aria-label="' + escapeHtml(label) + '" title="' + escapeHtml(label) + '">' + COPY_ICON + '</button>'
  );
}

function rowActionsHtml(member, copy = null) {
  const copyButton = copy ? copyButtonHtml(copy.text, copy.message, copy.label) : '';

  return copyButton + linkButtonHtml('row-link', viewerState.type, viewerState.name, member);
}

function rowLinkCellHtml(member, copy = null) {
  return '<td class="row-actions">' + rowActionsHtml(member, copy) + '</td>';
}

function fieldCopy(row) {
  const bitNote = row.bit !== null ? ' // bit ' + row.bit : '';

  return {
    text: 'constexpr auto ' + row.name + ' = ' + hex(row.offset) + ';' + bitNote,
    message: 'Copied ' + row.name + ' offset',
    label: 'Copy ' + row.name + ' offset',
  };
}

const viewerState = {
  type: 'classes',
  name: null,
  member: null,
  view: 'fields',
  depth: 2,
  symbolFilter: '',
  memberFilter: '',
};

const diffState = {
  sha: null,
  summaries: {},
  loads: {},
  errors: {},
  changedOnly: false,
};

const symbolNames = {};
const typeLoads = {};
const descendantCounts = new Map();

let filteredSymbols = [];
let currentCode = '';
let paletteMatches = [];
let paletteIndex = 0;
let historyVersions = null;
let historyLoad = null;

const typeTabs = document.getElementById('type-tabs');
const symbolFilterInput = document.getElementById('symbol-filter');
const symbolList = document.getElementById('symbol-list');
const symbolRows = document.getElementById('symbol-rows');
const symbolMeta = document.getElementById('symbol-meta');
const mainPane = document.getElementById('main');
const inspectorPane = document.getElementById('inspector');
const palette = document.getElementById('palette');
const paletteInput = document.getElementById('palette-input');
const paletteResults = document.getElementById('palette-results');
const versionBar = document.getElementById('version-bar');
const historyDrawer = document.getElementById('history');
const historyList = document.getElementById('history-list');
const dumpDrawer = document.getElementById('dump-drawer');
const dumpBody = document.getElementById('dump-body');
const globalSearch = document.getElementById('global-search');
const panes = document.querySelector('.panes');

function typeInfo(key) {
  return TYPES.find((type) => type.key === key);
}

function hex(value) {
  const number = Number(value);

  return Number.isFinite(number) ? '0x' + number.toString(16).toUpperCase() : '0x?';
}

function typeString(type) {
  let text = type[0];

  if (type[3] && type[3].length) text += '<' + type[3].map(typeString).join(', ') + '>';

  return text + (type[2] || '');
}

function symbolTarget(name, kind) {
  if (DS.classes[name]) return 'classes';

  if (DS.structs[name]) return 'structs';

  if (kind === 'E' && (!DS.enums || DS.enums[name])) return 'enums';

  return null;
}

function viewUrl(type, name, member, sha = DS.sha, diff = diffState.sha) {
  const params = new URLSearchParams();
  params.set('hash', DS.game.hash);
  params.set('type', type);

  if (name && type !== 'offsets') params.set('idx', name);

  if (member) params.set('member', member);

  if (sha) params.set('sha', sha);

  if (diff) params.set('diff', diff);

  return '?' + params.toString();
}

function gotoAttributes(type, name, member = null) {
  const memberAttribute = member ? ' data-goto-member="' + escapeHtml(member) + '"' : '';

  return (
    ' href="' + escapeHtml(viewUrl(type, name, member)) + '" data-goto-type="' + type + '" data-goto-name="' + escapeHtml(name) + '"' +
    memberAttribute
  );
}

function previewTarget(type) {
  if (type[1] === 'S' && DS.structs[type[0]]) return ['structs', type[0]];

  if (type[1] === 'E') return ['enums', type[0]];

  for (const subtype of type[3] || []) {
    const target = previewTarget(subtype);
    if (target) return target;
  }

  return null;
}

function typeHtml(type) {
  const target = symbolTarget(type[0], type[1]);

  let html = target
    ? '<a class="type-link"' + gotoAttributes(target, type[0]) + '>' + escapeHtml(type[0]) + '</a>'
    : escapeHtml(type[0]);

  if (type[3] && type[3].length) html += '&lt;' + type[3].map(typeHtml).join(', ') + '&gt;';

  return html + escapeHtml(type[2] || '');
}

function symbolLinkHtml(name) {
  const target = symbolTarget(name, 'C');
  if (!target) return '<span class="muted">' + escapeHtml(name) + '</span>';

  return '<a class="link"' + gotoAttributes(target, name) + '>' + escapeHtml(name) + '</a>';
}

function memberKind(row) {
  if (row.bit !== null) return 'bitfield';

  if (row.type[2]) return 'pointer';

  if (row.type[0] === 'TArray' || row.type[0] === 'TMap' || row.type[0] === 'TSet') return 'container';

  if (row.type[1] === 'S') return 'struct';

  if (row.type[1] === 'E') return 'enum';

  return 'value';
}

function kindDot(kind) {
  return '<span class="kind-dot" style="background: var(--kind-' + kind + ')"></span>';
}

function memberDisplayName(row) {
  let name = row.name;

  if (row.arrayDim > 1) name += '[' + row.arrayDim + ']';

  if (row.bit !== null) name += ' : 1';

  return name;
}

function memberRow(name, value) {
  return {
    name,
    type: value[0],
    offset: value[1],
    size: value[2],
    arrayDim: value[3] ?? 1,
    bit: value.length > 4 ? value[4] : null,
  };
}

function offsetLabel(row) {
  return hex(row.offset) + (row.bit !== null ? ':' + row.bit : '');
}

function entryFromMembers(type, name, members) {
  let inherit = [];
  let size = 0;
  const rows = [];

  for (const member of members) {
    const key = Object.keys(member)[0];
    const value = member[key];

    if (key === '__InheritInfo') {
      inherit = value;
      continue;
    }

    if (key === '__MDKClassSize') {
      size = value;
      continue;
    }

    rows.push(memberRow(key, value));
  }

  if (!size && rows.length) {
    const lastRow = rows[rows.length - 1];
    size = lastRow.offset + lastRow.size;
  }

  return { name, isClass: type === 'classes', inherit, size, rows };
}

function parseEntry(type, name) {
  const members = lookupEntry(type, name);
  if (!members) return null;

  return entryFromMembers(type, name, members);
}

function functionFromValue(name, value) {
  const [returnType, parameters, address, flags] = value;

  return {
    name,
    returnType,
    parameters: parameters.map(([type, suffix, parameterName]) => ({ type, suffix, name: parameterName })),
    address,
    flags: flags ? flags.split('|') : [],
  };
}

function parseFunctions(owner) {
  const functions = lookupEntry('functions', owner);
  if (!functions) return null;

  return functions.map((entry) => {
    const name = Object.keys(entry)[0];

    return functionFromValue(name, entry[name]);
  });
}

function parseEnum(name) {
  const entry = lookupEntry('enums', name);
  if (!entry) return null;

  const [values, underlyingType] = entry;

  return {
    name,
    underlyingType,
    values: values.map((value) => {
      const valueName = Object.keys(value)[0];

      return { name: valueName, value: value[valueName] };
    }),
  };
}

function functionSignature(func) {
  const parameters = func.parameters.map((parameter) => typeString(parameter.type) + parameter.suffix + ' ' + parameter.name);

  return typeString(func.returnType) + ' ' + func.name + '(' + parameters.join(', ') + ');';
}

function functionSignatureHtml(func) {
  const parameters = func.parameters.map(
    (parameter) => typeHtml(parameter.type) + escapeHtml(parameter.suffix) + ' <span class="muted">' + escapeHtml(parameter.name) + '</span>',
  );

  return typeHtml(func.returnType) + ' <b>' + escapeHtml(func.name) + '</b>(' + parameters.join(', ') + ')';
}

function codeHtml(lines) {
  return lines
    .map((tokens) =>
      tokens.map(([text, style]) => (style ? '<span class="' + style + '">' + escapeHtml(text) + '</span>' : escapeHtml(text))).join(''),
    )
    .join('\n');
}

function codeText(lines) {
  return lines.map((tokens) => tokens.map((token) => token[0]).join('')).join('\n');
}

function namespaceLines(entry) {
  const lines = [[['// Inheritance: ' + entry.inherit.join(' > '), 'co']], [['namespace', 'kw'], [' ' + entry.name + ' {']]];

  for (const row of entry.rows) {
    const bitNote = row.bit !== null ? ' : 1 (' + row.bit + ')' : '';

    lines.push([
      ['\t'],
      ['constexpr auto', 'kw'],
      [' ' + row.name + ' = '],
      ['0x' + row.offset.toString(16), 'nu'],
      ['; '],
      ['// ' + typeString(row.type) + bitNote, 'co'],
    ]);
  }

  lines.push([['}']]);

  return lines;
}

function mdkLines(entry) {
  const parent = entry.inherit[0];
  const header = [['class', 'kw'], [' ' + entry.name]];

  if (parent) header.push([' : '], ['public', 'kw'], [' ' + parent]);

  const lines = [[['// Inheritance: ' + entry.inherit.join(' > '), 'co']], header, [['{']], [['\t'], ['friend', 'kw'], [' MDKHandler;']]];

  if (!entry.isClass) lines.push([['\t'], ['friend', 'kw'], [' MDKBase;']]);

  lines.push([['\t'], ['static inline constexpr', 'kw'], [' uint64_t __MDKClassSize = '], [String(entry.size), 'nu'], [';']]);
  lines.push([]);
  lines.push([['public', 'kw'], [':']]);

  for (const row of entry.rows) {
    const kind = row.type[1];
    const type = typeString(row.type);
    const macro = '\t' + kind + 'Member(' + type + ')';
    const nameColumn = macro.padEnd(54).length;
    const getter = kind === 'C' ? '<T>' : kind === 'S' ? 'Struct<T>' : '<' + row.type[0] + '>';
    const bitArguments = row.bit !== null ? '1, ' + row.bit : '0, 0';

    lines.push([
      ['\t' + kind + 'Member('],
      [type, 'ty'],
      [')' + ' '.repeat(nameColumn - macro.length) + (row.name + ' ').padEnd(114 - nameColumn)],
      ['OFFSET(get' + getter + ', {'],
      ['0x' + row.offset.toString(16), 'nu'],
      [', ' + row.size + ', ' + bitArguments + '})'],
    ]);
  }

  lines.push([['};']]);

  return lines;
}

function enumLines(enumEntry) {
  const lines = [[['enum class', 'kw'], [' ' + enumEntry.name + ' : '], [enumEntry.underlyingType, 'ty']], [['{']]];

  for (const value of enumEntry.values) lines.push([['\t' + value.name + ' = '], [String(value.value), 'nu'], [',']]);

  lines.push([['};']]);

  return lines;
}

function readSnippet(row) {
  const offset = hex(row.offset);

  if (row.bit !== null) return 'const bool ' + row.name + ' = (*(uint8_t*)(object + ' + offset + ') >> ' + row.bit + ') & 1;';

  const type = typeString(row.type);

  if (row.type[2]) return 'auto* ' + row.name + ' = *(' + type + '*)(object + ' + offset + ');';

  return 'auto& ' + row.name + ' = *(' + type + '*)(object + ' + offset + ');';
}

function lookupEntry(type, name) {
  const current = DS[type] && DS[type][name];
  if (current) return current;

  const summary = diffFor(type);

  return summary ? summary.before[name] : undefined;
}

function diffFor(type) {
  if (!diffState.sha) return null;

  return diffState.summaries[type] || null;
}

function entryDiff(type, name) {
  const summary = diffFor(type);

  return summary ? summary.entries.get(name) || null : null;
}

function changedMember(change, name) {
  if (!change || change.status !== 'changed') return null;

  return change.members.get(name) || null;
}

function wasHtml(beforeText, afterText, afterHtml = escapeHtml(afterText)) {
  if (beforeText === null || beforeText === undefined || beforeText === afterText) return afterHtml;

  return '<s class="was">' + escapeHtml(beforeText) + '</s> ' + afterHtml;
}

function diffTagHtml(change) {
  if (!change) return '';

  return '<span class="diff-tag" data-status="' + change.status + '">' + DIFF_LABELS[change.status] + '</span>';
}

function diffNoteHtml(change, facts = []) {
  if (!change) return '';

  const lead = { added: 'New since ', changed: 'Changed since ', removed: 'Removed since ' }[change.status];

  return (
    '<div class="diff-note" data-status="' + change.status + '"><div>' + lead + escapeHtml(versionLabel(diffState.sha)) + '</div>' +
    (facts.length ? factsHtml(facts) : '') + '</div>'
  );
}

function displayRows(type, entry) {
  const change = entryDiff(type, entry.name);
  const rows = entry.rows.map((row) => ({ ...row, diff: changedMember(change, row.name) }));

  if (!change || change.status !== 'changed') return rows;

  for (const [name, member] of change.members) {
    if (member.status === 'removed') rows.push({ ...memberRow(name, member.before), diff: member });
  }

  rows.sort((a, b) => a.offset - b.offset || (a.bit ?? -1) - (b.bit ?? -1));

  return rows;
}

function memberDiffFacts(row) {
  if (!row.diff || row.diff.status !== 'changed') return [];

  const before = memberRow(row.name, row.diff.before);
  const facts = [];

  if (offsetLabel(before) !== offsetLabel(row)) facts.push(['Was at', offsetLabel(before)]);

  if (before.size !== row.size) facts.push(['Was size', before.size + (before.size === 1 ? ' byte' : ' bytes')]);

  if (!sameType(before.type, row.type)) facts.push(['Was type', escapeHtml(typeString(before.type))]);

  if (before.arrayDim !== row.arrayDim) facts.push(['Was array', '[' + before.arrayDim + ']']);

  return facts;
}

function displayFunctions(owner) {
  const change = entryDiff('functions', owner);
  const functions = parseFunctions(owner).map((func) => ({ ...func, diff: changedMember(change, func.name) }));

  if (!change || change.status !== 'changed') return functions;

  for (const [name, member] of change.members) {
    if (member.status === 'removed') functions.push({ ...functionFromValue(name, member.before), diff: member });
  }

  return functions;
}

function displayValues(enumEntry) {
  const change = entryDiff('enums', enumEntry.name);
  const values = enumEntry.values.map((value) => ({ ...value, diff: changedMember(change, value.name) }));

  if (!change || change.status !== 'changed') return values;

  for (const [name, member] of change.members) {
    if (member.status === 'removed') values.push({ name, value: member.before, diff: member });
  }

  return values;
}

function formatOffsetValue(name, value) {
  return isDumperEntry(name) ? String(value) : hex(value);
}

function offsetRows() {
  const summary = diffFor('offsets');
  const rows = DS.offsets.map(([name, value]) => ({ name, value, diff: summary ? summary.entries.get(name) || null : null }));

  if (!summary) return rows;

  for (const name of summary.removed) rows.push({ name, value: summary.before[name], diff: summary.entries.get(name) });

  return rows;
}

function entrySize(name) {
  const members = DS.classes[name] || DS.structs[name];
  if (!members) return null;

  const sizeMember = members.find((member) => member.__MDKClassSize);

  return sizeMember ? sizeMember.__MDKClassSize : null;
}

function descendantCount(name) {
  if (descendantCounts.has(name)) return descendantCounts.get(name);

  let total = 0;

  for (const child of DS.children[name] || []) total += 1 + descendantCount(child);

  descendantCounts.set(name, total);

  return total;
}

function hierarchyRowHtml(line, query) {
  const size = entrySize(line.name);
  const total = descendantCount(line.name);
  const target = symbolTarget(line.name, 'C');
  const name = line.role === 'descendant' ? highlightMatch(line.name, query) : escapeHtml(line.name);

  const inner =
    '<span class="tree-indent" style="width: ' + line.depth * 16 + 'px"></span>' +
    '<span class="tree-name">' + name + '</span>' +
    '<span class="tree-count">' + (total ? total.toLocaleString() + ' derived' : '') + '</span>' +
    '<span class="tree-size mono">' + (size === null ? '' : hex(size)) + '</span>';

  if (line.role === 'current' || !target) return '<div class="tree-row" data-role="' + line.role + '">' + inner + '</div>';

  return '<a class="tree-row" data-role="' + line.role + '"' + gotoAttributes(target, line.name) + '>' + inner + '</a>';
}

function renderHierarchy(body, entry) {
  const query = viewerState.memberFilter.trim().toLowerCase();
  const maxDepth = query || !viewerState.depth ? Infinity : viewerState.depth;

  const ancestors = entry.inherit.slice().reverse();
  const lines = ancestors.map((name, depth) => ({ name, depth, role: 'ancestor' }));

  lines.push({ name: entry.name, depth: ancestors.length, role: 'current' });

  const matchCache = new Map();

  const subtreeMatches = (name) => {
    if (matchCache.has(name)) return matchCache.get(name);

    const matches = name.toLowerCase().includes(query) || (DS.children[name] || []).some((child) => subtreeMatches(child));
    matchCache.set(name, matches);

    return matches;
  };

  let truncated = false;

  const addDescendants = (name, level) => {
    if (level > maxDepth) return;

    for (const child of DS.children[name] || []) {
      if (query && !subtreeMatches(child)) continue;

      if (lines.length >= HIERARCHY_LIMIT) {
        truncated = true;
        return;
      }

      lines.push({ name: child, depth: ancestors.length + level, role: 'descendant' });
      addDescendants(child, level + 1);
    }
  };

  addDescendants(entry.name, 1);

  const direct = (DS.children[entry.name] || []).length;
  const total = descendantCount(entry.name);
  const shownDescendants = lines.length - ancestors.length - 1;

  let footer = '';

  if (truncated) footer = '<div class="empty">Showing the first ' + HIERARCHY_LIMIT.toLocaleString() + ' rows. Lower the depth or filter to narrow it down.</div>';
  else if (query && !shownDescendants) footer = '<div class="empty">No derived ' + typeInfo(viewerState.type).label.toLowerCase() + ' match.</div>';
  else if (!total) footer = '<div class="empty">Nothing inherits from ' + escapeHtml(entry.name) + '.</div>';

  body.innerHTML =
    '<div class="tree-summary">' + ancestors.length + (ancestors.length === 1 ? ' ancestor' : ' ancestors') + ' · ' +
    direct.toLocaleString() + ' direct · ' + total.toLocaleString() + ' derived in total</div>' +
    '<div class="tree">' + lines.map((line) => hierarchyRowHtml(line, query)).join('') + '</div>' + footer;
}

function ensureType(type) {
  if ((type !== 'functions' && type !== 'enums') || DS[type]) return Promise.resolve();

  typeLoads[type] ||= loadGameType(DS.game, type, DS.sha).then(
    ({ data, missing }) => {
      DS[type] = data;

      if (missing) DS.missing.push(type);

      renderTabs();
    },
    (error) => {
      delete typeLoads[type];
      throw error;
    },
  );

  return typeLoads[type];
}

function ensureDiff(type) {
  if (diffState.summaries[type]) return Promise.resolve();

  const sha = diffState.sha;

  diffState.loads[type] ||= loadGameType(DS.game, type, sha).then(
    ({ data: before }) => {
      if (diffState.sha !== sha) return;

      diffState.summaries[type] = buildDiff(type, before, type === 'offsets' ? DS.offsets : DS[type]);
      delete symbolNames[type];
    },
    (error) => {
      delete diffState.loads[type];
      throw error;
    },
  );

  return diffState.loads[type];
}

function resetDiff(sha) {
  diffState.sha = sha;
  diffState.summaries = {};
  diffState.loads = {};
  diffState.errors = {};
  diffState.changedOnly = false;

  for (const type of Object.keys(symbolNames)) delete symbolNames[type];
}

function namesOf(type) {
  if (symbolNames[type]) return symbolNames[type];

  let names = type === 'offsets' ? DS.offsets.map(([name]) => name) : Object.keys(DS[type]);

  const summary = diffFor(type);

  if (summary && summary.removed.length) {
    names = names.concat(summary.removed);

    if (type !== 'offsets') names.sort(nameCollator.compare);
  }

  symbolNames[type] = names;

  return names;
}

function typeCount(type) {
  if (type === 'offsets') return DS.offsets.length;

  if (!DS[type]) return null;

  return Object.keys(DS[type]).length;
}

function updateUrl(mode) {
  if (mode === 'none') return;

  const url = viewUrl(viewerState.type, viewerState.name, viewerState.member);
  if (url === location.search) return;

  if (mode === 'push') history.pushState(null, '', url);
  else history.replaceState(null, '', url);
}

async function openType(type, name = null, member = null, historyMode = 'push') {
  viewerState.type = type;
  viewerState.symbolFilter = '';
  symbolFilterInput.value = '';
  symbolFilterInput.placeholder = 'Filter ' + typeInfo(type).label.toLowerCase();

  renderTabs();

  const label = typeInfo(type).label.toLowerCase();
  const needsType = (type === 'functions' && !DS.functions) || (type === 'enums' && !DS.enums);
  const needsDiff = diffState.sha && !diffState.summaries[type] && !diffState.errors[type];

  if (needsType || needsDiff) {
    symbolRows.innerHTML = '';
    symbolRows.style.height = '0px';
    symbolMeta.textContent = '';
    mainPane.innerHTML = '<div class="empty">' + (needsType ? 'Loading ' + label + '…' : 'Loading the compared version…') + '</div>';
    inspectorPane.innerHTML = '';
    renderVersionBar();

    try {
      await ensureType(type);
    } catch (error) {
      mainPane.innerHTML = '<div class="empty">Couldn’t load ' + label + ': ' + escapeHtml(error.message) + '</div>';
      return;
    }

    if (diffState.sha) {
      try {
        await ensureDiff(type);
      } catch (error) {
        diffState.errors[type] = error.message;
      }
    }

    if (viewerState.type !== type) return;
  }

  filterSymbols();

  const names = namesOf(type);
  const target = name && names.includes(name) ? name : names[0] || null;

  openSymbol(target, member, historyMode);
}

function openSymbol(name, member = null, historyMode = 'push') {
  if (viewerState.name !== name) viewerState.memberFilter = '';

  const views = viewerState.type === 'enums' ? ENUM_VIEWS : ENTRY_VIEWS;
  if (!views.some(([key]) => key === viewerState.view)) viewerState.view = 'fields';

  viewerState.name = name;
  viewerState.member = viewerState.type === 'offsets' ? member || name : member;

  updateUrl(historyMode);

  document.title = (name && viewerState.type !== 'offsets' ? name + ' · ' : '') + DS.game.name + ' — Dumpspace';

  renderSymbols();
  scrollSymbolIntoView(name);

  renderMain();
  renderInspector();
  scrollMemberIntoView();

  renderVersionBar();
}

function goto(type, name, member = null) {
  if (type === viewerState.type && namesOf(type).includes(name)) {
    openSymbol(name, member);
    return;
  }

  openType(type, name, member);
}

function selectMember(member) {
  viewerState.member = member;

  if (viewerState.type === 'offsets') {
    viewerState.name = member;
    renderSymbols();
  }

  updateUrl('replace');

  for (const element of mainPane.querySelectorAll('[data-member]')) {
    const selected = String(element.dataset.member === member);

    if (element.hasAttribute('aria-pressed')) element.setAttribute('aria-pressed', selected);
    else element.setAttribute('aria-selected', selected);
  }

  renderInspector();
}

async function applyLocation(historyMode) {
  const params = new URLSearchParams(location.search);
  const requestedType = params.get('type');
  const type = TYPES.some((entry) => entry.key === requestedType) ? requestedType : 'classes';
  const name = type === 'offsets' ? params.get('member') : params.get('idx');
  const requestedDiff = params.get('diff');
  const diff = dsIsSha(requestedDiff) ? requestedDiff : null;

  if (diff !== diffState.sha) resetDiff(diff);

  await openType(type, name, params.get('member'), historyMode);
}

function filterSymbols() {
  const summary = diffFor(viewerState.type);
  const allNames = namesOf(viewerState.type);
  const changedOnly = summary && diffState.changedOnly;
  const names = changedOnly ? allNames.filter((name) => summary.entries.has(name)) : allNames;
  const query = viewerState.symbolFilter.trim().toLowerCase();

  if (!query) {
    filteredSymbols = names;
  } else {
    const prefixMatches = [];
    const otherMatches = [];

    for (const name of names) {
      const position = name.toLowerCase().indexOf(query);

      if (position === 0) prefixMatches.push(name);
      else if (position > 0) otherMatches.push(name);
    }

    filteredSymbols = prefixMatches.concat(otherMatches);
  }

  if (query) symbolMeta.textContent = filteredSymbols.length.toLocaleString() + ' of ' + names.length.toLocaleString();
  else if (changedOnly) symbolMeta.textContent = names.length.toLocaleString() + ' changed of ' + allNames.length.toLocaleString();
  else symbolMeta.textContent = allNames.length.toLocaleString() + ' ' + typeInfo(viewerState.type).label.toLowerCase();

  symbolList.scrollTop = 0;
}

function renderSymbols() {
  const total = filteredSymbols.length;
  const query = viewerState.symbolFilter.trim().toLowerCase();
  const summary = diffFor(viewerState.type);

  symbolRows.style.height = total * SYMBOL_ROW_HEIGHT + 12 + 'px';

  const firstRow = Math.max(0, Math.floor(symbolList.scrollTop / SYMBOL_ROW_HEIGHT) - 10);
  const lastRow = Math.min(total, firstRow + Math.ceil(symbolList.clientHeight / SYMBOL_ROW_HEIGHT) + 20);

  let html = '';

  for (let index = firstRow; index < lastRow; index++) {
    const name = filteredSymbols[index];
    const selected = name === viewerState.name;
    const change = summary && summary.entries.get(name);
    const mark = change ? '<span class="diff-mark" data-status="' + change.status + '">' + DIFF_LETTERS[change.status] + '</span>' : '';

    html +=
      '<div class="symbol-row" role="option" data-symbol="' + escapeHtml(name) + '" aria-selected="' + selected + '" ' +
      'data-diff="' + (change ? change.status : '') + '" style="top: ' + (6 + index * SYMBOL_ROW_HEIGHT) + 'px">' +
      '<span class="symbol-name">' + highlightMatch(name, query) + '</span>' + mark + '</div>';
  }

  symbolRows.innerHTML = html;
}

function scrollSymbolIntoView(name) {
  const index = filteredSymbols.indexOf(name);
  if (index < 0) return;

  const rowTop = 6 + index * SYMBOL_ROW_HEIGHT;
  const rowBottom = rowTop + SYMBOL_ROW_HEIGHT;
  const viewTop = symbolList.scrollTop;
  const viewBottom = viewTop + symbolList.clientHeight;

  const isAdjacent = rowBottom >= viewTop - SYMBOL_ROW_HEIGHT && rowTop <= viewBottom + SYMBOL_ROW_HEIGHT;

  if (rowTop >= viewTop && rowBottom <= viewBottom) {
    renderSymbols();
    return;
  }

  if (!isAdjacent) symbolList.scrollTop = rowTop - symbolList.clientHeight / 2;
  else if (rowTop < viewTop) symbolList.scrollTop = rowTop - 6;
  else symbolList.scrollTop = rowBottom - symbolList.clientHeight + 6;

  renderSymbols();
}

function stepSymbol(step) {
  if (!filteredSymbols.length) return;

  const index = filteredSymbols.indexOf(viewerState.name);
  const nextIndex = Math.min(filteredSymbols.length - 1, Math.max(0, index + step));

  openSymbol(filteredSymbols[nextIndex], null, 'replace');
}

function renderTabs() {
  const listToggle =
    '<button class="list-toggle" type="button" data-list-toggle aria-label="Show the list">' +
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"></path></svg></button>';

  typeTabs.innerHTML = listToggle + TYPES.map((type) => {
    const count = typeCount(type.key);
    const countHtml = count === null ? '' : '<span class="count">' + count.toLocaleString() + '</span>';
    const emptyAttribute = count === 0 ? ' data-empty' : '';

    return (
      '<button class="type-tab" type="button" role="tab" data-tab="' + type.key + '" aria-selected="' + (type.key === viewerState.type) + '"' + emptyAttribute + '>' +
      type.label + countHtml + '</button>'
    );
  }).join('');

  typeTabs.querySelector('[aria-selected="true"]').scrollIntoView({ block: 'nearest', inline: 'nearest' });
  updateStripEdges(typeTabs);
}

function segmentedHtml(views) {
  return (
    '<div class="segmented" role="group" aria-label="View">' +
    views.map(([key, label]) => '<button type="button" data-view="' + key + '" aria-pressed="' + (viewerState.view === key) + '">' + label + '</button>').join('') +
    '</div>'
  );
}

function depthHtml() {
  const buttons = DEPTH_OPTIONS.map(
    ([value, label]) => '<button type="button" data-depth="' + value + '" aria-pressed="' + (viewerState.depth === value) + '">' + label + '</button>',
  );

  return '<div class="segmented depth" role="group" aria-label="Depth"><span class="segmented-label">Depth</span>' + buttons.join('') + '</div>';
}

function toolbarHtml(views, filterPlaceholder) {
  const filterInput = (placeholder) =>
    '<input class="field-input" id="member-filter" type="search" placeholder="' + placeholder + '" value="' + escapeHtml(viewerState.memberFilter) +
    '" autocomplete="off" spellcheck="false">';

  let controls;

  if (views && viewerState.view === 'hierarchy') {
    controls = depthHtml() + filterInput('Filter derived ' + typeInfo(viewerState.type).label.toLowerCase());
  } else if (views && viewerState.view !== 'fields') {
    controls = '<button class="button" type="button" data-copy-code style="margin-left: auto">Copy</button>';
  } else {
    controls = filterInput(filterPlaceholder);
  }

  return '<div class="entry-toolbar">' + (views ? segmentedHtml(views) : '') + controls + '</div>';
}

function emptySectionHtml(type) {
  const label = typeInfo(type).label.toLowerCase();
  const file = DS_FILES[type].replace(/\.gz$/, '');

  const reason = DS.missing.includes(type)
    ? 'This upload doesn’t include <code>' + file + '</code>.'
    : '<code>' + file + '</code> in this upload has no entries.';

  const otherSections = TYPES.filter((other) => other.key !== type && typeCount(other.key) !== 0)
    .map((other) => {
      const count = typeCount(other.key);
      const countHtml = count === null ? '' : ' <span class="faint num">' + count.toLocaleString() + '</span>';

      return '<button class="button" type="button" data-switch-tab="' + other.key + '">' + other.label + countHtml + '</button>';
    })
    .join('');

  return (
    '<div class="empty-section"><h2>No ' + label + '</h2><p>' + reason + '</p>' +
    (otherSections ? '<div class="empty-actions">' + otherSections + '</div>' : '') + '</div>'
  );
}

function renderMain() {
  currentCode = '';

  if (!viewerState.name) {
    mainPane.innerHTML = emptySectionHtml(viewerState.type);
    return;
  }

  if (viewerState.type === 'classes' || viewerState.type === 'structs') renderEntryMain();
  else if (viewerState.type === 'functions') renderFunctionsMain();
  else if (viewerState.type === 'enums') renderEnumMain();
  else renderOffsetsMain();
}

function layoutStripHtml(entry) {
  if (!entry.size) return '';

  const firstOffset = entry.rows.length ? entry.rows[0].offset : entry.size;
  const inheritedPercent = (firstOffset / entry.size) * 100;

  const segments = entry.rows
    .map((row) => {
      const left = (row.offset / entry.size) * 100;
      const width = Math.max(0.2, (row.size / entry.size) * 100);
      const kind = memberKind(row);

      return (
        '<button type="button" data-member="' + escapeHtml(row.name) + '" aria-pressed="' + (row.name === viewerState.member) + '" ' +
        'title="' + escapeHtml(row.name + ' · ' + hex(row.offset)) + '" aria-label="' + escapeHtml(row.name + ' at ' + hex(row.offset)) + '" ' +
        'style="left: ' + left.toFixed(3) + '%; width: ' + width.toFixed(3) + '%; background: var(--kind-' + kind + ')"></button>'
      );
    })
    .join('');

  const inheritedLabel = entry.inherit.length && firstOffset ? 'inherited to ' + hex(firstOffset) : '';

  return (
    '<div class="layout-strip"><div class="inherited" style="width: ' + inheritedPercent.toFixed(3) + '%"></div>' + segments + '</div>' +
    '<div class="layout-scale"><span>0x0</span><span>' + inheritedLabel + '</span><span>' + hex(entry.size) + '</span></div>'
  );
}

function renderEntryMain() {
  const type = viewerState.type;
  const entry = parseEntry(type, viewerState.name);
  const kind = typeInfo(type).kind;
  const change = entryDiff(type, entry.name);
  const before = change && change.status === 'changed' ? entryFromMembers(type, entry.name, change.before) : null;

  const chain = entry.inherit
    .slice()
    .reverse()
    .map(symbolLinkHtml)
    .join('<span class="chain-sep">›</span>');

  const inheritance = entry.inherit.length ? '<span class="chain"><span class="faint">extends</span>&nbsp;' + chain + '</span>' : '';
  const sizeHex = wasHtml(before && hex(before.size), hex(entry.size));

  mainPane.innerHTML =
    '<div class="entry-head">' +
    '<div class="entry-kind">' + kind + '</div>' +
    '<div class="entry-title"><h1>' + escapeHtml(entry.name) + '</h1>' +
    '<button class="icon-button" type="button" data-copy-name aria-label="Copy name" title="Copy name">' + COPY_ICON + '</button>' +
    linkButtonHtml('icon-button', type, entry.name) + diffTagHtml(change) + '</div>' +
    '<div class="entry-meta"><span class="mono num">' + sizeHex + '</span><span>' + entry.size.toLocaleString() + ' bytes</span>' +
    '<span>' + entry.rows.length + ' fields</span>' + inheritance + '</div>' +
    layoutStripHtml(entry) +
    toolbarHtml(ENTRY_VIEWS, 'Filter fields') +
    '</div><div id="entry-body"></div>';

  renderEntryBody();
}

function renderEntryBody() {
  const body = document.getElementById('entry-body');
  const type = viewerState.type;
  const entry = parseEntry(type, viewerState.name);

  if (viewerState.view === 'hierarchy') {
    renderHierarchy(body, entry);
    return;
  }

  if (viewerState.view !== 'fields') {
    const lines = viewerState.view === 'namespace' ? namespaceLines(entry) : mdkLines(entry);
    currentCode = codeText(lines);
    body.innerHTML = '<pre class="code">' + codeHtml(lines) + '</pre>';
    return;
  }

  const query = viewerState.memberFilter.trim().toLowerCase();
  const allRows = displayRows(type, entry);
  const rows = query
    ? allRows.filter((row) => row.name.toLowerCase().includes(query) || typeString(row.type).toLowerCase().includes(query))
    : allRows;

  if (!rows.length) {
    body.innerHTML = '<div class="empty">' + (allRows.length ? 'No fields match.' : 'No fields of its own.') + '</div>';
    return;
  }

  const hasChangedRows = rows.some((row) => row.diff && row.diff.status === 'changed');

  const rowsHtml = rows
    .map((row) => {
      const change = row.diff;
      const before = change && change.status === 'changed' ? memberRow(row.name, change.before) : null;

      return (
        '<tr data-member="' + escapeHtml(row.name) + '" aria-selected="' + (row.name === viewerState.member) + '" data-diff="' + (change ? change.status : '') + '">' +
        '<td class="mono offset">' + wasHtml(before && offsetLabel(before), offsetLabel(row)) + '</td>' +
        '<td class="member-name">' + kindDot(memberKind(row)) + highlightMatch(memberDisplayName(row), query) + '</td>' +
        '<td class="mono muted">' + wasHtml(before && !sameType(before.type, row.type) ? typeString(before.type) : null, typeString(row.type), typeHtml(row.type)) + '</td>' +
        '<td class="mono size">' + wasHtml(before && String(before.size), String(row.size)) + '</td>' + rowLinkCellHtml(row.name, fieldCopy(row)) + '</tr>'
      );
    })
    .join('');

  body.innerHTML =
    '<table class="table"><thead><tr><th style="width: ' + (hasChangedRows ? 150 : 104) + 'px">Offset</th><th>Name</th><th>Type</th>' +
    '<th class="size" style="width: ' + (hasChangedRows ? 84 : 64) + 'px; text-align: right">Size</th><th class="row-actions"></th></tr></thead>' +
    '<tbody>' + rowsHtml + '</tbody></table>';
}

function renderFunctionsMain() {
  const functions = parseFunctions(viewerState.name);
  const change = entryDiff('functions', viewerState.name);
  const ownerType = symbolTarget(viewerState.name, 'C');
  const ownerLink = ownerType ? '<a class="link"' + gotoAttributes(ownerType, viewerState.name) + '>Open ' + (ownerType === 'classes' ? 'class' : 'struct') + '</a>' : '';

  mainPane.innerHTML =
    '<div class="entry-head">' +
    '<div class="entry-kind">functions</div>' +
    '<div class="entry-title"><h1>' + escapeHtml(viewerState.name) + '</h1>' + linkButtonHtml('icon-button', 'functions', viewerState.name) + diffTagHtml(change) + '</div>' +
    '<div class="entry-meta"><span>' + functions.length + ' functions</span>' + ownerLink + '</div>' +
    toolbarHtml(null, 'Filter functions') +
    '</div><div id="entry-body"></div>';

  renderFunctionsBody();
}

function renderFunctionsBody() {
  const body = document.getElementById('entry-body');
  const query = viewerState.memberFilter.trim().toLowerCase();
  const functions = displayFunctions(viewerState.name).filter((func) => !query || func.name.toLowerCase().includes(query));

  if (!functions.length) {
    body.innerHTML = '<div class="empty">No functions match.</div>';
    return;
  }

  body.innerHTML = functions
    .map((func) => {
      const change = func.diff;
      const before = change && change.status === 'changed' ? functionFromValue(func.name, change.before) : null;
      const flags = func.flags.map((flag) => '<span class="tag">' + escapeHtml(flag) + '</span>').join('');

      const previousSignature =
        before && !sameSignature(change.before, change.after) ? '<div class="was-line">was ' + escapeHtml(functionSignature(before)) + '</div>' : '';

      return (
        '<div class="function" data-member="' + escapeHtml(func.name) + '" aria-selected="' + (func.name === viewerState.member) + '" data-diff="' + (change ? change.status : '') + '">' +
        '<div class="signature">' + functionSignatureHtml(func) + '</div>' + previousSignature +
        '<div class="details"><button class="copy-value mono" type="button" data-copy-text="' + hex(func.address) + '" data-copy-message="Copied ' + escapeHtml(func.name) + ' offset" title="Copy offset">' +
        wasHtml(before && hex(before.address), hex(func.address)) + '</button>' +
        flags + '</div><div class="row-actions-float">' +
        rowActionsHtml(func.name, { text: functionSignature(func), message: 'Copied ' + func.name + ' signature', label: 'Copy ' + func.name + ' signature' }) +
        '</div></div>'
      );
    })
    .join('');
}

function renderEnumMain() {
  const enumEntry = parseEnum(viewerState.name);
  const change = entryDiff('enums', enumEntry.name);

  mainPane.innerHTML =
    '<div class="entry-head">' +
    '<div class="entry-kind">enum</div>' +
    '<div class="entry-title"><h1>' + escapeHtml(enumEntry.name) + '</h1>' +
    '<button class="icon-button" type="button" data-copy-name aria-label="Copy name" title="Copy name">' + COPY_ICON + '</button>' +
    linkButtonHtml('icon-button', 'enums', enumEntry.name) + diffTagHtml(change) +
    '<button class="button enum-copy" type="button" data-copy-text="' + escapeHtml(codeText(enumLines(enumEntry))) + '" data-copy-message="Copied ' + escapeHtml(enumEntry.name) + '">Copy enum</button></div>' +
    '<div class="entry-meta"><span class="mono">' + escapeHtml(enumEntry.underlyingType) + '</span><span>' + enumEntry.values.length + ' values</span></div>' +
    toolbarHtml(ENUM_VIEWS, 'Filter values') +
    '</div><div id="entry-body"></div>';

  renderEnumBody();
}

function renderEnumBody() {
  const body = document.getElementById('entry-body');
  const enumEntry = parseEnum(viewerState.name);

  if (viewerState.view === 'cpp') {
    const lines = enumLines(enumEntry);
    currentCode = codeText(lines);
    body.innerHTML = '<pre class="code">' + codeHtml(lines) + '</pre>';
    return;
  }

  const query = viewerState.memberFilter.trim().toLowerCase();
  const values = displayValues(enumEntry).filter((value) => !query || value.name.toLowerCase().includes(query));

  if (!values.length) {
    body.innerHTML = '<div class="empty">No values match.</div>';
    return;
  }

  const rowsHtml = values
    .map((value) => {
      const change = value.diff;
      const before = change && change.status === 'changed' ? change.before : null;

      return (
        '<tr data-member="' + escapeHtml(value.name) + '" aria-selected="' + (value.name === viewerState.member) + '" data-diff="' + (change ? change.status : '') + '">' +
        '<td class="member-name">' + highlightMatch(value.name, query) + '</td>' +
        '<td class="mono offset">' + wasHtml(before === null ? null : String(before), String(value.value)) + '</td>' +
        '<td class="mono faint secondary">' + wasHtml(before === null ? null : hex(before), hex(value.value)) + '</td>' + rowLinkCellHtml(value.name) + '</tr>'
      );
    })
    .join('');

  body.innerHTML =
    '<table class="table"><thead><tr><th>Name</th><th style="width: 160px">Value</th><th class="secondary" style="width: 160px">Hex</th><th class="row-actions"></th></tr></thead>' +
    '<tbody>' + rowsHtml + '</tbody></table>';
}

function isDumperEntry(name) {
  return name.endsWith('Dumper');
}

function isIndexEntry(name) {
  return name.startsWith('INDEX');
}

function renderOffsetsMain() {
  const dumper = DS.dumper
    ? '<span>Dumped with ' + (DS.dumperLink ? '<a class="link" href="' + escapeHtml(DS.dumperLink) + '" target="_blank" rel="noopener">' + escapeHtml(DS.dumper) + '</a>' : escapeHtml(DS.dumper)) + '</span>'
    : '';

  const rowsHtml = offsetRows()
    .map(({ name, value, diff }) => {
      const isNumber = !isDumperEntry(name);
      const before = diff && diff.status === 'changed' ? diff.before : null;

      return (
        '<tr data-member="' + escapeHtml(name) + '" aria-selected="' + (name === viewerState.member) + '" data-diff="' + (diff ? diff.status : '') + '">' +
        '<td class="member-name">' + escapeHtml(name) + '</td>' +
        '<td class="mono offset">' + wasHtml(before === null ? null : formatOffsetValue(name, before), formatOffsetValue(name, value)) + '</td>' +
        '<td class="mono faint secondary">' + (isNumber ? wasHtml(before === null ? null : String(before), String(value)) : '') + '</td>' +
        rowLinkCellHtml(name, isNumber ? { text: 'constexpr auto ' + name + ' = ' + hex(value) + ';', message: 'Copied ' + name, label: 'Copy ' + name } : null) + '</tr>'
      );
    })
    .join('');

  mainPane.innerHTML =
    '<div class="entry-head">' +
    '<div class="entry-kind">offsets</div>' +
    '<div class="entry-title"><h1>Global offsets</h1>' + linkButtonHtml('icon-button', 'offsets', null) + '</div>' +
    '<div class="entry-meta"><span>' + DS.offsets.length + ' values</span>' + dumper + '</div>' +
    '</div>' +
    '<table class="table"><thead><tr><th>Name</th><th style="width: 200px">Value</th><th class="secondary" style="width: 200px">Decimal</th><th class="row-actions"></th></tr></thead>' +
    '<tbody>' + rowsHtml + '</tbody></table>';
}

function scrollMemberIntoView() {
  if (!viewerState.member) return;

  const element = [...mainPane.querySelectorAll('[data-member]')].find(
    (candidate) => candidate.dataset.member === viewerState.member && !candidate.hasAttribute('aria-pressed'),
  );

  if (element) element.scrollIntoView({ block: 'center' });
}

function factsHtml(facts) {
  return '<dl class="facts">' + facts.map(([label, value]) => '<dt>' + label + '</dt><dd>' + value + '</dd>').join('') + '</dl>';
}

function snippetHtml(title, code) {
  return (
    '<div class="inspector-section"><div class="inspector-section-title">' + title +
    '<button class="link" type="button" data-copy-snippet>Copy</button></div>' +
    '<pre class="snippet" id="snippet">' + escapeHtml(code) + '</pre></div>'
  );
}

function derivedHtml(name) {
  const derived = DS.children[name] || [];
  if (!derived.length) return '';

  const items = derived
    .map((child) => '<a' + gotoAttributes(symbolTarget(child, 'C'), child) + '>' + escapeHtml(child) + '</a>')
    .join('');

  return (
    '<div class="inspector-section"><div class="inspector-section-title">Derived' +
    '<span class="title-actions"><span class="num">' + derived.length + '</span>' +
    '<button class="link" type="button" data-view="hierarchy">Show tree</button></span></div>' +
    '<div class="derived">' + items + '</div></div>'
  );
}

function renderInspector() {
  panes.toggleAttribute('data-inspecting', Boolean(viewerState.member));

  if (!viewerState.name) {
    inspectorPane.innerHTML = '';
    return;
  }

  if (viewerState.type === 'classes' || viewerState.type === 'structs') renderEntryInspector();
  else if (viewerState.type === 'functions') renderFunctionInspector();
  else if (viewerState.type === 'enums') renderEnumInspector();
  else renderOffsetInspector();
}

function structPreviewHtml(name) {
  const struct = parseEntry('structs', name);

  let meta = hex(struct.size) + ' · ' + struct.rows.length + ' fields';

  if (struct.inherit.length) meta += ' · extends ' + symbolLinkHtml(struct.inherit[0]);

  const rows = struct.rows
    .map((row) => {
      const offset = hex(row.offset) + (row.bit !== null ? ':' + row.bit : '');

      return (
        '<a class="preview-row"' + gotoAttributes('structs', name, row.name) + '>' +
        '<span class="mono offset">' + offset + '</span>' +
        '<span>' + kindDot(memberKind(row)) + escapeHtml(memberDisplayName(row)) + '</span>' +
        '<span class="mono muted preview-type">' + escapeHtml(typeString(row.type)) + '</span></a>'
      );
    })
    .join('');

  const body = rows ? '<div class="preview">' + rows + '</div>' : '<p class="faint" style="margin: 0">No fields of its own.</p>';

  return (
    '<div class="inspector-section"><div class="inspector-section-title">' +
    '<span class="preview-title"><b>' + escapeHtml(name) + '</b></span>' +
    '<a class="link"' + gotoAttributes('structs', name) + '>Open</a></div>' +
    '<div class="preview-meta">' + meta + '</div>' + body + '</div>'
  );
}

function enumPreviewHtml(name, memberName) {
  if (!DS.enums) {
    ensureType('enums').then(
      () => viewerState.member === memberName && renderInspector(),
      () => {},
    );

    return '<div class="inspector-section"><div class="inspector-section-title">' + escapeHtml(name) + '</div><p class="faint" style="margin: 0">Loading values…</p></div>';
  }

  const enumEntry = parseEnum(name);
  if (!enumEntry) return '';

  const rows = enumEntry.values
    .map(
      (value) =>
        '<a class="preview-row enum-value"' + gotoAttributes('enums', name, value.name) + '>' +
        '<span>' + escapeHtml(value.name) + '</span><span class="mono offset">' + value.value + '</span></a>',
    )
    .join('');

  return (
    '<div class="inspector-section"><div class="inspector-section-title">' +
    '<span class="preview-title"><b>' + escapeHtml(name) + '</b></span>' +
    '<a class="link"' + gotoAttributes('enums', name) + '>Open</a></div>' +
    '<div class="preview-meta">' + escapeHtml(enumEntry.underlyingType) + ' · ' + enumEntry.values.length + ' values</div>' +
    '<div class="preview">' + rows + '</div></div>'
  );
}

function inspectorTitleHtml(title, actions) {
  return '<div class="inspector-title"><h2>' + escapeHtml(title) + '</h2><div class="inspector-actions">' + actions + '</div></div>';
}

function renderEntryInspector() {
  const type = viewerState.type;
  const entry = parseEntry(type, viewerState.name);
  const row = displayRows(type, entry).find((candidate) => candidate.name === viewerState.member);
  const entryChange = entryDiff(type, entry.name);
  const before = entryChange && entryChange.status === 'changed' ? entryFromMembers(type, entry.name, entryChange.before) : null;
  const entryFacts = [];

  if (before && before.size !== entry.size) entryFacts.push(['Was size', hex(before.size)]);

  if (before && !sameTypeName(before.inherit[0] || '', entry.inherit[0] || '')) entryFacts.push(['Was parent', escapeHtml(before.inherit[0] || 'none')]);

  const summary =
    '<div class="inspector-section" style="' + (row ? '' : 'margin-top: 0; padding-top: 0; border-top: 0') + '">' +
    '<div class="inspector-section-title">' + escapeHtml(entry.name) + '</div>' +
    (row ? '' : diffNoteHtml(entryChange, entryFacts)) +
    factsHtml([
      ['Size', hex(entry.size) + ' <span class="faint">(' + entry.size + ')</span>'],
      ['Fields', String(entry.rows.length)],
      ['Depth', String(entry.inherit.length)],
      ['Parent', entry.inherit[0] ? symbolLinkHtml(entry.inherit[0]) : '<span class="faint">none</span>'],
    ]) +
    '</div>' +
    derivedHtml(entry.name);

  if (!row) {
    inspectorPane.innerHTML = summary + '<p class="faint" style="margin: 20px 0 0">Select a field to inspect it.</p>';
    return;
  }

  const kind = memberKind(row);
  const target = symbolTarget(row.type[0], row.type[1]);

  const facts = [
    ['Offset', offsetLabel(row)],
    ['Decimal', String(row.offset)],
    ['Size', row.size + (row.size === 1 ? ' byte' : ' bytes')],
    ['Type', typeHtml(row.type)],
  ];

  if (row.bit !== null) facts.push(['Bit', String(row.bit)]);

  if (row.arrayDim > 1) facts.push(['Array', '[' + row.arrayDim + ']']);

  const preview = previewTarget(row.type);

  let previewHtml = '';

  if (preview && preview[0] === 'structs') previewHtml = structPreviewHtml(preview[1]);

  if (preview && preview[0] === 'enums') previewHtml = enumPreviewHtml(preview[1], row.name);

  const openButton = target && !previewHtml
    ? '<a class="button" style="margin-top: 14px; width: 100%; justify-content: center"' + gotoAttributes(target, row.type[0]) + '>Open ' + escapeHtml(row.type[0]) + '</a>'
    : '';

  inspectorPane.innerHTML =
    inspectorTitleHtml(row.name, rowActionsHtml(row.name, fieldCopy(row))) +
    '<div class="kind-line">' + kindDot(kind) + KIND_LABELS[kind] + '</div>' +
    diffNoteHtml(row.diff, memberDiffFacts(row)) +
    factsHtml(facts) +
    openButton +
    previewHtml +
    snippetHtml('Read it', readSnippet(row)) +
    summary;
}

function renderFunctionInspector() {
  const functions = displayFunctions(viewerState.name);
  const func = functions.find((candidate) => candidate.name === viewerState.member);

  if (!func) {
    inspectorPane.innerHTML =
      '<div class="inspector-section-title">' + escapeHtml(viewerState.name) + '</div>' +
      diffNoteHtml(entryDiff('functions', viewerState.name)) +
      factsHtml([['Functions', String(parseFunctions(viewerState.name).length)]]) +
      '<p class="faint" style="margin: 20px 0 0">Select a function to inspect it.</p>';
    return;
  }

  const before = func.diff && func.diff.status === 'changed' ? functionFromValue(func.name, func.diff.before) : null;
  const diffFacts = [];

  if (before && before.address !== func.address) diffFacts.push(['Was at', hex(before.address)]);

  if (before && !sameSignature(func.diff.before, func.diff.after)) diffFacts.push(['Was', escapeHtml(functionSignature(before))]);

  if (before && before.flags.join('|') !== func.flags.join('|')) diffFacts.push(['Was flags', escapeHtml(before.flags.join(', '))]);

  const parameterItems = func.parameters.map(
    (parameter) => '<div>' + typeHtml(parameter.type) + escapeHtml(parameter.suffix) + ' <span class="muted">' + escapeHtml(parameter.name) + '</span></div>',
  );

  const parameters = parameterItems.length
    ? '<div class="parameter-list">' + parameterItems.join('') + '</div>'
    : '<p class="faint" style="margin: 0">No parameters.</p>';

  inspectorPane.innerHTML =
    inspectorTitleHtml(func.name, rowActionsHtml(func.name, { text: functionSignature(func), message: 'Copied ' + func.name + ' signature', label: 'Copy ' + func.name + ' signature' })) +
    '<div class="kind-line">' + escapeHtml(viewerState.name) + '</div>' +
    diffNoteHtml(func.diff, diffFacts) +
    factsHtml([
      ['Offset', hex(func.address)],
      ['Returns', typeHtml(func.returnType)],
    ]) +
    '<div class="inspector-section"><div class="inspector-section-title">Parameters</div>' + parameters + '</div>' +
    '<div class="inspector-section"><div class="inspector-section-title">Flags</div><div class="details" style="display: flex; flex-wrap: wrap; gap: 6px">' +
    func.flags.map((flag) => '<span class="tag">' + escapeHtml(flag) + '</span>').join('') + '</div></div>' +
    snippetHtml('Signature', functionSignature(func));
}

function renderEnumInspector() {
  const enumEntry = parseEnum(viewerState.name);
  const value = displayValues(enumEntry).find((candidate) => candidate.name === viewerState.member);

  const summary = factsHtml([
    ['Underlying', escapeHtml(enumEntry.underlyingType)],
    ['Values', String(enumEntry.values.length)],
  ]);

  if (!value) {
    inspectorPane.innerHTML =
      '<div class="inspector-section-title">' + escapeHtml(enumEntry.name) + '</div>' +
      diffNoteHtml(entryDiff('enums', enumEntry.name)) + summary +
      '<p class="faint" style="margin: 20px 0 0">Select a value to inspect it.</p>';
    return;
  }

  const diffFacts = value.diff && value.diff.status === 'changed' ? [['Was', String(value.diff.before)]] : [];

  inspectorPane.innerHTML =
    inspectorTitleHtml(value.name, rowActionsHtml(value.name)) +
    '<div class="kind-line">' + escapeHtml(enumEntry.name) + '</div>' +
    diffNoteHtml(value.diff, diffFacts) +
    factsHtml([
      ['Value', String(value.value)],
      ['Hex', hex(value.value)],
    ]) +
    snippetHtml('Use it', enumEntry.name + '::' + value.name) +
    '<div class="inspector-section"><div class="inspector-section-title">' + escapeHtml(enumEntry.name) + '</div>' + summary + '</div>';
}

function renderOffsetInspector() {
  const offset = offsetRows().find((row) => row.name === viewerState.member);

  if (!offset) {
    inspectorPane.innerHTML =
      '<div class="inspector-section-title">Global offsets</div>' +
      '<p class="muted" style="margin: 0; line-height: 1.6">Offsets from the module base for this build' +
      (DS.dumper ? ', from ' + escapeHtml(DS.dumper) : '') + '. Select one to get a snippet.</p>';
    return;
  }

  const { name, value, diff } = offset;
  const copy = isDumperEntry(name) ? null : { text: 'constexpr auto ' + name + ' = ' + hex(value) + ';', message: 'Copied ' + name, label: 'Copy ' + name };
  const title = inspectorTitleHtml(name, rowActionsHtml(name, copy));
  const diffFacts = diff && diff.status === 'changed' ? [['Was', formatOffsetValue(name, diff.before)]] : [];
  const note = diffNoteHtml(diff, diffFacts);

  if (isDumperEntry(name)) {
    inspectorPane.innerHTML = title + note + factsHtml([['Value', String(value)]]);
    return;
  }

  if (isIndexEntry(name)) {
    const functionName = name.replace(/^INDEX_/, '').toLowerCase();

    inspectorPane.innerHTML =
      title +
      '<div class="kind-line">Virtual table index</div>' +
      note +
      factsHtml([
        ['Index', hex(value)],
        ['Decimal', String(value)],
        ['Byte offset', hex(value * 8)],
      ]) +
      snippetHtml('Use it', 'const auto ' + functionName + ' = (*reinterpret_cast<void***>(object))[' + hex(value) + '];');
    return;
  }

  const variableName = name.replace(/^OFFSET_/, '').toLowerCase();

  inspectorPane.innerHTML =
    title +
    note +
    factsHtml([
      ['Offset', hex(value)],
      ['Decimal', String(value)],
    ]) +
    snippetHtml('Use it', 'const uintptr_t ' + variableName + ' = moduleBase + ' + hex(value) + ';');
}

function paletteCandidates() {
  const candidates = [];

  for (const type of ['classes', 'structs', 'enums']) {
    if (!DS[type]) continue;

    for (const name of namesOf(type)) candidates.push([name, type]);
  }

  return candidates;
}

function openPalette() {
  closeGlobalSearch();

  palette.hidden = false;
  paletteInput.value = '';

  if (!DS.enums) ensureType('enums').then(() => !palette.hidden && renderPalette(), () => {});

  renderPalette();
  paletteInput.focus();
}

function closePalette() {
  palette.hidden = true;
}

function renderPalette() {
  const query = paletteInput.value.trim().toLowerCase();

  if (!query) {
    paletteMatches = namesOf(viewerState.type === 'offsets' || viewerState.type === 'functions' ? 'classes' : viewerState.type)
      .slice(0, 50)
      .map((name) => [name, viewerState.type === 'offsets' || viewerState.type === 'functions' ? 'classes' : viewerState.type]);
  } else {
    const exact = [];
    const prefix = [];
    const contains = [];

    for (const candidate of paletteCandidates()) {
      const lowerName = candidate[0].toLowerCase();
      const position = lowerName.indexOf(query);
      if (position < 0) continue;

      if (lowerName === query) exact.push(candidate);
      else if (position === 0) prefix.push(candidate);
      else if (contains.length < 50) contains.push(candidate);
    }

    paletteMatches = exact.concat(prefix, contains).slice(0, 50);
  }

  paletteIndex = 0;

  if (!paletteMatches.length) {
    paletteResults.innerHTML = '<div class="empty" style="padding: 24px">No symbols match.</div>';
    return;
  }

  paletteResults.innerHTML = paletteMatches
    .map(
      ([name, type], index) =>
        '<div class="palette-item" role="option" data-palette-index="' + index + '" aria-selected="' + (index === 0) + '">' +
        '<span>' + highlightMatch(name, query) + '</span><span class="mono faint">' + typeInfo(type).kind + '</span></div>',
    )
    .join('');
}

function movePalette(step) {
  if (!paletteMatches.length) return;

  paletteIndex = Math.min(paletteMatches.length - 1, Math.max(0, paletteIndex + step));

  for (const item of paletteResults.querySelectorAll('.palette-item')) {
    const selected = Number(item.dataset.paletteIndex) === paletteIndex;
    item.setAttribute('aria-selected', String(selected));

    if (selected) item.scrollIntoView({ block: 'nearest' });
  }
}

function choosePalette(index) {
  const match = paletteMatches[index];
  if (!match) return;

  closePalette();
  goto(match[1], match[0]);
}

function versionDate(seconds) {
  return new Date(seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function versionLabel(sha) {
  const version = historyVersions && historyVersions.find((candidate) => candidate.sha === sha);
  if (!version) return 'commit ' + sha.slice(0, 7);

  return versionDate(version.date) + ' by ' + version.uploader;
}

function gameHistory() {
  historyLoad ||= loadGameHistory(DS.game).then(
    (versions) => {
      historyVersions = versions;
      return versions;
    },
    (error) => {
      historyLoad = null;
      throw error;
    },
  );

  return historyLoad;
}

function renderVersionBar() {
  let html = '';

  if (DS.sha) {
    const latestUrl = viewUrl(viewerState.type, viewerState.name, viewerState.member, null);

    html +=
      '<div class="version-bar" data-tone="viewing"><span>Viewing the upload from <b>' + escapeHtml(versionLabel(DS.sha)) + '</b>, not the latest one.</span>' +
      '<a class="button" href="' + escapeHtml(latestUrl) + '">Back to latest</a></div>';
  }

  if (diffState.sha) {
    const summary = diffFor(viewerState.type);
    const error = diffState.errors[viewerState.type];
    const label = typeInfo(viewerState.type).label.toLowerCase();

    let status = '<span class="faint">Loading…</span>';

    if (error) status = '<span class="diff-error">Couldn’t load the compared ' + label + ': ' + escapeHtml(error) + '</span>';

    if (summary) {
      status = ['added', 'changed', 'removed']
        .map((key) => '<span class="diff-count" data-status="' + key + '">' + summary.counts[key].toLocaleString() + ' ' + (key === 'added' ? 'new' : key) + '</span>')
        .join('');

      if (summary.fewNamesMatch) {
        status += '<span class="faint">Few names match, likely a different dumper.</span>';
      }
    }

    html +=
      '<div class="version-bar" data-tone="compare"><span>Comparing ' + label + ' with <b>' + escapeHtml(versionLabel(diffState.sha)) + '</b></span>' + status +
      '<label class="check"><input type="checkbox" id="changed-only"' + (diffState.changedOnly ? ' checked' : '') + (summary ? '' : ' disabled') + '> Changed only</label>' +
      '<button class="button" type="button" data-exit-compare>Exit compare</button></div>';
  }

  versionBar.innerHTML = html;
}

async function startCompare(sha) {
  resetDiff(sha);
  renderVersionBar();

  await openType(viewerState.type, viewerState.name, viewerState.member, 'replace');
}

async function exitCompare() {
  resetDiff(null);
  renderVersionBar();

  await openType(viewerState.type, viewerState.name, viewerState.member, 'replace');
}

function historyRowHtml(version, index) {
  const viewingSha = DS.sha || historyVersions[0].sha;
  const isViewing = version.sha === viewingSha;
  const isCompared = version.sha === diffState.sha;

  const time = new Date(version.date * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const pullRequest = version.pullRequest
    ? ' · <a class="link" href="https://github.com/' + DS_REPO + '/pull/' + version.pullRequest + '" target="_blank" rel="noopener">#' + version.pullRequest + '</a>'
    : '';

  let tags = '';

  if (index === 0) tags += '<span class="tag">Latest</span>';

  if (isViewing) tags += '<span class="tag tag-accent">Viewing</span>';

  if (isCompared) tags += '<span class="tag tag-accent">Comparing</span>';

  let actions = '';

  if (!isViewing) {
    const openUrl = viewUrl(viewerState.type, viewerState.name, viewerState.member, index === 0 ? null : version.sha, null);

    actions +=
      '<a class="button" href="' + escapeHtml(openUrl) + '">Open</a>' +
      '<button class="button" type="button" data-compare="' + escapeHtml(version.sha) + '"' + (isCompared ? ' disabled' : '') + '>Compare</button>';
  }

  return (
    '<div class="history-row" data-viewing="' + isViewing + '">' +
    '<div class="history-main"><div class="history-date"><span>' + versionDate(version.date) + ' · ' + time + '</span>' + tags + '</div>' +
    '<div class="history-meta">' + uploaderLinkHtml(version.uploader, null) + ' · ' + timeAgo(version.date) + pullRequest + '</div></div>' +
    '<div class="history-actions">' + actions + '</div></div>'
  );
}

function renderHistory(error = null) {
  if (error) {
    historyList.innerHTML =
      '<div class="empty">' + escapeHtml(error.message) + '<br><button class="link" type="button" data-retry-history>Try again</button></div>';
    return;
  }

  if (!historyVersions) {
    historyList.innerHTML = '<div class="empty">Loading uploads from GitHub…</div>';
    return;
  }

  if (!historyVersions.length) {
    historyList.innerHTML = '<div class="empty">No merged uploads for this game in ' + DS_REPO + '.</div>';
    return;
  }

  historyList.innerHTML =
    '<p class="history-hint">Open shows the game as it was after that upload. Compare marks what changed since then in the version you’re viewing.</p>' +
    historyVersions.map(historyRowHtml).join('');
}

function openHistory() {
  historyDrawer.hidden = false;
  document.getElementById('history-subtitle').textContent = DS.game.name;

  renderHistory();

  if (!historyVersions) {
    gameHistory().then(
      () => {
        renderHistory();
        renderVersionBar();
        renderInspector();
      },
      (error) => renderHistory(error),
    );
  }
}

function closeHistory() {
  historyDrawer.hidden = true;
}

const dumpState = {
  includeFunctions: false,
  building: false,
  error: '',
  downloadUrl: '',
  fileName: '',
  size: 0,
};

function dumpSizeText(size) {
  return size >= 1048576 ? (size / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(size / 1024)) + ' KB';
}

function dumpStatusHtml() {
  if (dumpState.building) return '<p class="dump-status">Building the dump…</p>';

  if (dumpState.error) return '<p class="dump-status dump-error">' + escapeHtml(dumpState.error) + '</p>';

  if (!dumpState.downloadUrl) return '';

  return (
    '<p class="dump-status">Downloaded <a class="link" href="' + escapeHtml(dumpState.downloadUrl) + '" download="' +
    escapeHtml(dumpState.fileName) + '">' + escapeHtml(dumpState.fileName) + '</a> (' + dumpSizeText(dumpState.size) + ')</p>'
  );
}

function renderDump() {
  const disabled = dumpState.building ? ' disabled' : '';
  const source = DS.sha ? 'the upload from commit ' + escapeHtml(DS.sha.slice(0, 7)) : 'this upload';

  dumpBody.innerHTML =
    '<p class="history-hint">Writes every class, struct and enum from ' + source + ' in the PropertyDump.txt format: one declaration per type, with each member’s offset and size.</p>' +
    '<label class="dump-field"><input type="checkbox" id="dump-functions"' + (dumpState.includeFunctions ? ' checked' : '') + disabled + '>' +
    '<span>Include functions, with their address and flags</span></label>' +
    '<div class="dump-actions"><button class="button button-primary" type="button" id="dump-download"' + disabled + '>Download ' +
    escapeHtml(propertyDumpFileName(DS.game.name)) + '</button></div>' +
    dumpStatusHtml();
}

function openDump() {
  dumpDrawer.hidden = false;
  document.getElementById('dump-subtitle').textContent = DS.game.name;

  renderDump();
}

function closeDump() {
  dumpDrawer.hidden = true;
}

async function downloadDump() {
  if (dumpState.building) return;

  if (dumpState.downloadUrl) URL.revokeObjectURL(dumpState.downloadUrl);

  Object.assign(dumpState, { building: true, error: '', downloadUrl: '', size: 0 });
  renderDump();

  try {
    await Promise.all([ensureType('functions'), ensureType('enums')]);
    await new Promise((resolve) => setTimeout(resolve));

    const dumpFile = new Blob([propertyDumpText(DS, dumpState.includeFunctions)], { type: 'text/plain' });

    dumpState.fileName = propertyDumpFileName(DS.game.name);
    dumpState.downloadUrl = URL.createObjectURL(dumpFile);
    dumpState.size = dumpFile.size;
  } catch (error) {
    dumpState.error = 'Couldn’t build the dump: ' + error.message;
  }

  dumpState.building = false;
  renderDump();

  if (!dumpState.downloadUrl) return;

  const link = document.createElement('a');
  link.href = dumpState.downloadUrl;
  link.download = dumpState.fileName;
  link.click();
}

const SEARCH_LIMIT = 200;

const searchState = {
  mode: 'name',
  sections: new Set(['classes', 'structs', 'enums']),
  parameters: false,
  items: [],
  index: 0,
};

const searchIndexes = {};

let searchTimer = 0;

function searchIndex(type) {
  if (searchIndexes[type]) return searchIndexes[type];

  const items = [];

  if (type === 'classes' || type === 'structs') {
    for (const [owner, members] of Object.entries(DS[type])) {
      for (const member of members) {
        const name = Object.keys(member)[0];
        if (name.startsWith('__')) continue;

        const value = member[name];
        const typeText = typeString(value[0]);

        items.push({
          owner,
          name,
          nameLower: name.toLowerCase(),
          detail: typeText,
          typeLower: typeText.toLowerCase(),
          location: hex(value[1]) + (value.length > 4 ? ':' + value[4] : ''),
        });
      }
    }
  }

  if (type === 'functions') {
    for (const [owner, functions] of Object.entries(DS.functions)) {
      for (const entry of functions) {
        const name = Object.keys(entry)[0];
        const [returnType, parameters, address] = entry[name];
        const returnText = typeString(returnType);

        items.push({
          owner,
          name,
          nameLower: name.toLowerCase(),
          detail: returnText + ' (' + parameters.length + (parameters.length === 1 ? ' parameter)' : ' parameters)'),
          typeLower: returnText.toLowerCase(),
          parameterNamesLower: parameters.map((parameter) => parameter[2]).join('\n').toLowerCase(),
          parameterTypesLower: parameters.map((parameter) => typeString(parameter[0])).join('\n').toLowerCase(),
          location: hex(address),
        });
      }
    }
  }

  if (type === 'enums') {
    for (const [owner, [values]] of Object.entries(DS.enums)) {
      for (const value of values) {
        const name = Object.keys(value)[0];

        items.push({ owner, name, nameLower: name.toLowerCase(), detail: '= ' + value[name], typeLower: '', location: '' });
      }
    }
  }

  searchIndexes[type] = items;

  return items;
}

function searchMatch(type, item, query) {
  const checkParameters = type === 'functions' && searchState.parameters;

  if (searchState.mode === 'name') {
    if (item.nameLower.includes(query)) return item.nameLower === query ? 'exact' : 'partial';

    return checkParameters && item.parameterNamesLower.includes(query) ? 'partial' : null;
  }

  if (item.typeLower.includes(query)) return item.typeLower === query || item.typeLower === query + '*' ? 'exact' : 'partial';

  return checkParameters && item.parameterTypesLower.includes(query) ? 'partial' : null;
}

function searchSections() {
  return TYPES.filter((type) => searchState.sections.has(type.key)).filter((type) => !(type.key === 'enums' && searchState.mode === 'type'));
}

function searchItemHtml(type, item, index, query) {
  const highlighted = searchState.mode === 'name' ? highlightMatch(item.name, query) : escapeHtml(item.name);
  const detail = searchState.mode === 'type' ? highlightMatch(item.detail, query) : escapeHtml(item.detail);

  return (
    '<a class="search-item" role="option" data-search-index="' + index + '" aria-selected="' + (index === searchState.index) + '"' +
    gotoAttributes(type, item.owner, item.name) + '>' +
    '<span class="search-owner">' + escapeHtml(item.owner) + '</span>' +
    '<span class="search-name">' + highlighted + '</span>' +
    '<span class="search-detail mono">' + detail + '</span>' +
    '<span class="search-location mono">' + item.location + '</span></a>'
  );
}

function runGlobalSearch() {
  const results = document.getElementById('global-search-results');
  const status = document.getElementById('global-search-status');
  const query = document.getElementById('global-search-input').value.trim().toLowerCase();
  const sections = searchSections();

  searchState.items = [];
  searchState.index = 0;

  if (query.length < 2) {
    status.textContent = '';
    results.innerHTML = '<div class="search-hint">Type at least 2 characters. <b>Name</b> matches member names; <b>Type</b> matches types anywhere in them, e.g. <code>APlayerState</code> finds <code>TArray&lt;APlayerState*&gt;</code>.</div>';
    return;
  }

  if (!sections.length) {
    status.textContent = '';
    results.innerHTML = '<div class="search-hint">Pick at least one section to search.</div>';
    return;
  }

  const pending = sections.filter((type) => !DS[type.key]);

  if (pending.length) {
    status.textContent = 'Loading ' + pending.map((type) => type.label.toLowerCase()).join(' and ') + '…';

    Promise.all(pending.map((type) => ensureType(type.key))).then(runGlobalSearch, (error) => {
      status.textContent = '';
      results.innerHTML = '<div class="search-hint">Couldn’t load: ' + escapeHtml(error.message) + '</div>';
    });

    return;
  }

  const started = performance.now();
  let html = '';
  let total = 0;

  for (const section of sections) {
    const exact = [];
    const partial = [];
    let count = 0;

    for (const item of searchIndex(section.key)) {
      const match = searchMatch(section.key, item, query);
      if (!match) continue;

      count++;

      if (match === 'exact') exact.push(item);
      else if (partial.length < SEARCH_LIMIT) partial.push(item);
    }

    total += count;

    if (!count) continue;

    const shown = exact.concat(partial).slice(0, SEARCH_LIMIT);
    const more = count > shown.length ? ' · showing ' + shown.length : '';

    html += '<div class="search-group-title">' + section.label + '<span>' + count.toLocaleString() + (count === 1 ? ' match' : ' matches') + more + '</span></div>';

    for (const item of shown) {
      html += searchItemHtml(section.key, item, searchState.items.length, query);
      searchState.items.push(item);
    }
  }

  status.textContent = total.toLocaleString() + ' matches in ' + Math.round(performance.now() - started) + ' ms';
  results.innerHTML = html || '<div class="search-hint">No members match “' + escapeHtml(query) + '”.</div>';
  results.scrollTop = 0;
}

function scheduleGlobalSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runGlobalSearch, 150);
}

function openGlobalSearch() {
  closePalette();
  globalSearch.hidden = false;

  const input = document.getElementById('global-search-input');
  input.focus();
  input.select();

  runGlobalSearch();
}

function closeGlobalSearch() {
  globalSearch.hidden = true;
}

function moveSearchSelection(step) {
  if (!searchState.items.length) return;

  searchState.index = Math.min(searchState.items.length - 1, Math.max(0, searchState.index + step));

  for (const item of globalSearch.querySelectorAll('.search-item')) {
    const selected = Number(item.dataset.searchIndex) === searchState.index;
    item.setAttribute('aria-selected', String(selected));

    if (selected) item.scrollIntoView({ block: 'nearest' });
  }
}

function bindGlobalSearch() {
  const input = document.getElementById('global-search-input');
  const results = document.getElementById('global-search-results');
  const parametersBox = document.getElementById('search-parameters');

  document.getElementById('open-search').addEventListener('click', openGlobalSearch);

  input.addEventListener('input', scheduleGlobalSearch);

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveSearchSelection(event.key === 'ArrowDown' ? 1 : -1);
    }

    if (event.key !== 'Enter') return;

    const selected = globalSearch.querySelector('.search-item[aria-selected="true"]');
    if (selected) selected.click();
  });

  globalSearch.addEventListener('click', (event) => {
    const modeButton = event.target.closest('[data-search-mode]');
    if (modeButton) {
      searchState.mode = modeButton.dataset.searchMode;

      globalSearch.querySelector('[data-search-section="enums"]').disabled = searchState.mode === 'type';

      for (const button of globalSearch.querySelectorAll('[data-search-mode]')) {
        button.setAttribute('aria-pressed', String(button === modeButton));
      }

      runGlobalSearch();
      input.focus();
      return;
    }

    const item = event.target.closest('.search-item');
    if (item && !event.ctrlKey && !event.metaKey && !event.shiftKey) closeGlobalSearch();
  });

  globalSearch.addEventListener('change', (event) => {
    const section = event.target.dataset.searchSection;

    if (section) {
      if (event.target.checked) searchState.sections.add(section);
      else searchState.sections.delete(section);

      parametersBox.disabled = !searchState.sections.has('functions');
    }

    if (event.target === parametersBox) searchState.parameters = parametersBox.checked;

    runGlobalSearch();
  });

  results.addEventListener('mousemove', (event) => {
    const item = event.target.closest('.search-item');
    if (!item || Number(item.dataset.searchIndex) === searchState.index) return;

    searchState.index = Number(item.dataset.searchIndex);

    for (const other of results.querySelectorAll('.search-item[aria-selected="true"]')) other.setAttribute('aria-selected', 'false');

    item.setAttribute('aria-selected', 'true');
  });

  globalSearch.addEventListener('mousedown', (event) => {
    if (event.target === globalSearch) closeGlobalSearch();
  });
}

function isPhone() {
  return window.matchMedia('(max-width: 760px)').matches;
}

function setListOpen(open) {
  panes.toggleAttribute('data-list-open', open);

  if (open) requestAnimationFrame(() => scrollSymbolIntoView(viewerState.name));
}

function bindEvents() {
  typeTabs.addEventListener('click', (event) => {
    if (event.target.closest('[data-list-toggle]')) {
      setListOpen(!panes.hasAttribute('data-list-open'));
      return;
    }

    const tab = event.target.closest('[data-tab]');
    if (!tab) return;

    if (isPhone()) setListOpen(true);

    if (tab.dataset.tab !== viewerState.type) openType(tab.dataset.tab);
  });

  bindGlobalSearch();

  enableHorizontalStrip(typeTabs);

  document.getElementById('close-inspector').addEventListener('click', () => selectMember(null));

  mainPane.addEventListener('click', (event) => {
    const switchButton = event.target.closest('[data-switch-tab]');
    if (switchButton) openType(switchButton.dataset.switchTab);
  });

  symbolFilterInput.addEventListener('input', () => {
    viewerState.symbolFilter = symbolFilterInput.value;
    filterSymbols();
    renderSymbols();
  });

  symbolFilterInput.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      stepSymbol(event.key === 'ArrowDown' ? 1 : -1);
    }

    if (event.key === 'Enter' && filteredSymbols.length && !filteredSymbols.includes(viewerState.name)) openSymbol(filteredSymbols[0]);
  });

  symbolList.addEventListener('scroll', () => requestAnimationFrame(renderSymbols));

  symbolList.addEventListener('click', (event) => {
    const row = event.target.closest('[data-symbol]');
    if (!row) return;

    openSymbol(row.dataset.symbol);
    setListOpen(false);
  });

  symbolList.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

    event.preventDefault();
    stepSymbol(event.key === 'ArrowDown' ? 1 : -1);
  });

  new ResizeObserver(() => renderSymbols()).observe(symbolList);

  document.addEventListener('click', (event) => {
    const gotoElement = event.target.closest('[data-goto-type]');
    if (gotoElement) {
      if (event.ctrlKey || event.metaKey || event.shiftKey) return;

      event.preventDefault();
      goto(gotoElement.dataset.gotoType, gotoElement.dataset.gotoName, gotoElement.dataset.gotoMember || null);
      return;
    }

    const depthButton = event.target.closest('[data-depth]');
    if (depthButton) {
      viewerState.depth = Number(depthButton.dataset.depth);
      renderMain();
      return;
    }

    if (event.target.closest('[data-exit-compare]')) {
      exitCompare();
      return;
    }

    const viewButton = event.target.closest('[data-view]');
    if (viewButton) {
      if (viewerState.view !== viewButton.dataset.view) viewerState.memberFilter = '';

      viewerState.view = viewButton.dataset.view;
      renderMain();
      return;
    }

    if (event.target.closest('[data-copy-code]')) {
      copyText(currentCode, 'Copied code');
      return;
    }

    if (event.target.closest('[data-copy-snippet]')) {
      copyText(document.getElementById('snippet').textContent, 'Copied');
      return;
    }

    const copyButton = event.target.closest('[data-copy-text]');
    if (copyButton) {
      copyText(copyButton.dataset.copyText, copyButton.dataset.copyMessage || 'Copied');
      return;
    }

    const linkButton = event.target.closest('[data-copy-link]');
    if (linkButton) {
      copyText(linkButton.dataset.copyLink, 'Copied link to ' + linkButton.dataset.linkLabel);
      return;
    }

    if (event.target.closest('[data-copy-name]')) {
      copyText(viewerState.name, 'Copied ' + viewerState.name);
      return;
    }

    const memberElement = event.target.closest('#main [data-member]');
    if (memberElement) {
      selectMember(memberElement.dataset.member);

      if (memberElement.hasAttribute('aria-pressed')) scrollMemberIntoView();
    }
  });

  mainPane.addEventListener('input', (event) => {
    if (event.target.id !== 'member-filter') return;

    viewerState.memberFilter = event.target.value;

    if (viewerState.type === 'functions') renderFunctionsBody();
    else if (viewerState.type === 'enums') renderEnumBody();
    else renderEntryBody();
  });

  document.getElementById('open-palette').addEventListener('click', openPalette);

  document.getElementById('copy-link').addEventListener('click', () => copyText(location.href, 'Copied link'));

  document.getElementById('open-history').addEventListener('click', openHistory);

  document.getElementById('close-history').addEventListener('click', closeHistory);

  historyDrawer.addEventListener('mousedown', (event) => {
    if (event.target === historyDrawer) closeHistory();
  });

  document.getElementById('open-dump').addEventListener('click', openDump);

  document.getElementById('close-dump').addEventListener('click', closeDump);

  dumpDrawer.addEventListener('mousedown', (event) => {
    if (event.target === dumpDrawer) closeDump();
  });

  dumpBody.addEventListener('change', (event) => {
    if (event.target.id === 'dump-functions') dumpState.includeFunctions = event.target.checked;
  });

  dumpBody.addEventListener('click', (event) => {
    if (event.target.closest('#dump-download')) downloadDump();
  });

  historyList.addEventListener('click', (event) => {
    const compareButton = event.target.closest('[data-compare]');
    if (compareButton) {
      closeHistory();
      startCompare(compareButton.dataset.compare);
      return;
    }

    if (event.target.closest('[data-retry-history]')) openHistory();
  });

  versionBar.addEventListener('change', (event) => {
    if (event.target.id !== 'changed-only') return;

    diffState.changedOnly = event.target.checked;
    filterSymbols();
    renderSymbols();
    scrollSymbolIntoView(viewerState.name);
  });

  paletteInput.addEventListener('input', renderPalette);

  paletteInput.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      movePalette(event.key === 'ArrowDown' ? 1 : -1);
    }

    if (event.key === 'Enter') choosePalette(paletteIndex);
  });

  paletteResults.addEventListener('click', (event) => {
    const item = event.target.closest('[data-palette-index]');
    if (item) choosePalette(Number(item.dataset.paletteIndex));
  });

  palette.addEventListener('mousedown', (event) => {
    if (event.target === palette) closePalette();
  });

  document.addEventListener('keydown', (event) => {
    const searchShortcut = (event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'f';
    const paletteShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';

    if (searchShortcut) {
      event.preventDefault();
      openGlobalSearch();
      return;
    }

    if (paletteShortcut || (event.key === '/' && !isTyping(event))) {
      event.preventDefault();
      openPalette();
      return;
    }

    if (event.key !== 'Escape') return;

    if (!palette.hidden) closePalette();

    if (!globalSearch.hidden) closeGlobalSearch();

    if (!historyDrawer.hidden) closeHistory();

    if (!dumpDrawer.hidden) closeDump();
  });

  window.addEventListener('popstate', () => applyLocation('none'));
}

function renderCrumb() {
  const game = DS.game;

  document.getElementById('crumb').innerHTML =
    thumbHtml(game) +
    '<span class="game-name">' + escapeHtml(game.name) + '</span>' +
    '<span class="tag">' + escapeHtml(game.engine) + '</span>' +
    '<span class="when">Updated ' + timeAgo(game.uploaded) + ' by ' + uploaderLinkHtml(game.uploader, game.uploaderLink) + '</span>';
}

async function startViewer() {
  if (/Mac|iPhone|iPad/.test(navigator.platform)) document.getElementById('palette-shortcut').textContent = '⌘K';

  const params = new URLSearchParams(location.search);
  const hash = params.get('hash');
  const sha = params.get('sha');

  if (!hash) {
    mainPane.innerHTML = '<div class="empty">No game selected. <a class="link" href="index.html">Pick one from the library.</a></div>';
    return;
  }

  try {
    DS = await loadGameData(hash, sha);
  } catch (error) {
    const subject = sha ? 'this version of the game' : 'this game';
    mainPane.innerHTML = '<div class="empty">Couldn’t load ' + subject + ': ' + escapeHtml(error.message) + '</div>';
    return;
  }

  renderCrumb();

  bindEvents();

  await applyLocation('replace');

  if (DS.sha || diffState.sha) {
    gameHistory().then(
      () => {
        renderVersionBar();
        renderInspector();
      },
      () => {},
    );
  }

  requestAnimationFrame(() => scrollSymbolIntoView(viewerState.name));
}

startViewer();
