const { errors } = require("../errors");
const { RunspaceUserFunction } = require("../runspace/Function");
const { expectedSyntaxError, peek } = require("../utils");
const { parseSymbol } = require("./parse");
const { FunctionRefValue, ArrayValue, SetValue, MapValue } = require("./values");

class Structure {
  constructor(name, pos) {
    this.name = name;
    this.pos = pos;
  }

  eval(rs) { throw new Error(`${this}.eval: overload required`); }
  validate() { throw new Error(`${this}.validate: overload required`); }

  toString() { return `<Structure ${this.name}>`; }
}

/** Structure to build an array */
class ArrayStructure extends Structure {
  constructor(rs, elements, pos) {
    super("ARRAY", pos);
    this.rs = rs;
    this.elements = elements;
  }

  validate() {
    this.elements.forEach(e => e.prepare());
  }

  async eval() {
    const values = await Promise.all(this.elements.map(el => el.eval()));
    return new ArrayValue(this.rs, values);
  }
}

/** Structure to build a Map */
class MapStructure extends Structure {
  constructor(rs, pos) {
    super("MAP", pos);
    this.rs = rs;
    this.keys = [];
    this.values = [];
  }

  /** key: Value. value: TokenLine */
  addPair(key, value) {
    this.keys.push(key);
    this.values.push(value);
  }

  validate() {
    if (this.keys.length !== this.values.length) throw new Error(`${this}: keys and values arrays must be equal lengths`);
    this.values.forEach(e => e.prepare());
  }

  async eval() {
    let map = new MapValue(this.rs);
    for (let i = 0; i < this.keys.length; i++) {
      map.__set__(this.keys[i], await this.values[i].eval());
    }
    return map;
  }
}

/** Structure to build a set */
class SetStructure extends Structure {
  constructor(rs, elements, pos) {
    super("SET", pos);
    this.rs = rs;
    this.elements = elements;
  }

  validate() {
    this.elements.forEach(e => e.prepare());
  }

  async eval() {
    const values = await Promise.all(this.elements.map(el => el.eval()));
    return new SetValue(this.rs, values);
  }
}

class IfStructure extends Structure {
  /**
   * @param conditionals - array of [condition: BracketedTokenLines, body: Block]
   * @param elseBlock - else block (Block)
   */
  constructor(pos, conditionals = [], elseBlock = undefined) {
    super("IF", pos);
    this.conditionals = conditionals;
    this.elseBlock = elseBlock;
  }

  /** condition - BracketedTokenLines. body - Block */
  addBranch(condition, block) {
    this.conditionals.push([condition, block]);
  }

  addElse(block) {
    this.elseBlock = block;
  }

  validate() {
    // Check that each condition only has ONE line
    for (const [condition, block] of this.conditionals) {
      if (condition.value.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: expression expected, got )`);
      if (condition.value.length > 1) throw new expectedSyntaxError(')', peek(condition.value[0].tokens));
      condition.prepare();
      block.prepare();
    }
    this.elseBlock?.prepare();
  }

  async eval() {
    // Loop through conditionals...
    let foundTruthy = false, value;
    for (const [condition, block] of this.conditionals) {
      let cond = value = await condition.eval();
      if (cond.toPrimitive("bool")) { // If conditon is truthy...
        foundTruthy = true;
        value = await block.eval(); // Evaluate code block
        break;
      }
    }
    if (!foundTruthy && this.elseBlock) { // If no condition was truthy and there is an else block...
      value = await this.elseBlock.eval();
    }
    return value;
  }
}

class WhileStructure extends Structure {
  constructor(pos, condition = undefined, body = undefined) {
    super("WHILE", pos);
    this.condition = condition;
    this.body = body;
  }

  validate() {
    // Check that condition only has ONE line
    if (this.condition.value.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: expression expected, got )`);
    if (this.condition.value.length > 1) throw new expectedSyntaxError(')', peek(this.condition.value[0].tokens));
    this.body.prepare();
    this.condition.prepare();
  }

  async eval() {
    while (true) {
      let bool = await this.condition.eval();
      if (!bool.toPrimitive("bool")) break;
      await this.body.eval();
    }
  }
}

class DoWhileStructure extends Structure {
  constructor(pos, condition = undefined, body = undefined) {
    super("DOWHILE", pos);
    this.condition = condition;
    this.body = body;
  }

