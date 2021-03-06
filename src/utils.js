const Complex = require("./maths/Complex");
const { errors } = require("./errors");

/** Print */
function print(...args) {
  console.log(...args);
}

const consoleColours = {
  Reset: "\x1b[0m",
  Bright: "\x1b[1m",
  Dim: "\x1b[2m",
  Underscore: "\x1b[4m",
  Blink: "\x1b[5m",
  Reverse: "\x1b[7m",
  Hidden: "\x1b[8m",

  FgBlack: "\x1b[30m",
  FgRed: "\x1b[31m",
  FgGreen: "\x1b[32m",
  FgYellow: "\x1b[33m",
  FgBlue: "\x1b[34m",
  FgMagenta: "\x1b[35m",
  FgCyan: "\x1b[36m",
  FgWhite: "\x1b[37m",

  BgBlack: "\x1b[40m",
  BgRed: "\x1b[41m",
  BgGreen: "\x1b[42m",
  BgYellow: "\x1b[43m",
  BgBlue: "\x1b[44m",
  BgMagenta: "\x1b[45m",
  BgCyan: "\x1b[46m",
  BgWhite: "\x1b[47m",
};

const isDigit = x => x >= "0" && x <= "9";
const _regexWhitespace = /\s/;
const isWhitespace = x => _regexWhitespace.test(x);

const peek = (a, b = 1) => a[a.length - b];

/** Check that all input variables are real */
function assertReal(...args) {
  for (let arg of args) {
    arg = Complex.assert(arg);
    if (!arg.isReal()) throw new Error(`Real number expected, got ${arg}`);
  }
}

function prefixLines(str, prefix) {
  return str.split('\n').map(x => prefix + x).join('\n');
}

function createEnum(obj) {
  const enumeration = {};
  for (let prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      enumeration[prop] = obj[prop];
      enumeration[obj[prop]] = prop;
    }
  }
  return enumeration;
}

const str = (x, eo) => {
  try {
    return x.toString(eo);
  } catch (e) {
    return String(x);
  }
};
const bool = x => {
  if (x === "false" || x === "0") return false;
  return !!x;
};

const createTokenStringParseObj = (rs, str, pos, depth, terminateOn = [], allowMultiline = true) => ({
  rs,
  string: str,
  pos,
  depth, // Array of TokenLine objects
  lines: [],
  comment: '',
  terminateOn, // When depth>0 and this this found, set value to what caused the breakage and break
  allowMultiline,
});

const createEvalObj = (blockID, lineID, pid = undefined) => ({
  action: 0, // 0 -> nothing; 1 -> break; 2 -> continue; 3 -> return; 4 -> define label; 5 -> goto; -1 -> exit; -2 -> stop execution (internal, silent)
  actionValue: undefined,
  blockID, // ID of current block we are in
  lineID, // Current line number
  pid,
});

/** Propagate actions from obj1 -> obj2 */
const propagateEvalObj = (obj1, obj2) => {
  obj2.action = obj1.action;
  obj2.actionValue = obj1.actionValue;
};

/** Check if prititive arrays are equal */
function arraysEqual(a1, a2) {
  let len = Math.max(a1.length, a2.length);
  for (let i = 0; i < len; i++) {
    if (a1[i] !== a2[i]) return false;
  }
  return true;
}

/** Sum of array of complex numbers */
const sum = arr => arr.reduce((a, x) => a.add(x), new Complex(0));
const sort = arr => [...arr].sort((a, b) => a - b);

/** Check if two Values are equal */
function equal(a, b, evalObj) {
  const basic = a === b;
  if (basic) return basic;

  let bool;
  try {
    bool = a.castTo('any', evalObj).__eq__(evalObj, b);
  } catch (e) {
    return false;
  }
  return bool && bool.toPrimitive('bool');
}

/** Find and return index of <item> in pritmitive <array> */
function findIndex(item, array, evalObj) {
  for (let i = 0; i < array.length; i++) if (equal(item, array[i], evalObj)) return i;
  return -1;
}

/** Remove duplicate values from array  */
function removeDuplicates(arr, evalObj) {
  let set = [];
  for (let i = 0; i < arr.length; i++) {
    let found = false;
    for (let j = 0; j < set.length; j++) {
      if (equal(arr[i], set[j], evalObj)) {
        found = true;
        break;
      }
    }
    if (!found) set.push(arr[i]);
  }
  return set;
}

