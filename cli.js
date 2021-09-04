const Runspace = require("./src/runspace/Runspace");
const readline = require("readline");
const { define, defineVars, defineFuncs } = require("./src/init/def");
const { consoleColours, printError } = require("./src/utils");
const Complex = require('./src/maths/Complex');
const { parseArgString } = require("./src/init/args");
const { RunspaceBuiltinFunction } = require("./src/runspace/Function");
const { StringValue } = require("./src/evaluation/values");
const { errors } = require("./src/errors");

// PARSE ARGV, SETUP RUNSPACE
const opts = parseArgString(process.argv, true);
if (opts.imag !== undefined) Complex.imagLetter = opts.imag; else opts.imag = Complex.imagLetter;
opts.app = 'CLI';
opts.dir = __dirname;
opts.file = __filename;
const rs = new Runspace(opts);
define(rs);
if (opts.defineVars) defineVars(rs);
if (opts.defineFuncs) defineFuncs(rs);

// Runspace CLI-specific functions
rs.define(new RunspaceBuiltinFunction(rs, 'print', { o: '?any', newline: '?bool' }, ({ o, newline }) => {
  if (o === undefined) {
    rs.io.output.write('\n');
  } else {
    newline = newline === undefined ? true : newline.toPrimitive('bool');
    rs.io.output.write(o.toString() + (newline ? '\n' : ''));
  }
  return new UndefinedValue(rs);
}, 'prints object to the screen'));
rs.define(new RunspaceBuiltinFunction(rs, 'clear', {}, () => {
  rs.io.output.write('\033c');
  return new StringValue(rs, "");
}, 'clears the screen'));
rs.define(new RunspaceBuiltinFunction(rs, 'error', { msg: '?string' }, ({ msg }) => {
  throw new Error(msg ?? "<no message>");
}, 'triggers an error'));

// Attempt to execute a function, else print errors
function attempt(fn) {
  try {
    return fn();
  } catch (e) {
    printError(e, str => rs.io.output.write(str));
  }
}

// Evaluate some input
function evaluate(input) {
  let func = () => rs.execute(input, true);
  let output = opts.niceErrors ? attempt(func) : func();
  if (output !== undefined) rs.io.output.write(output.toString() + '\n');
  return output;
}

// Set prompt
rs.io.setPrompt(opts.prompt);

// Print intro stuff to screen
if (opts.intro) {
  rs.io.output.write(`${__filename} - JS Maths CLI\nType help() for basic help\n`);
  let notes = [];
  if (opts.strict) notes.push("strict mode is enabled");
  if (!opts.bidmas) notes.push("BIDMAS is being ignored");
  if (!opts.niceErrors) notes.push("fatal errors are enabled");
  if (!opts.defineVars) notes.push("pre-defined variables were not defined");
  if (!opts.defineFuncs) notes.push("pre-defined functions were not defined");
  if (!opts.ans) notes.push("variable ans is not defined");
  if (!opts.defineAliases) notes.push("function/variables aliases were not defined");
  notes.forEach(note => rs.io.output.write(`${consoleColours.Bright}${consoleColours.FgWhite}${consoleColours.Reverse}Note${consoleColours.Reset} ${note}\n`));
  rs.io.output.write('\n');
}

const lines = [];

if (opts.multiline) {
  rs.io.on('line', (line) => {
    if (line.length === 0) {
      const input = lines.join('\n');
      lines.length = 0;
      evaluate(input);
      rs.io.setPrompt(opts.prompt);
    } else {
      lines.push(line);
      rs.io.setPrompt('.'.repeat(opts.prompt.length - 1) + ' ');
    }

    rs.io.prompt();
  });
} else {
  rs.io.on('line', (line) => {
    evaluate(line);
    rs.io.prompt();
  });
}

rs.io.on('close', () => {
  rs.io.output.write('^C\n');
  rs.execute('exit()'); // Simulate call to exit()
  process.exit(); // As a fallback
});

// Initialialise prompt
rs.io.prompt();
