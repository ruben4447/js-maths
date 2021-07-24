const Runspace = require("./src/runspace/Runspace");
const readline = require("readline");
const { define, defineVars, defineFuncs } = require("./src/init/def");
const { consoleColours } = require("./src/utils");
const Complex = require('./src/maths/Complex');
const { parseArgString } = require("./src/init/args");
const { RunspaceBuiltinFunction } = require("./src/runspace/Function");
const { StringValue } = require("./src/evaluation/values");

// PARSE ARGV, SETUP RUNSPACE
const opts = parseArgString(process.argv, true);
if (opts.imag !== undefined) Complex.imagLetter = opts.imag; else opts.imag = Complex.imagLetter;
opts.app = 'CLI';
opts.dir = __dirname;
opts.file = __filename;
opts.time = Date.now();
const rs = new Runspace(opts);
define(rs);
if (opts.defineVars) defineVars(rs);
if (opts.defineFuncs) defineFuncs(rs);

// Runspace CLI-specific functions
rs.define(new RunspaceBuiltinFunction(rs, 'print', { o: 'any', newline: '?bool' }, ({ o, newline }) => {
  newline = newline === undefined ? true : newline.toPrimitive('bool');
  rl.output.write(o.toString() + (newline ? '\n' : ''));
  return o;
}, 'prints object to the screen'));
rs.define(new RunspaceBuiltinFunction(rs, 'clear', {}, () => {
  rl.output.write('\033c');
  return new StringValue(0, "");
}, 'clears the screen'));
rs.define(new RunspaceBuiltinFunction(rs, 'error', { msg: '?string' }, ({ msg }) => {
  throw new Error(msg ?? "<no message>");
}, 'triggers an error'));

// Attempt to execute a function, else print errors
function attempt(fn) {
  try {
    return fn();
  } catch (e) {
    e.toString().split('\n').forEach(line => rl.output.write(`${consoleColours.Bright}${consoleColours.FgRed}[!] ${consoleColours.Reset}${line}\n`));
  }
}

// Setup Readline interface for I/O
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: opts.prompt,
});

// Print intro stuff to screen
if (opts.intro) {
  rl.output.write(`${__filename} - JS Maths CLI\nType help() for basic help\n`);
  let notes = [];
  if (opts.strict) notes.push("strict mode is enabled");
  if (!opts.bidmas) notes.push("BIDMAS is being ignored");
  if (!opts.niceErrors) notes.push("fatal errors are enabled");
  if (!opts.defineVars) notes.push("pre-defined variables were not defined");
  if (!opts.defineFuncs) notes.push("pre-defined functions were not defined");
  if (!opts.ans) notes.push("variable ans is not defined");
  if (!opts.defineAliases) notes.push("function/variables aliases were not defined");
  notes.forEach(note => rl.output.write(`${consoleColours.Bright}${consoleColours.FgWhite}${consoleColours.Reverse}Note${consoleColours.Reset} ${note}\n`));
  rl.output.write('\n');
}

// Initial prompt
rl.prompt();

rl.on('line', (line) => {
  let out = opts.niceErrors ? attempt(() => rs.eval(line)) : rs.eval(line);
  if (out !== undefined) rl.output.write(out.toString() + '\n');

  rl.prompt();
});

rl.on('close', () => {
  rl.output.write('^C\n');
  rs.eval('exit()'); // Simulate call to exit()
  process.exit(); // As a fallback
});

rs.import('matrix.js');