/** Return intersection between two primitive arrays */
const intersect = (a, b, evalObj) => a.filter(v => findIndex(v, b, evalObj) !== -1);

/** Difference between two primitive arrays: diff([1,2], [5,1]) = [2] */
const arrDifference = (a, b, evalObj) => a.filter(v => findIndex(v, b, evalObj) === -1);

function arrRepeat(array, count) {
  if (count < 1) return [];
  const out = [];
  for (let i = 0; i < count; i++) out.push(...array);
  return out;
}

/** Print error in a fancy way */
function printError(e, printFunction) {
  e.toString().split('\n').forEach(line => printFunction(`${consoleColours.Bright}${consoleColours.FgRed}[!] ${consoleColours.Reset}${line}\n`));
}

/** Print warning message in a fancy way */
function printWarn(msg, printFunction) {
  msg.toString().split('\n').forEach(line => printFunction(`${consoleColours.Bright}${consoleColours.FgYellow}[!] ${consoleColours.Reset}${line}\n`));
}

/** Error with matching brackets */
function throwMatchingBracketError(open, close, pos) {
  throw new Error(`[${errors.UNMATCHED_BRACKET}] Syntax Error: unexpected bracket token '${open}' at position ${pos}; no matching '${close}' found.`);
}

/** Error for too many statements. Got is a Token */
function expectedSyntaxError(expected, got) {
  throw new Error(`[${errors.SYNTAX}] Syntax Error: expected ${expected} but got ${got} at position ${got.pos}`);
}

/** sort an object by longest key */
function sortObjectByLongestKey(o) {
  let newo = {}, keys = Object.keys(o).sort((a, b) => a.length > b.length ? -1 : 1);
  keys.forEach(key => newo[key] = o[key]);
  return newo;
}

