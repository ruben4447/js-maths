const Runspace = require("./src/runspace/Runspace");
const { define, defineVars, defineFuncs } = require("./src/init/def");
const { consoleColours, printError } = require("./src/utils");
const Complex = require('./src/maths/Complex');
const { parseArgString } = require("./src/init/args");
const { ArrayValue, primitiveToValueClass } = require("./src/evaluation/values");
const { errors } = require("./src/errors");

// PARSE ARGV, SETUP RUNSPACE
const opts = parseArgString(process.argv, true);
if (opts.imag !== undefined) Complex.imagLetter = opts.imag; else opts.imag = Complex.imagLetter;
opts.app = 'CLI';
opts.file = __filename;
const rs = new Runspace(opts);
define(rs);
if (opts.defineVars) defineVars(rs);
if (opts.defineFuncs) defineFuncs(rs);
rs.importFiles.push('<interpreter>');

rs.defineVar('argv', new ArrayValue(rs, process.argv.slice(2).map(v => primitiveToValueClass(rs, v))), 'Arguments provided to the program');

// Evaluate some input
async function evaluate(input) {
  let output, err, time, execObj = {};
  try {
    let start = Date.now();
    output = await rs.execute(input, undefined, execObj);
    time = Date.now() - start;
    if (output !== undefined) output = output.toString();
  } catch (e) {
    err = e;
  }

  if (err) {
    if (opts.niceErrors) {
      printError(err, str => rs.io.output.write(str));
    } else {
      console.trace(err);
    }
  } else {
    if (output !== undefined) {
      rs.io.output.write(output + '\n');
    }
    if (opts.timeExecution) {
      rs.io.output.write(`** Took ${time} ms (${execObj.parse} ms parsing, ${execObj.exec} ms execution)\n`);
    }
  }
  return execObj.status;
}

async function main() {
  if (!process.stdin.isTTY) {
    printError(`TTY Error: CLI requires a text terminal (TTY not available)`, str => process.stdout.write(str));
    process.exit(1);
  }
  process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');
  process.stdin.resume();

  // Import standard IO library
  await rs.import("<io>");

  // Set prompt
  rs.io.setPrompt(opts.prompt);

  // Print intro stuff to screen
  if (opts.intro) {
    rs.io.output.write(`-- JS Maths v${rs.opts.version} --\nType help(), copyright() for more information.\n`);
    let notes = [];
    if (opts.strict) notes.push("strict mode is enabled");
    if (!opts.bidmas) notes.push("BIDMAS is being ignored");
    if (!opts.niceErrors) notes.push("nice error messages are disabled");
    if (!opts.defineVars) notes.push("pre-defined variables were not defined");
    if (!opts.defineFuncs) notes.push("pre-defined functions were not defined");
    if (!opts.ans) notes.push("variable ans is not defined");
    notes.forEach(note => rs.io.output.write(`${consoleColours.Bright}${consoleColours.FgWhite}${consoleColours.Reverse}Note${consoleColours.Reset} ${note}\n`));
    rs.io.output.write('\n');
  }

  // Set input event handlers
  if (opts.multiline) {
    const lines = []; // Line buffer
    rs.onLineHandler = async (io, line) => {
      let status;
      if (line.length === 0) {
        const input = lines.join('\n');
        lines.length = 0;
        status = await evaluate(input);
        io.setPrompt(opts.prompt);
      } else {
        lines.push(line);
        io.setPrompt('.'.repeat(opts.prompt.length - 1) + ' ');
      }

      if (status < 0) {
        rs.io.removeAllListeners();
        rs.io.close();
      } else rs.io.prompt();
    };
  } else {
    rs.onLineHandler = async (io, line) => {
      let status = await evaluate(line);
      if (status < 0) {
        rs.io.removeAllListeners();
        rs.io.close();
      } else rs.io.prompt();
    };
  }

  // Initialialise prompt
  rs.io.prompt();
}

main();