  validate() {
    // Check that condition only has ONE line
    if (this.condition.value.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: expression expected, got )`);
    if (this.condition.value.length > 1) throw new expectedSyntaxError(')', peek(this.condition.value[0].tokens));
    this.body.prepare();
    this.condition.prepare();
  }

  async eval() {
    while (true) {
      await this.body.eval();
      let bool = await this.condition.eval();
      if (!bool.toPrimitive("bool")) break;
    }
  }
}

class UntilStructure extends Structure {
  constructor(pos, condition = undefined, body = undefined) {
    super("UNTIL", pos);
    this.condition = condition;
    this.body = body;
  }

  validate() {
    // Check that condition only has ONE line
    if (this.condition.value.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: expression expected, got )`);
    if (this.condition.value.length > 1) throw new expectedSyntaxError(')', peek(this.condition.value[0].tokens));
    this.body.prepare();
    this.condition.prepare();
  }

  async eval() {
    while (true) {
      let bool = await this.condition.eval();
      if (bool.toPrimitive("bool")) break;
      await this.body.eval();
    }
  }
}

class DoUntilStructure extends Structure {
  constructor(pos, condition = undefined, body = undefined) {
    super("DOUNTIL", pos);
    this.condition = condition;
    this.body = body;
  }

  validate() {
    // Check that condition only has ONE line
    if (this.condition.value.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: expression expected, got )`);
    if (this.condition.value.length > 1) throw new expectedSyntaxError(')', peek(this.condition.value[0].tokens));
    this.body.prepare();
    this.condition.prepare();
  }

  async eval() {
    while (true) {
      await this.body.eval();
      let bool = await this.condition.eval();
      if (bool.toPrimitive("bool")) break;
    }
  }
}

class ForStructure extends Structure {
  constructor(pos, loop, body) {
    super("FOR", pos);
    this.loop = loop;
    this.body = body;
  }

  validate() {
    // LOOP must have 3 items
    if (this.loop.value.length === 0) throw new Error(`[${errors.SYNTAX}] Syntax Error: expression expected, got ) (FOR loop)`);
    if (this.loop.value.length < 2) throw new Error(`[${errors.SYNTAX}] Syntax Error: expression expected, got end of input (FOR loop)`); // If step is empty, there will only be two TokenLine objects
    if (this.loop.value.length > 3) throw new expectedSyntaxError(')', peek(this.loop.value[2].tokens));
    this.loop.value.forEach(line => line.prepare());
    this.body.prepare();
  }

  async eval() {
    await this.loop.value[0].eval();
    if (this.loop.value[1].tokens.length <= 1) { // If empty (contains only ';') - infinite loop
      while (true) {
        await this.body.eval();
        await this.loop.value[2]?.eval();
      }
    } else {
      while (true) {
        let cond = await this.loop.value[1].eval();
        if (!cond.toPrimitive("bool")) break;
        await this.body.eval();
        await this.loop.value[2]?.eval();
      }
    }
  }
}

class FuncStructure extends Structure {
  constructor(pos, rs, args, body, name = undefined) {
    super("FUNC", pos);
    this.rs = rs;
    this.name = name;
    this.args = args;
    this.body = body;
  }

  validate() {
    if (this.args.value.length > 1) throw new expectedSyntaxError(')', peek(this.args.value[2].tokens));
    this.body.prepare();
  }

  async eval() {
    let argObj = {};
    if (this.args.value.length === 1) {
      let args = this.args.value[0].splitByCommas();
      for (let arg of args) {
        if (arg.tokens[0] === undefined || arg.tokens[0].constructor.name !== 'VariableToken') throw new Error(`[${errors.SYNTAX}] Syntax Error: expected parameter name, got ${arg.tokens[0]} at position ${arg.tokens[0]?.pos}`);
        if (arg.tokens.length === 1) { // "<arg>"
          argObj[arg.tokens[0].value] = 'any';
        } else if (arg.tokens.length === 3) { // "<arg>" ":" "<type>"
          if (arg.tokens[1].constructor.name === 'OperatorToken' && arg.tokens[1].value === ':' && arg.tokens[2].constructor.name === 'VariableToken') {
            argObj[arg.tokens[0].value] = arg.tokens[2].value;
          } else {
            throw new Error(`[${errors.SYNTAX}] Syntax Error: FUNCTION: invalid syntax`);
          }
        }
      }
    }

    let fn = new RunspaceUserFunction(this.rs, this.name ?? 'anonymous', argObj, this.body);
    let ref = new FunctionRefValue(this.rs, fn);
    let ret;

    if (this.name) { // Not anonymous - define function
      this.rs.var(fn.name, ref);
    } else {
      ref.func = fn; // Bind to reference
      ret = ref; // Return reference
    }
    ref.id = ref._genid();
    return ret;
  }
}

module.exports = { Structure, ArrayStructure, SetStructure, MapStructure, IfStructure, WhileStructure, DoWhileStructure, UntilStructure, DoUntilStructure, ForStructure, FuncStructure, };