/** Return character as extracted from an escape sequence. Return { char: string, pos: number }. Return new position in string. */
function decodeEscapeSequence(string, pos) {
  let char;
  switch (string[pos]) {
    case 'b': char = String.fromCharCode(0x8); pos++; break; // BACKSPACE
    case 'n': char = String.fromCharCode(0xA); pos++; break; // LINE FEED
    case 'r': char = String.fromCharCode(0xD); pos++; break; // CARRIAGE RETURN
    case 't': char = String.fromCharCode(0x9); pos++; break; // HORIZONTAL TAB
    case 'v': char = String.fromCharCode(0xB); pos++; break; // VERTICAL TAB
    case '0': char = String.fromCharCode(0x0); pos++; break; // NULL
    case 's': char = String.fromCharCode(0x20); pos++; break; // WHITESPACE
    case 'x': { // HEXADECIMAL ESCAPE SEQUENCE
      pos++;
      let nlit = '';
      while (string[pos] && /[0-9A-Fa-f]/.test(string[pos])) {
        nlit += string[pos];
        pos++;
      }
      if (nlit.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: Invalid hexadecimal escape sequence. Expected hexadecimal character, got '${string[pos]}'`);
      char = String.fromCharCode(parseInt(nlit, 16));
      break;
    }
    case 'o': { // OCTAL ESCAPE SEQUENCE
      pos++;
      let nlit = '';
      while (string[pos] && /[0-7]/.test(string[pos])) {
        nlit += string[pos];
        pos++;
      }
      if (nlit.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: Invalid octal escape sequence. Expected octal character, got '${string[pos]}'`);
      char = String.fromCharCode(parseInt(nlit, 8));
      break;
    }
    case 'd': { // DECIMAL ESCAPE SEQUENCE
      pos++;
      let nlit = '';
      while (string[pos] && /[0-9]/.test(string[pos])) {
        nlit += string[pos];
        pos++;
      }
      if (nlit.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: Invalid decimal escape sequence. Expected decimal character, got '${string[pos]}'`);
      char = String.fromCharCode(parseInt(nlit, 10));
      break;
    }
    default:
      char = string[pos++];
  }
  return { char, pos };
}

/** Convert given number in base 10 to the provided base */
function int_to_base(n, b) {
  let str = "";
  if (b < 2)
    return str;
  while (n > 0.1) {
    let rem = n % b;
    n /= b;
    let c = rem + (rem > 9 ? 55 : 48);
    str += String.fromCharCode(c);
  }
  return str.split("").reverse().join("");
}

/** Convert string in a given base to a number. */
function base_to_int(str, base) {
  let dec = 0;
  let k = str.length === 1 ? 1 : Math.pow(base, str.length - 1), i = 0;
  while (i < str.length) {
    let code = str[i].charCodeAt(0);
    dec += (code - (code <= 57 ? 48 : 55)) * k;
    k /= base;
    i++;
  }
  return dec;
}

/** Convert string in a given base to a number. May include a decimal point */
function base_to_float(str, base) {
  let dec = 0;
  const di = str.indexOf(".");
  let k = str.length === 1 ? 1 : Math.pow(base, (di === -1 ? str.length : di) - 1), i = 0;
  while (i < str.length) {
    if (str[i] !== '.') {
      let code = str[i].charCodeAt(0);
      dec += (code - (code <= 57 ? 48 : 55)) * k;
      k /= base;
    }
    i++;
  }
  return dec;
}

const numberTypes = ["uint8", "int8", "uint16", "int16", "uint32", "int32", "uint64", "int64", "float32", "float64"];
const numberTypeGetMethods = ["getUint8", "getInt8", "getUint16", "getInt16", "getUint32", "getInt32", "getBigUint64", "getBigInt64", "getFloat32", "getFloat64"];
const numberTypeSetMethods = ["setUint8", "setInt8", "setUint16", "setInt16", "setUint32", "setInt32", "setBigUint64", "setBigInt64", "setFloat32", "setFloat64"];
function toBinary(n, type = 'float64') {
  let i = numberTypes.indexOf(type);
  let dv = new DataView(new ArrayBuffer(8));
  if (type === 'uint64' || type === 'int64') n = BigInt(parseInt(n));
  dv[numberTypeSetMethods[i]](0, n, true);
  let bin = '';
  for (let j = dv.byteLength - 1; j >= 0; j--) {
    let u8 = dv.getUint8(j).toString(2);
    bin += u8.toString(2).padStart(8, '0');
  }
  while (bin.substr(0, 8) === '00000000') bin = bin.substr(8);
  return bin;
}
function fromBinary(bin, type = 'float64') {
  bin = bin.padStart(64, '0');

  let i = numberTypes.indexOf(type);
  let dv = new DataView(new ArrayBuffer(8));
  for (let j = 0, k = 7; k >= 0; j += 8, k--) {
    let byte = bin.substr(j, 8);
    dv.setUint8(k, parseInt(byte, 2));
  }
  return dv[numberTypeGetMethods[i]](0, true);
}

// "uint8", "int8", "uint16", "int16", "uint32", "int32", "uint64", "int64", "float32", "float64"
function returnTypedArray(ntype, size) {
  switch (ntype) {
    case "uint8": return new Uint8Array(size);
    case "int8": return new Int8Array(size);
    case "uint16": return new Uint16Array(size);
    case "int16": return new Int16Array(size);
    case "uint32": return new Uint32Array(size);
    case "int32": return new Int32Array(size);
    case "uint64": return new BigUint64Array(size);
    case "int64": return new BigInt64Array(size);
    case "float32": return new Float32Array(size);
    case "float64": return new Float64Array(size);
  }
}

/** Return JSON representation of a Value (returns StringValue) */
function toJson(evalObj, value) {
  if (typeof value === "string") return value;
  const error = () => new Error(`[${errors.TYPE_ERROR}] Type Error: Cannot convert type ${value.type()} to JSON`);
  let json;
  try {
    json = value.__toJson__(evalObj);
  } catch (e) {
    throw error();
  }
  if (json == undefined) throw error();
  return json;
}

module.exports = {
  print, consoleColours, peek, isDigit, isWhitespace, prefixLines, assertReal, createEnum, str, bool, createTokenStringParseObj, createEvalObj, propagateEvalObj, arraysEqual, sort, sum, equal, findIndex, removeDuplicates, intersect, arrDifference, arrRepeat, printError, printWarn, throwMatchingBracketError, expectedSyntaxError, sortObjectByLongestKey, decodeEscapeSequence,
  toBinary, fromBinary, numberTypes, toJson, int_to_base, base_to_int, base_to_float, returnTypedArray
};