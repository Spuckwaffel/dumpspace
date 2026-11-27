const DUMP_FUNCTION_FLAGS = [
  ['Final', 0x00000001],
  ['RequiredAPI', 0x00000002],
  ['BlueprintAuthorityOnly', 0x00000004],
  ['BlueprintCosmetic', 0x00000008],
  ['Net', 0x00000040],
  ['NetReliable', 0x00000080],
  ['NetRequest', 0x00000100],
  ['Exec', 0x00000200],
  ['Native', 0x00000400],
  ['Event', 0x00000800],
  ['NetResponse', 0x00001000],
  ['Static', 0x00002000],
  ['NetMulticast', 0x00004000],
  ['UbergraphFunction', 0x00008000],
  ['MulticastDelegate', 0x00010000],
  ['Public', 0x00020000],
  ['Private', 0x00040000],
  ['Protected', 0x00080000],
  ['Delegate', 0x00100000],
  ['NetServer', 0x00200000],
  ['HasOutParms', 0x00400000],
  ['HasDefaults', 0x00800000],
  ['NetClient', 0x01000000],
  ['DLLImport', 0x02000000],
  ['BlueprintCallable', 0x04000000],
  ['BlueprintEvent', 0x08000000],
  ['BlueprintPure', 0x10000000],
  ['EditorOnly', 0x20000000],
  ['Const', 0x40000000],
  ['NetValidate', 0x80000000],
];

const DUMP_FLAG_VALUES = new Map(DUMP_FUNCTION_FLAGS);

const DUMP_TYPE_NAMES = new Map([
  ['int8', 'int8_t'],
  ['int16', 'int16_t'],
  ['int32', 'int32_t'],
  ['int64', 'int64_t'],
  ['uint16', 'uint16_t'],
  ['uint32', 'uint32_t'],
  ['uint64', 'uint64_t'],
  ['FMulticastInlineDelegateProperty_', 'TMulticastInlineDelegate<void()>'],
  ['FMulticastInlineDelegate', 'TMulticastInlineDelegate<void()>'],
  ['FMulticastDelegateProperty_', 'TMulticastInlineDelegate<void()>'],
  ['UMulticastDelegateProperty_', 'TMulticastInlineDelegate<void()>'],
  ['FDelegateProperty_', 'TDelegate<void()>'],
  ['FDelegateProperty', 'TDelegate<void()>'],
  ['UDelegateProperty_', 'TDelegate<void()>'],
  ['FMulticastSparseDelegate', 'FMulticastSparseDelegateProperty_'],
  ['FUtf8StrProperty_', 'Utf8StrProperty'],
  ['FAnsiStrProperty_', 'AnsiStrProperty'],
]);

function dumpHex(value) {
  return '0x' + Math.trunc(Number(value) || 0).toString(16).toUpperCase();
}

function dumpTypeName(type) {
  const name = type[0];
  const innerTypes = type[3] || [];

  if (name === 'TOptional') return 'OptionalProperty';

  if (name === 'TSubclassOf') return 'UClass*';

  if (name === 'TScriptInterface') return 'InterfaceProperty';

  if (name === 'TEnumAsByte' && innerTypes.length) return dumpTypeName(innerTypes[0]);

  if (name === 'TLazyObjectPtr' && innerTypes.length) {
    const objectType = dumpTypeName(innerTypes[0]);

    return objectType.endsWith('*') ? objectType : objectType + '*';
  }

  if ((name === 'TWeakObjectPtr' || name === 'TSoftObjectPtr' || name === 'TSoftClassPtr') && innerTypes.length) {
    const template = name === 'TWeakObjectPtr' ? 'TWeakObjectPtr' : 'TSoftObjectPtr';

    return template + '<' + dumpTypeName(innerTypes[0]).replace(/\*$/, '') + '>';
  }

  const baseName = DUMP_TYPE_NAMES.get(name) || name;
  const text = innerTypes.length ? baseName + '<' + innerTypes.map(dumpTypeName).join(', ') + '>' : baseName;

  return text + (type[2] || '');
}

function dumpFunctionFlags(flagText) {
  let flags = 0;

  for (const flagName of String(flagText || '').split('|')) {
    flags = (flags | (DUMP_FLAG_VALUES.get(flagName.trim()) || 0)) >>> 0;
  }

  return flags;
}

