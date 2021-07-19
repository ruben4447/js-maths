const Complex = require("./maths/Complex");
const readline = require("readline");

const STDIN = process.stdin, STDOUT = process.stdout;

/** Get user input from STDIN */
async function input(msg = '') {
  const instance = readline.createInterface({
    input: STDIN,
    output: STDOUT
  });
  return new Promise(function (resolve, reject) {
    instance.question(msg, x => {
      instance.close();
      resolve(x);
    });
  });
}

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

const peek = a => a[a.length - 1];

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

/** Return boolean value of an argv argument */
function getArgvBool(argv, arg, defaultValue = true) {
  if (argv[arg] === undefined) return defaultValue;
  if (argv[arg] === "false" || argv[arg] === "0") return false;
  return !!argv[arg];
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

const str = x => {
  try {
    return x.toString();
  } catch (e) {
    return String(x);
  }
};
const bool = x => {
  if (x === "false" || x === "0") return false;
  return !!x;
};

const createTokenStringParseObj = (str, pos, depth, terminateClosing = null) => ({
  string: str,
  pos,
  depth,
  tokens: [],
  comment: '',
  terminateClosing, // When depth>0 and this closing bracket is found (assuming brackets.length==0) break from the function
});

function arraysEqual(a1, a2) {
  let len = Math.max(a1.length, a2.length);
  for (let i = 0; i < len; i++) {
    if (a1[i] !== a2[i]) return false;
  }
  return true;
}

const sum = arr => arr.reduce((a, x) => a.add(x), new Complex(0));
const sort = arr => [...arr].sort((a, b) => a - b);
const mean = arr => sum(arr) / arr.length;
const PMCC = (x, y) => {
  if (x.length !== y.length) throw new Error(`Argument Error: input arrays must be same size`);
  const n = x.length;
  
  const ux = sum(x), uy = sum(y);
  const vx = sum(x.map(a => a * a)), vy = sum(y.map(a => a * a));
  const wxy = sum(x.map((_, i) => x[i] * y[i]));
  
  return (n * wxy - ux * uy) / Math.sqrt((n * vx - ux * ux) * (n * vy - uy * uy));
};
const variance = arr => {
  const m = mean(arr);
  return sum(arr.map(x => Math.pow(x - m, 2))) / arr.length;
};

module.exports = {
  input, print, peek, isDigit, prefixLines, getArgvBool, assertReal, consoleColours, createEnum, str, bool, createTokenStringParseObj, arraysEqual, PMCC, mean, sort, variance,
};