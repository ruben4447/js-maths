require("dotenv").config();
const Discord = require("discord.js");
const { define, defineVars, defineFuncs } = require("./src/init/def");
const Runspace = require("./src/runspace/Runspace");
const { RunspaceBuiltinFunction } = require("./src/runspace/Function");
const { parseArgString } = require("./src/init/args");
const Complex = require("./src/maths/Complex");
const { UndefinedValue, ArrayValue, primitiveToValueClass, NumberValue } = require("./src/evaluation/values");

// CHECK FOR REQUIRED ENV VARIABLES
if (!process.env.BOT_TOKEN) throw new Error(`Setup Error: missing BOT_TOKEN environment variable`);
if (!process.env.CHANNEL) throw new Error(`Setup Error: missing CHANNEL environment variable`);

const client = new Discord.Client();
client.login(process.env.BOT_TOKEN);

/** Create new runspace */
async function createRunspace(argString = '') {
  const opts = parseArgString(argString, false);
  if (opts.imag !== undefined) Complex.imagLetter = opts.imag; else opts.imag = Complex.imagLetter; // Change imaginary unit
  opts.app = 'DISCORD';
  rs.root = __dirname;
  const rs = new Runspace(opts); // Create object
  define(rs);
  defineVars(rs);
  if (opts.defineFuncs) defineFuncs(rs);
  const exec_instance = rs.create_exec_instance(), mainProc = rs.get_process(exec_instance.pid);
  mainProc.imported_files.push('<discord>');

  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'exit', { c: '?real_int' }, ({ c }) => {
    if (rs.discordLatestMsg) {
      sessionEnd(rs.discordLatestMsg); // Declay session ending message
      return c ?? new NumberValue(rs, 0);
    } else {
      throw new Error(`Fatal Error: could not end session. Please type '!close'.`);
    }
  }, 'End the discord maths session'));
  rs.defineFunc(new RunspaceBuiltinFunction(rs, 'print', { o: 'any' }, ({ o }) => {
    if (rs.discordLatestMsg) {
      rs.discordLatestMsg.reply(o.toString());
      return new UndefinedValue(rs);
    } else {
      throw new Error(`Fatal Error: unable to print`);
    }
  }, 'End the discord maths session'));
  rs.defineVar('argv', new ArrayValue(rs, process.argv.slice(2).map(v => primitiveToValueClass(rs, v))), 'Arguments provided to the host program');

  return rs;
}

/* LOGGED IN */
client.on('ready', async () => {
  console.log('👍 Connected');
  const c = client.channels.cache.find(c => c.id === process.env.CHANNEL);
  await c.send('👋 Ready to do some maths? 😀');
});

var envSessions = {}; // { author_id : Environment }

client.on('message', async msg => {
  // Listening on this channel? Not a bot?
  if (!msg.author.bot && msg.channel.id === process.env.CHANNEL) {
    try {
      if (msg.content.startsWith('!start')) {
        await sessionStart(msg, msg.content.substring(6));
      } else {
        if (envSessions[msg.author.id]) {
          envSessions[msg.author.id].discordLatestMsg = msg;
          try {
            let timeObj = {};
            let out = await envSessions[msg.author.id].exec(exec_instance, msg.content, undefined, timeObj);
            if (out !== undefined) await msg.reply('`' + out.toString() + '`');
            if (envSessions[msg.author.id]?.opts.timeExecution) await msg.reply(`Timings: ${timeObj.parse} ms parsing, ${timeObj.exec} ms execution`);
          } catch (e) {
            let error = e.toString().split('\n').map(l => `\`⚠ ${l}\``).join('\n');
            await msg.reply(error);
          }
        }
      }
    } catch (e) {
      await msg.reply(`Internal Fatal Error: ${e.name}. See dev console.`);
      throw e;
    }
  }
});

async function sessionStart(msg, argString = '') {
  envSessions[msg.author.id] = await createRunspace(argString);
  console.log(`> Created session for ${msg.author.username} (#${msg.author.id})`);
  await msg.reply(`✅ Created new session`);
}

async function sessionEnd(msg) {
  delete envSessions[msg.author.id];
  console.log(`< Discarded session for ${msg.author.username} (#${msg.author.id})`);
  await msg.reply(`🚮 Destroyed session`);
}