function dumpFieldLines(members, lines) {
  const fields = members.filter((member) => !Object.keys(member)[0].startsWith('__'));

  if (!fields.length) {
    lines.push('    // No properties');
    return;
  }

  for (const member of fields) {
    const name = Object.keys(member)[0];
    const [type, offset, size, arrayDimension] = member[name];

    if (member[name].length > 4) {
      lines.push('    bool ' + name + ' : 1; // ' + dumpHex(offset) + ' (Bitfield, bit ' + member[name][4] + ')');
      continue;
    }

    const elementSize = arrayDimension > 1 && size % arrayDimension === 0 ? size / arrayDimension : size;

    lines.push('    ' + dumpTypeName(type) + ' ' + name + '; // ' + dumpHex(offset) + ' (' + dumpHex(elementSize) + ')');
  }
}

function dumpFunctionLines(functions, lines) {
  lines.push('');
  lines.push('    // Functions (' + functions.length + ')');

  for (const entry of functions) {
    const name = Object.keys(entry)[0];
    const [returnType, parameters, address, flagText] = entry[name];

    const parameterText = parameters
      .map(([type, modifier, parameterName]) => (modifier ? modifier + ' ' : '') + dumpTypeName(type) + ' ' + parameterName)
      .join(', ');

    let line = '    // ' + dumpTypeName(returnType) + ' ' + name + '(' + parameterText + ') // Offset: ' + dumpHex(address);

    const flags = dumpFunctionFlags(flagText);

    if (flags) {
      const flagNames = DUMP_FUNCTION_FLAGS.filter(([, bit]) => (flags & bit) >>> 0).map(([flagName]) => flagName);
      line += ', Flags: ' + dumpHex(flags) + (flagNames.length ? ' [' + flagNames.join('|') + ']' : '');
    }

    lines.push(line);
  }
}

function dumpTypeLines(keyword, name, members, functions, lines) {
  const inheritInfo = members.find((member) => member.__InheritInfo)?.__InheritInfo || [];
  const size = members.find((member) => '__MDKClassSize' in member)?.__MDKClassSize || 0;

  lines.push('// Size: ' + dumpHex(size) + ' (' + size + ' bytes)');
  lines.push(keyword + ' ' + name + (inheritInfo.length ? ' : public ' + inheritInfo[0] : '') + ' {');

  if (keyword === 'class') lines.push('public:');

  dumpFieldLines(members, lines);

  if (functions && functions.length) dumpFunctionLines(functions, lines);

  lines.push('};');
  lines.push('');
}

function dumpTimestamp(date) {
  const pad = (value) => String(value).padStart(2, '0');

  return (
    date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' +
    pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds())
  );
}

function propertyDumpText(data, includeFunctions) {
  const classes = Object.entries(data.classes);
  const structs = Object.entries(data.structs);
  const enums = Object.entries(data.enums || {});
  const functionsByOwner = data.functions || {};
  const functionCount = Object.values(functionsByOwner).reduce((count, functions) => count + functions.length, 0);

  const lines = [
    '// Generated: ' + dumpTimestamp(new Date()),
    '// Engine Version: ' + data.game.engine,
    '// Classes: ' + classes.length,
    '// Structs: ' + structs.length,
    '// Enums: ' + enums.length,
  ];

  if (functionCount > 0) lines.push('// Functions: ' + functionCount);

  lines.push('');

  lines.push('// ===========================', '// CLASSES', '// ===========================', '');

  for (const [name, members] of classes) {
    dumpTypeLines('class', name, members, includeFunctions ? functionsByOwner[name] : null, lines);
  }

  lines.push('// ===========================', '// STRUCTS', '// ===========================', '');

  for (const [name, members] of structs) dumpTypeLines('struct', name, members, null, lines);

  lines.push('// ===========================', '// ENUMS', '// ===========================', '');

  for (const [name, [values]] of enums) {
    if (!values.length) continue;

    lines.push('enum class ' + name + ' {');

    values.forEach((value, index) => {
      const valueName = Object.keys(value)[0];
      lines.push('    ' + valueName + ' = ' + value[valueName] + (index < values.length - 1 ? ',' : ''));
    });

    lines.push('};');
    lines.push('');
  }

  return lines.join('\n');
}

function propertyDumpFileName(gameName) {
  return (gameName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').trim() || 'Dump') + '.txt';
}
