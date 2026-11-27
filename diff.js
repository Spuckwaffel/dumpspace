const UNREAL_PREFIXES = ['U', 'A', 'F', 'E'];

function prefixedName(longer, shorter) {
  return longer.length === shorter.length + 1 && UNREAL_PREFIXES.includes(longer[0]) && longer.slice(1) === shorter;
}

function sameTypeName(before, after) {
  return before === after || prefixedName(after, before) || prefixedName(before, after);
}

function sameType(before, after) {
  if (!sameTypeName(before[0], after[0]) || (before[2] || '') !== (after[2] || '')) return false;

  const beforeSubtypes = before[3] || [];
  const afterSubtypes = after[3] || [];

  if (beforeSubtypes.length !== afterSubtypes.length) return false;

  return beforeSubtypes.every((subtype, index) => sameType(subtype, afterSubtypes[index]));
}

function sameSignature(beforeFunction, afterFunction) {
  const [beforeReturn, beforeParameters] = beforeFunction;
  const [afterReturn, afterParameters] = afterFunction;

  if (!sameType(beforeReturn, afterReturn) || beforeParameters.length !== afterParameters.length) return false;

  return beforeParameters.every((parameter, index) => {
    const other = afterParameters[index];

    return sameType(parameter[0], other[0]) && parameter[1] === other[1] && parameter[2] === other[2];
  });
}

function sameMember(type, before, after) {
  if (type === 'enums') return before === after;

  if (type === 'functions') return sameSignature(before, after) && before[2] === after[2] && before[3] === after[3];

  const beforeBit = before.length > 4 ? before[4] : null;
  const afterBit = after.length > 4 ? after[4] : null;

  return (
    sameType(before[0], after[0]) &&
    before[1] === after[1] &&
    before[2] === after[2] &&
    (before[3] ?? 1) === (after[3] ?? 1) &&
    beforeBit === afterBit
  );
}

function diffValueMap(type, raw) {
  const map = new Map();
  if (!raw) return map;

  if (type === 'enums') {
    for (const value of raw[0]) {
      const name = Object.keys(value)[0];
      map.set(name, value[name]);
    }

    return map;
  }

  for (const member of raw) {
    const name = Object.keys(member)[0];
    if (name.startsWith('__')) continue;

    map.set(name, member[name]);
  }

  return map;
}

function sameEntryMeta(type, before, after) {
  if (type === 'enums') return before[1] === after[1];

  if (type !== 'classes' && type !== 'structs') return true;

  const metaOf = (raw) => {
    const inheritInfo = raw.find((member) => member.__InheritInfo);
    const classSize = raw.find((member) => member.__MDKClassSize);

    return [inheritInfo ? inheritInfo.__InheritInfo : [], classSize ? classSize.__MDKClassSize : 0];
  };

  const [beforeInherit, beforeSize] = metaOf(before);
  const [afterInherit, afterSize] = metaOf(after);

  if (beforeSize !== afterSize) return false;

  return sameTypeName(beforeInherit[0] || '', afterInherit[0] || '');
}

function diffEntryMembers(type, beforeRaw, afterRaw) {
  const before = diffValueMap(type, beforeRaw);
  const after = diffValueMap(type, afterRaw);
  const members = new Map();

  for (const [name, value] of after) {
    if (!before.has(name)) {
      members.set(name, { status: 'added', before: null, after: value });
      continue;
    }

    const previous = before.get(name);

    if (!sameMember(type, previous, value)) members.set(name, { status: 'changed', before: previous, after: value });
  }

  for (const [name, value] of before) {
    if (!after.has(name)) members.set(name, { status: 'removed', before: value, after: null });
  }

  return members;
}

function pairEntryNames(before, after) {
  const pairs = new Map();

  for (const name of Object.keys(before)) {
    if (name in after) {
      pairs.set(name, name);
      continue;
    }

    const candidates = UNREAL_PREFIXES.map((prefix) => prefix + name);

    if (UNREAL_PREFIXES.includes(name[0])) candidates.push(name.slice(1));

    const renamed = candidates.find((candidate) => candidate in after && !(candidate in before));
    if (renamed) pairs.set(name, renamed);
  }

  return pairs;
}

function buildDiff(type, beforeData, afterData) {
  const before = type === 'offsets' ? dsLookup(beforeData) : beforeData;
  const after = type === 'offsets' ? dsLookup(afterData) : afterData;

  const pairs = pairEntryNames(before, after);
  const pairedAfter = new Map([...pairs].map(([beforeName, afterName]) => [afterName, beforeName]));

  const entries = new Map();
  const removed = [];
  const counts = { added: 0, changed: 0, removed: 0 };

  for (const name of Object.keys(after)) {
    const beforeName = pairedAfter.get(name);

    if (beforeName === undefined) {
      entries.set(name, { status: 'added', members: new Map(), before: null });
      counts.added++;
      continue;
    }

    if (type === 'offsets') {
      if (before[beforeName] !== after[name]) {
        entries.set(name, { status: 'changed', members: new Map(), before: before[beforeName] });
        counts.changed++;
      }

      continue;
    }

    const members = diffEntryMembers(type, before[beforeName], after[name]);

    if (members.size || !sameEntryMeta(type, before[beforeName], after[name])) {
      entries.set(name, { status: 'changed', members, before: before[beforeName], renamedFrom: beforeName === name ? null : beforeName });
      counts.changed++;
    }
  }

  for (const name of Object.keys(before)) {
    if (pairs.has(name)) continue;

    entries.set(name, { status: 'removed', members: new Map(), before: before[name] });
    removed.push(name);
    counts.removed++;
  }

  const beforeCount = Object.keys(before).length;
  const fewNamesMatch = beforeCount > 20 && pairs.size / beforeCount < 0.5;

  return { entries, removed, counts, before, fewNamesMatch };
}
