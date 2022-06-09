const Complex = require("../maths/Complex");
const { range } = require("../maths/functions");
const { RunspaceFunction } = require("../runspace/Function");
const { str, removeDuplicates, arrDifference, intersect, arrRepeat, findIndex, equal, peek, toJson } = require("../utils");
const { castingError, isNumericType, isRealType } = require("./types");
const { errors } = require("../errors");

class Value {
  constructor(runspace, value) {
    this.rs = runspace;
    this.value = value;
    this.onAssign = undefined; // If populated, __assign__ and others calls this
    this.getAssignVal = undefined; // If onAssign is defined, this is as well. Returns value that will be assigned to.
  }

  type() { throw new Error(`Requires Overload`); }

  castTo(type) {
    if (type === 'any' || type === this.type()) return this;
    if (peek(type) === '*') throw new Error(`[${errors.CAST_ERROR}] Type Error: Cannot cast object ${this.type()} to ${type} (reference)`);
    const mapObj = this.constructor.castMap;
    let value = mapObj && type in mapObj ? mapObj[type](this) : undefined;
    if (value === undefined) castingError(this, type);
    return value;
  }

  toPrimitive(type) {
    const v = this.castTo(type).value;
    if (type.startsWith('real')) return v.a; // Raw number only
    return v;
  }
  toString() { return this.toPrimitive('string'); }

  getAssignError() { return new Error(`[${errors.TYPE_ERROR}] Type Error: Cannot assign to object ${this.type()}`); }

  /** operator: = */
  __assign__(val) {
    if (this.onAssign === undefined) throw this.getAssignError();
    return this.onAssign(val.castTo('any'));
  }

  /** operator: += */
  __assignAdd__(val) {
    if (this.onAssign === undefined) throw this.getAssignError();
    return this.onAssign(this.getAssignVal().__add__(val.castTo('any')));
  }

  /** operator: -= */
  __assignSub__(val) {
    if (this.onAssign === undefined) throw this.getAssignError();
    return this.onAssign(this.getAssignVal().__sub__(val.castTo('any')));
  }

  /** operator: *= */
  __assignMul__(val) {
    if (this.onAssign === undefined) throw this.getAssignError();
    return this.onAssign(this.getAssignVal().__mul__(val.castTo('any')));
  }

  /** operator: /= */
  __assignDiv__(val) {
    if (this.onAssign === undefined) throw this.getAssignError();
    return this.onAssign(this.getAssignVal().__div__(val.castTo('any')));
  }

  /** operator: %= */
  __assignMod__(val) {
    if (this.onAssign === undefined) throw this.getAssignError();
    return this.onAssign(this.getAssignVal().__mod__(val.castTo('any')));
  }

  /** operator: u+ */
  __pos__() { return this.castTo('complex'); }

  /** operator: u- */
  __neg__() { return new NumberValue(this.rs, Complex.mult(this.toPrimitive('complex'), -1)); }

  /** operator: ' */
  __not__() { return new BoolValue(this.rs, !this.toPrimitive('bool')); }

  /** operator: in */
  __in__(collection) {
    const type = collection.type();
    if (type === 'array' || type === 'set') return new BoolValue(this.rs, findIndex(this, collection.toPrimitive('array')) !== -1);
    if (type === 'string') return new BoolValue(this.rs, collection.toString().indexOf(this.toString()) !== -1);
    if (type === 'map') return new BoolValue(this.rs, collection.value.has(this.toString()));
    throw new Error(`[${errors.TYPE_ERROR}] Type Error: object ${type} is not a collection`);
  }

  /** operator: != */
  __neq__(a) { return new BoolValue(this.rs, !this.__eq__(a).toPrimitive('bool')); }

  /** operator: && */
  __and__(a) { return this.toPrimitive('bool') && a.toPrimitive('bool') ? a : new BoolValue(this.rs, false); }

  /** operator: || */
  __or__(arg) {
    if (this.toPrimitive('bool')) return this;
    if (arg.toPrimitive('bool')) return arg;
    return new BoolValue(this.rs, false);
  }
}

class UndefinedValue extends Value {
  constructor(runspace) {
    super(runspace, undefined);
  }

  type() { return 'undef'; }

  /* operator: == */
  __eq__(v) {
    return new BoolValue(this.rs, v instanceof UndefinedValue);
  }

  __copy__() {
    return new UndefinedValue(this.rs);
  }

  /** Return JS string of JSON */
  __toJson__() {
    return "null";
  }
}

class NumberValue extends Value {
  constructor(runspace, num = 0) {
    super(runspace, Complex.assert(num));
  }

  type() { return this.value.isReal() ? "real" : "complex"; }

  /** abs() function */
  __abs__() { return Complex.abs(this.value); }

  /** copy() function - <#Complex> has a copy method available */
  __copy__() { return new NumberValue(this.rs, this.value.copy()); }

  /** reverse() function */
  __reverse__() {
    let real = this.value.a.toLocaleString('fullwide', { useGrouping: false }).split('').reverse().join('');
    let complex = this.value.b.toLocaleString('fullwide', { useGrouping: false }).split('').reverse().join('');
    return new NumberValue(this.rs, new Complex(+real, +complex));
  }

  /** operator: deg */
  __deg__() { return new NumberValue(this.rs, Complex.mult(this.value, Math.PI / 180)); }

  /** operator: == */
  __eq__(a) { return new BoolValue(this.rs, isNumericType(a.type()) ? this.value.equals(a.toPrimitive('complex')) : false); }

  /** operator: ~ */
  __bitwiseNot__() {
    if (isRealType(this.type())) return new NumberValue(this.rs, ~this.value.a);
  }

  /** operator: & */
  __bitwiseAnd__(arg) {
    if (isRealType(this.type()) && isRealType(arg.type())) return new NumberValue(this.rs, this.toPrimitive('real') & arg.toPrimitive('real'));
  }

  /** operator: | */
  __bitwiseOr__(arg) {
    if (isRealType(this.type()) && isRealType(arg.type())) return new NumberValue(this.rs, this.toPrimitive('real') | arg.toPrimitive('real'));
  }

  /** operator: ^ */
  __xor__(arg) {
    if (isRealType(this.type()) && isRealType(arg.type())) return new NumberValue(this.rs, this.toPrimitive('real') ^ arg.toPrimitive('real'));
  }

  /** operator: ** */
  __pow__(n) {
    if (isNumericType(n.type())) return new NumberValue(this.rs, Complex.pow(this.toPrimitive('complex'), n.toPrimitive('complex')));
  }

  /** operator: / */
  __div__(n) {
    if (isNumericType(n.type())) return new NumberValue(this.rs, Complex.div(this.toPrimitive('complex'), n.toPrimitive('complex')));
  }

  /** operator: % */
  __mod__(n) {
    if (isNumericType(n.type())) return new NumberValue(this.rs, Complex.modulo(this.toPrimitive('complex'), n.toPrimitive('complex')));
  }

  /** operator: * */
  __mul__(n) {
    const t = n.type();
    if (t === 'string' || isNumericType(t)) return new NumberValue(this.rs, Complex.mult(this.toPrimitive('complex'), n.toPrimitive('complex')));
  }

  /** operator: + */
  __add__(n) {
    const t = n.type();
    if (t === 'undefined') return new NumberValue(this.rs, NaN);
    if (t === 'string') return new StringValue(this.rs, this.toPrimitive('string') + n.toPrimitive('string'));
    if (isNumericType(t)) return new NumberValue(this.rs, Complex.add(this.toPrimitive('complex'), n.toPrimitive('complex')));
  }

  /** operator: - */
  __sub__(n) {
    const t = n.type();
    if (t === 'string' || isNumericType(t)) return new NumberValue(this.rs, Complex.sub(this.toPrimitive('complex'), n.toPrimitive('complex')));
  }

  /** operator: << */
  __lshift__(n) {
    const t = n.type();
    if (isRealType(this.type()) && isRealType(t)) return new NumberValue(this.rs, this.toPrimitive('real') << n.toPrimitive('real'));
  }

  /** operator: >> */
  __rshift__(n) {
    const t = n.type();
    if (isRealType(this.type()) && isRealType(t)) return new NumberValue(this.rs, this.toPrimitive('real') >> n.toPrimitive('real'));
  }

  /** operator: <= */
  __le__(n) {
    if (isRealType(this.type()) && isRealType(n.type())) return new BoolValue(this.rs, this.toPrimitive('real') <= n.toPrimitive('real'));
  }

  /** operator: < */
  __lt__(n) {
    if (isRealType(this.type()) && n.type() === 'real') return new BoolValue(this.rs, this.toPrimitive('real') < n.toPrimitive('real'));
  }

  /** operator: >= */
  __ge__(n) {
    if (isRealType(this.type()) && isRealType(n.type())) return new BoolValue(this.rs, this.toPrimitive('real') >= n.toPrimitive('real'));
  }

  /** operator: > */
  __gt__(n) {
    if (isRealType(this.type()) && isRealType(n.type())) return new BoolValue(this.rs, this.toPrimitive('real') > n.toPrimitive('real'));
  }

  /** Operator: : */
  __seq__(val) {
    const t = val.type();
    if (isRealType(t) && this.value.b === 0) {
      let rng = range(this.toPrimitive('real_int'), val.toPrimitive('real_int'));
      return new ArrayValue(this.rs, rng.map(n => new NumberValue(this.rs, n)));
    }
  }

  /** Return JSON representation */
  __toJson__() {
    if (Complex.isNaN(this.value) || !Complex.isFinite(this.value)) return new "null";
    if (isRealType(this.type())) {
      return this.toPrimitive('real').toString();
    }
  }
}

class StringValue extends Value {
  constructor(runspace, string = '', interpolations = {}) {
    super(runspace, str(string));
    this.intpls = interpolations; // Map position: TokenLine
  }

  type() { return "string"; }

  /** Return JSON representation */
  __toJson__() {
    return "\"" + this.value.replace(/[\\$'"]/g, "\\$&") + "\"";
  }

  /** Interpolate if necessary... Returns new StringValue object if interpolation */
  async eval(evalObj) {
    if (Object.keys(this.intpls).length === 0) return this;
    let cpy = new StringValue(this.rs, this.value);
    let offset = 0;
    for (let pos in this.intpls) {
      if (this.intpls.hasOwnProperty(pos)) {
        try {
          const idata = this.intpls[pos];
          let value = await idata.val.eval(evalObj), insert = value.toString();
          if (idata.eq) insert = idata.src + insert;
          let index = +pos + offset;
          cpy.value = cpy.value.substr(0, index) + insert + cpy.value.substr(index);
          offset += insert.length;
        } catch (e) {
          throw new Error(`[${errors.GENERAL}] Error whilst interpolating string (index ${pos}):\n${e}`);
        }
      }
    }
    return cpy;
  }

  /** len() function */
  __len__(newLength) {
    if (newLength !== undefined) {
      if (newLength > this.value.length) this.value += String.fromCharCode(0).repeat(newLength - this.value.length);
      else this.value = this.value.substr(0, newLength);
    }
    return this.value.length;
  }

  /** get() function */
  __get__(i) {
    i = i.toPrimitive('real_int');
    if (i < 0) i = this.value.length + i;
    if (i < 0 || i >= this.value.length) return new UndefinedValue(this.rs); // throw new Error(`Index Error: index ${i} is out of range`);
    const val = new StringValue(this.rs, this.value[i]);
    val.onAssign = value => this.__set__(i, value);
    val.getAssignVal = () => val;
    return val;
  }

  /** set() function */
  __set__(i, value) {
    i = typeof i === 'number' ? i : i.toPrimitive('real_int');
    if (i < 0) i = this.value.length + i;
    if (i < 0 || i >= this.value.length) return new UndefinedValue(this.rs); // throw new Error(`Index Error: index ${i} is out of range`);
    value = value.castTo('char').toString();
    this.value = this.value.substring(0, i) + value + this.value.substr(i + 1);
    return this;
  }

  /** del() function */
  __del__(key) {
    let i = key.toPrimitive('real_int');
    if (isNaN(i) || i < 0 || i >= this.value.length) return new UndefinedValue(this.rs); // throw new Error(`Index Error: index ${i} is out of range`);
    const chr = this.value[i];
    this.value = this.value.substring(0, i) + this.value.substr(i + 1);
    return new StringValue(this.rs, chr);
  }

  /** find() function */
  __find__(item) {
    return new NumberValue(this.rs, this.value.indexOf(item.toPrimitive('string')));
  }

  /** reverse() function */
  __reverse__() {
    return new StringValue(this.rs, this.value.split('').reverse().join(''));
  }

  /** copy() function */
  __copy__() { return new StringValue(this.rs, this.value); }

  /** min() function */
  __min__() { return this.value.length === 0 ? this.rs.UNDEFINED : new CharValue(this.rs, Math.min(...this.value.split('').map(chr => chr.charCodeAt(0)))); }

  /** max() function */
  __max__() { return this.value.length === 0 ? this.rs.UNDEFINED : new CharValue(this.rs, Math.max(...this.value.split('').map(chr => chr.charCodeAt(0)))); }

  __iter__() {
    return this.value.split('');
  }

  /** operator: == */
  __eq__(a) {
    let eq = false, aT = a.type();
    if (aT === 'string') eq = this.toString() === a.toString();
    else if (aT === 'char') eq = this.value.length === 1 && this.value.charCodeAt(0) === a.value;
    return new BoolValue(this.rs, eq);
  }

  /** operator: * */
  __mul__(n) {
    const t = n.type();
    if (t === 'real') {
      n = n.toPrimitive('real_int');
      return new StringValue(this.rs, n < 0 ? '' : this.toString().repeat(n));
    }
  }

  /** operator: + */
  __add__(n) { return new StringValue(this.rs, this.toPrimitive('string') + n.toPrimitive('string')); }

  /** Operator: : */
  __seq__(val) {
    const t = val.type();
    if (t === 'string') {
      if (this.value.length !== 1) throw new Error(`[${errors.TYPE_ERROR}] Type Error: expected char, got string "${this.value}"`);
      if (val.value.length !== 1) throw new Error(`[${errors.TYPE_ERROR}] Type Error: expected char, got string "${val.value}"`);
      let rng = range(this.value.charCodeAt(0), val.value.charCodeAt(0));
      return new ArrayValue(this.rs, rng.map(n => new StringValue(this.rs, String.fromCharCode(n))));
    }
  }

  /** Operator: % */
  __mod__(arg) {
    let t = arg.type();
    let values = t === 'array' || t === 'set' ? arg.toPrimitive('array') : [arg];
    return this.format(values);
  }

  /** Format string with Value[] */
  format(values) {
    let string = '', original = this.value, vi = 0;
    for (let i = 0; i < original.length; i++) {
      if (original[i] === '%') {
        let n1 = original[++i];
        if (n1 === undefined) {
          throw new Error(`[${errors.SYNTAX}] Syntax Error: incomplete formatting option at index ${i - 1}`);
        } else if (values[vi] === undefined) {
          string += '%' + n1;
        } else {
          if (n1 === '%') string += '%'; // "%%" -> "%"
          else if (n1 === 's') string += values[vi++].toPrimitive("string"); // "%s" or "%" -> string
          else if (n1 === 'n') string += values[vi++].toPrimitive('complex').toString(); // "%n" -> complex
          else if (n1 === 'i') string += values[vi++].toPrimitive('complex_int').toString(); // "%i" -> complex int
          else if (n1 === 'c' && original[i + 1] === 'i') { // "%ci" -> complex int
            i++;
            string += values[vi++].toPrimitive('complex_int').toString();
          }
          else if (n1 === 'r' && original[i + 1] === 'i') { // "%ri" -> real int
            i++;
            string += values[vi++].toPrimitive('real_int').toString();
          }
          else if (n1 === 'c') string += values[vi++].castTo('char').toString(); // "%c" -> character
          else if (n1 === 'b') string += values[vi++].toPrimitive('bool').toString(); // "%b" -> boolean
          else if (n1 === 'o') string += values[vi++].toPrimitive('complex').toString(8); // "%o" -> complex octal
          else if (n1 === 'd') string += values[vi++].toPrimitive('complex').toString(10); // "%d" -> complex decimal
          else if (n1 === 'x') string += values[vi++].toPrimitive('complex').toString(16, 'lower'); // "%x" -> complex hexadecimal (lowercase)
          else if (n1 === 'X') string += values[vi++].toPrimitive('complex').toString(16, 'upper'); // "%X" -> complex hexadecimal (uppercase)
          else if (n1 === 'e') string += values[vi++].toPrimitive('complex').toExponential(); // "%e" -> complex exponential
          else throw new Error(`[${errors.SYNTAX}] Syntax Error: unknown formatting option '${n1}' (0x${n1.charCodeAt(0).toString(16)}) at index ${i - 1}`);
        }
      } else {
        string += original[i];
      }
    }
    if (vi < values.length) {
      for (; vi < values.length; vi++) string += ' ' + values[vi].toPrimitive("string");
    }
    return new StringValue(this.rs, string);
  }
}

class CharValue extends Value {
  /** char may either be NUMBER or STRING */
  constructor(runspace, arg = 0) {
    if (arg === '') arg = 0;
    if (arg instanceof Complex) throw new Error("CharValue: complex value not allowed!");
    let value = typeof arg === 'number' ? arg : str(arg[0]).charCodeAt(0);
    super(runspace, value);
  }

  type() { return "char"; }

  /** abs() function */
  __abs__() { return this.value; }

  /** copy() function */
  __copy__() { return new CharValue(this.rs, this.value); }

  /** Return JSON representation */
  __toJson__() {
    return this.castTo("string").__toJson__();
  }

  /** operator: == */
  __eq__(other) {
    let t = other.type(), eq = false;
    if (t === 'char') eq = this.value === other.value;
    else if (t === 'string') eq = other.value.length === 1 && this.value === other.value.charCodeAt(0);
    else if (t === 'real') eq = this.value === other.value.a;
    else if (t === 'bool') eq = this.value === other.value;
    return new BoolValue(this.rs, eq);
  }

  /** operator: ~ */
  __bitwiseNot__() {
    return new CharValue(this.rs, ~this.value);
  }

  /** operator: & */
  __bitwiseAnd__(arg) {
    if (isRealType(arg.type())) return new CharValue(this.rs, this.value & arg.toPrimitive('real'));
  }

  /** operator: | */
  __bitwiseOr__(arg) {
    if (isRealType(arg.type())) return new CharValue(this.rs, this.value | arg.toPrimitive('real'));
  }

  /** operator: ^ */
  __xor__(arg) {
    if (isRealType(arg.type())) return new CharValue(this.rs, this.value ^ arg.toPrimitive('real'));
  }

  /** operator: ** */
  __pow__(n) {
    if (isRealType(n.type())) return new CharValue(this.rs, Math.pow(this.value, n.toPrimitive('real')));
  }

  /** operator: / */
  __div__(n) {
    if (isRealType(n.type())) return new CharValue(this.rs, this.value / n.toPrimitive('real'));
  }

  /** operator: % */
  __mod__(n) {
    if (isRealType(n.type())) return new CharValue(this.rs, this.value % n.toPrimitive('real'));
  }

  /** operator: * */
  __mul__(n) {
    const t = n.type();
    if (t === 'string' || isRealType(t)) return new CharValue(this.rs, this.value * n.toPrimitive('real'));
  }

  /** operator: + */
  __add__(n) {
    const t = n.type();
    if (t === 'string' || isRealType(t)) return new CharValue(this.rs, this.value + n.toPrimitive('real'));
  }

  /** operator: - */
  __sub__(n) {
    const t = n.type();
    if (t === 'string' || isRealType(t)) return new CharValue(this.rs, this.value - n.toPrimitive('real'));
  }

  /** operator: << */
  __lshift__(n) {
    const t = n.type();
    if (isRealType(t)) return new CharValue(this.rs, this.value << n.toPrimitive('real'));
  }

  /** operator: >> */
  __rshift__(n) {
    const t = n.type();
    if (isRealType(t)) return new CharValue(this.rs, this.value >> n.toPrimitive('real'));
  }

  /** operator: <= */
  __le__(n) {
    if (isRealType(n.type())) return new BoolValue(this.rs, this.value <= n.toPrimitive('real'));
  }

  /** operator: < */
  __lt__(n) {
    if (n.type() === 'real') return new BoolValue(this.rs, this.value < n.toPrimitive('real'));
  }

  /** operator: >= */
  __ge__(n) {
    if (isRealType(n.type())) return new BoolValue(this.rs, this.value >= n.toPrimitive('real'));
  }

  /** operator: > */
  __gt__(n) {
    if (isRealType(n.type())) return new BoolValue(this.rs, this.value > n.toPrimitive('real'));
  }

  /** Operator: : */
  __seq__(val) {
    const t = val.type();
    if (isNumericType(t)) {
      let rng = range(this.toPrimitive('real_int'), val.toPrimitive('real_int'));
      return new ArrayValue(this.rs, rng.map(n => new NumberValue(this.rs, n)));
    }
  }
}

class BoolValue extends Value {
  constructor(runspace, boolean = false) {
    super(runspace, !!boolean);
  }

  type() { return "bool"; }

  /** copy() function */
  __copy__() { return new BoolValue(this.rs, this.value); }

  /** Return JSON representation */
  __toJson__() { return this.value ? "true" : "false"; }

  /** operator: == */
  __eq__(a) { return new BoolValue(this.rs, isNumericType(a.type()) ? this.value === a.toPrimitive('bool') : false); }

  /** operator: ~ */
  __bitwiseNot__() { return new NumberValue(this.rs, ~this.value); }

  /** operator: & */
  __bitwiseAnd__(arg) {
    const argt = arg.type();
    if (isRealType(argt)) return new NumberValue(this.rs, this.toPrimitive('real') & arg.toPrimitive('real'));
  }

  /** operator: | */
  __bitwiseOr__(arg) {
    const argt = arg.type();
    if (isRealType(argt)) return new NumberValue(this.rs, this.toPrimitive('real') | arg.toPrimitive('real'));
  }

  /** operator: ^ */
  __xor__(arg) {
    const argt = arg.type();
    if (isRealType(argt)) return new NumberValue(this.rs, this.toPrimitive('real') ^ arg.toPrimitive('real'));
  }

  /** operator: + */
  __add__(n) {
    if (isNumericType(n.type())) return new NumberValue(this.rs, Complex.add(this.toPrimitive('real'), n.toPrimitive('complex')));
  }
}

class ArrayValue extends Value {
  constructor(runspace, items = [], castToAny = true) {
    super(runspace, castToAny ? items.map(v => v.castTo('any')) : items);
  }

  type() { return "array"; }

  __iter__() {
    return this.value;
  }

  /** len() function */
  __len__(newLength) {
    if (newLength !== undefined) {
      if (newLength > this.value.length) while (newLength > this.value.length) this.value.push(this.rs.UNDEFINED);
      else this.value.length = newLength;
    }
    return this.value.length;
  }

  /** abs() function */
  __abs__() { return this.value.length; }

  /** Return JSON representation*/
  __toJson__() { return new "[" + this.value.map(v => toJson(v)).join(',') + "]"; }

  /** min() function */
  __min__() { return this.value.length === 0 ? this.rs.UNDEFINED : new NumberValue(this.rs, Math.min(...this.value.map(v => v.toPrimitive('real')))); }

  /** max() function */
  __max__() { return this.value.length === 0 ? this.rs.UNDEFINED : new NumberValue(this.rs, Math.max(...this.value.map(v => v.toPrimitive('real')))); }

  /** get() function */
  __get__(i) {
    i = i.toPrimitive('real_int');
    if (i < 0) i = this.value.length + i; // Advance from end of array
    const val = (isNaN(i) || i < 0 || i >= this.value.length) ? new UndefinedValue(this.rs) : this.value[i];
    val.onAssign = value => this.__set__(i, value);
    val.getAssignVal = () => this.value[i];
    return val;
  }

  /** set() function */
  __set__(i, value) {
    i = typeof i === 'number' ? i : i.toPrimitive('real_int');
    if (i < 0) i = this.value.length + i;
    if (isNaN(i) || i < 0) return new UndefinedValue(this.rs);
    if (i >= this.value.length) {
      for (let j = this.value.length; j < i; j++) {
        this.value[j] = new UndefinedValue(this.rs);
      }
    }
    this.value[i] = value;
    return this;
  }

  /** del() function */
  __del__(key) {
    let i = key.toPrimitive('real_int');
    if (isNaN(i) || i < 0 || i >= this.value.length) return new UndefinedValue(this.rs); // throw new Error(`Index Error: index ${i} is out of range`);
    this.value.splice(i, 1);
    return new NumberValue(this.rs, i);
  }

  /** reverse() function */
  __reverse__() {
    this.value.reverse();
    return this;
  }

  /** find() function */
  __find__(item) {
    return new NumberValue(this.rs, findIndex(item, this.value));
  }

  /** copy() function */
  __copy__() {
    const emsg = (v, i) => `[${errors.CANT_COPY}] Type Error: Error whilst copying type array:\n[${errors.CANT_COPY}] Index ${i}: type ${v.type()} cannot be copied`;
    return new ArrayValue(this.rs, this.value.map((v, i) => {
      let copy;
      try { copy = v.__copy__?.(); } catch (e) { throw new Error(`${emsg(v, i)}\n${e}`); }
      if (copy === undefined) throw new Error(emsg(v, i));
      return copy;
    }));
  }

  /** Array assignmation. This -> symbols. Other -> values */
  __assignTemplate(other, assignFnName) {
    if (other.type() === 'array') {
      try {
        // if (other.value.length > this.value.length) throw new Error(`[${errors.TYPE_ERROR}] Type Error: Cannot unpack array of length ${other.value.length} into array of length ${this.value.length}`);
        let lim = this.value.length, tmpValues = [];
        for (let i = 0; i < lim; i++) {
          if (typeof this.value[i][assignFnName] !== 'function') {
            throw new Error(`[${errors.TYPE_ERROR}] Type Error: Unable to unpack arrays: cannot assign to type ${this.value[i].type()} (${this.value[i]})`);
          }
          tmpValues.push(other.value[i] ? other.value[i].castTo("any") : this.rs.UNDEFINED);
        }

        for (let i = 0; i < this.value.length; i++) {
          this.value[i][assignFnName](tmpValues[i]);
        }
        return this;
      } catch (e) {
        throw new Error(`[${errors.BAD_ARG}] Errors whilst unpacking array[${other.value.length}] into array[${this.value.length}]:\n${e}`);
      }
    }
  }

  __assign__(other) {
    return this.__assignTemplate(other, "__assign__");
  }

  __nonlocalAssign__(other) {
    return this.__assignTemplate(other, "__nonlocalAssign__");
  }

  /** operator: == */
  __eq__(a) { return new BoolValue(this.rs, a.type() === 'array' && this.value.length === a.value.length ? this.value.map((_, i) => equal(this.value[i], a.value[i])).every(x => x) : false); }

  /** operator: * */
  __mul__(n) {
    const t = n.type();
    if (t === 'array') return new ArrayValue(this.rs, intersect(this.toPrimitive('array'), n.toPrimitive('array')));
    if (t === 'real') return new ArrayValue(this.rs, arrRepeat(this.toPrimitive('array'), n.toPrimitive('real_int')));
  }

  /** operator: + */
  __add__(n) {
    const t = n.type();
    if (t === 'array') return new ArrayValue(this.rs, this.toPrimitive('array').concat(n.toPrimitive('array')));
    return new ArrayValue(this.rs, [...this.toPrimitive('array'), n]);
  }

  /** operator: - */
  __sub__(n) {
    const t = n.type();
    if (t === 'array') return new ArrayValue(this.rs, arrDifference(this.toPrimitive('array'), n.toPrimitive('array')));
  }
}

class SetValue extends Value {
  constructor(runspace, items = []) {
    super(runspace, items);
    this.check();
  }

  /** Remove duplicate values */
  check() {
    this.value = removeDuplicates(this.value);
  }

  type() { return "set"; }

  /** len() function */
  __len__(newLength) {
    if (newLength !== undefined) {
      if (newLength > this.value.length) throw new Error(`[${errors.TYPE_ERROR}] Type Error: cannot set len() of type ${this.type()}`);
      else this.value.splice(this.value.length - newLength);
    }
    return this.value.length;
  }

  /** Return JSON representation*/
  __toJson__() { return "[" + this.value.map(v => toJson(v)) + "]"; }

  /** abs() function */
  __abs__() { return this.value.length; }

  /** min() function */
  __min__() { return this.value.length === 0 ? this.rs.UNDEFINED : new StringValue(this.rs, Math.min(...this.value.map(v => v.toPrimitive('real')))); }

  /** max() function */
  __max__() { return this.value.length === 0 ? this.rs.UNDEFINED : new StringValue(this.rs, Math.max(...this.value.map(v => v.toPrimitive('real')))); }

  /** reverse() function */
  __reverse__() {
    this.value.reverse();
    return this;
  }

  /** find() function */
  __find__(item) {
    return new NumberValue(this.rs, findIndex(item, this.value));
  }

  /** copy() function */
  __copy__() {
    const emsg = (v, i) => `[${errors.CANT_COPY}] Error whilst copying type set: index ${i}: type ${v.type()} cannot be copied`;
    return new SetValue(this.rs, this.value.map((v, i) => {
      let copy;
      try { copy = v.__copy__?.(); } catch (e) { throw new Error(`${emsg(v, i)}\n${e}`); }
      if (copy === undefined) throw new Error(emsg(v, i));
      return copy;
    }));
  }

  __iter__() {
    return this.value;
  }

  /** Run and return fn() */
  run(fn) {
    let tmp = fn(this);
    this.check();
    return tmp;
  }

  /** operator: == */
  __eq__(a) { return new BoolValue(this.rs, a.type() === 'set' && this.value.length === a.value.length ? this.value.map(v => findIndex(v, a.value) !== -1).every(x => x) : false); }

  /** operator: ' */
  __not__() {
    const us = this.rs.getVar('universal_set')?.castTo('any');
    if (us == undefined) return new Error(`Type Error: variable universal_set is missing.`);
    if (us.type() !== 'set') return new Error(`Type Error: variable universal_set is not of type set (got ${us.type()})`);
    return new SetValue(this.rs, arrDifference(us.toPrimitive('array'), this.toPrimitive('array')));
  }

  /** operator: * */
  __mul__(n) {
    const t = n.type();
    if (t === 'set') return new SetValue(this.rs, intersect(this.toPrimitive('array'), n.toPrimitive('array')));
  }

  /** operator: + */
  __add__(n) {
    const t = n.type();
    if (t === 'set') return new SetValue(this.rs, this.toPrimitive('array').concat(n.toPrimitive('array')));
    return new SetValue(this.rs, [...this.toPrimitive('array'), n]);
  }

  /** operator: - */
  __sub__(n) {
    const t = n.type();
    if (t === 'set') return new SetValue(this.rs, arrDifference(this.toPrimitive('array'), n.toPrimitive('array')));
  }

  /** Map assignmation. This -> symbols. Other (map) -> values */
  __assignTemplate(other, assignFnName) {
    if (other.type() === 'map') {
      try {
        let tmpValues = new Map();
        for (let i = 0; i < this.value.length; i++) {
          if (typeof this.value[i][assignFnName] !== 'function') {
            throw new Error(`[${errors.TYPE_ERROR}] Type Error: Unable to unpack arrays: cannot assign to type ${this.value[i].type()} (${this.value[i]})`);
          }
          let key = this.value[i].value;
          tmpValues.set(key, other.value.has(key) ? other.value.get(key).castTo("any") : this.rs.UNDEFINED);
        }

        for (let i = 0; i < this.value.length; i++) {
          let key = this.value[i].value;
          this.value[i][assignFnName](tmpValues.get(key));
        }
        return this;
      } catch (e) {
        throw new Error(`[${errors.BAD_ARG}] Errors whilst unpacking array[${other.value.length}] into array[${this.value.length}]:\n${e}`);
      }
    }
  }

  __assign__(other) {
    return this.__assignTemplate(other, "__assign__")
  }

  __nonlocalAssign__(other) {
    return this.__assignTemplate(other, "__nonlocalAssign__");
  }
}

class MapValue extends Value {
  constructor(runspace, map = undefined) {
    super(runspace, null);
    this.value = map === undefined ? new Map() : map;
    this.inheritFrom = new Set(); // Collection of MapValues we inherit from
    this.instanceOf = undefined; // Reference to MapValue we are an instance of
  }

  type() { return "map"; }

  /** Create and return new MapValue which is an instance of this */
  createInstance() {
    let map = new Map();
    this._passCreateInstanceValues(map);
    let mapValue = new MapValue(this.rs, map);
    mapValue.instanceOf = this;
    return mapValue;
  }

  /** Copy values to be passed in as instance creation */
  _passCreateInstanceValues(map) {
    // Copy all non-function values
    this.value.forEach((value, key) => {
      value = value.castTo("any");
      if (!(value instanceof FunctionRefValue)) {
        map.set(key, value.__copy__());
      }
    });
    this.inheritFrom.forEach(x => x._passCreateInstanceValues(map));
    return map;
  }

  /** Check if this is an instance of the argument (argument is of type `map`) */
  isInstanceOf(map) {
    // Check if instance
    if (this.instanceOf === map) return true;
    // Check top-level of inheritance tree
    for (let x of this.inheritFrom) if (x === map) return true;
    if (this.instanceOf) for (let x of this.instanceOf.inheritFrom) if (x === map) return true;
    // Check inheritance tree
    for (let x of this.inheritFrom) if (x.isInstanceOf(map)) return true;
    if (this.instanceOf) for (let x of this.instanceOf.inheritFrom) if (x.isInstanceOf(map)) return true;
    return false;
  }

  /** len() function */
  __len__(newLength) {
    if (newLength !== undefined) {
      if (newLength !== 0) throw new Error(`[${errors.TYPE_ERROR}] Type Error: cannot set non-zero len() of type ${this.type()}`)
      this.value.clear();
    }
    return this.value.size;
  }

  /** abs() function */
  __abs__() { return this.value.size; }

  /** Return JSON representation*/
  __toJson__() { return "{" + Array.from(this.value.entries()).map(([k, v]) => "\"" + k + "\":" + toJson(v)).join(',') + "}"; }

  /** min() function */
  __min__() {
    if (this.value.size === 0) return this.rs.UNDEFINED;
    let minKey, minVal = new NumberValue(this.rs, Infinity);
    this.value.forEach((val, key) => {
      if (val.__lt__?.(minVal).toPrimitive("bool")) {
        minKey = key;
        minVal = val;
      }
    });
    return minKey ? new StringValue(this.rs, minKey) : minKey;
  }

  /** max() function */
  __max__() {
    if (this.value.size === 0) return this.rs.UNDEFINED;
    let maxKey, maxVal = new NumberValue(this.rs, -Infinity);
    this.value.forEach((val, key) => {
      if (val.__gt__?.(maxVal).toPrimitive("bool")) {
        maxKey = key;
        maxVal = val;
      }
    });
    return maxKey ? new StringValue(this.rs, maxKey) : maxKey;
  }

  /** Get raw value (key must be JS string) */
  __getRaw(key) {
    let val = this.value.has(key) ? this.value.get(key) : undefined;
    // Check InstanceOf map
    if (!val && this.instanceOf) {
      val = this.instanceOf.__getRaw(key); // Search parent as well
      if (val instanceof FunctionRefValue) {
        val = val.__copy__();
        val.prependArgs.push(this);
      }
    }
    // Check maps we inherit from
    if (!val) {
      for (let i of this.inheritFrom) {
        val = i.__getRaw(key);
        if (val) break;
      }
    }
    return val;
  }

  /** get() function */
  __get__(key) {
    key = key.toString();
    let val = this.__getRaw(key) ?? new UndefinedValue(this.rs);
    val.onAssign = value => this.__set__(key, value);
    val.getAssignVal = () => this.value.get(key);
    return val;
  }

  /** set() function */
  __set__(key, value) {
    key = key.toString();
    this.value.set(key, value);
    return this;
  }

  /** del() function */
  __del__(key) {
    key = key.toString();
    if (!this.value.has(key)) return new UndefinedValue(this.rs); // throw new Error(`Key Error: key "${key}" does not exist in map`);
    const val = this.value.get(key);
    this.value.delete(key);
    return val;
  }

  /** find() function */
  __find__(item) {
    for (const [key, value] of this.value.entries()) {
      if (equal(item, value)) return new StringValue(this.rs, key);
    }
    return new UndefinedValue(this.rs);
  }

  /** copy() function */
  __copy__() {
    const emsg = (v, key) => `[${errors.CANT_COPY}] Error whilst copying type map: key ${key}: type ${v.type()} cannot be copied`;
    const map = new MapValue(this.rs);
    this.value.forEach((v, key) => {
      let copy;
      try { copy = v.__copy__?.(); } catch (e) { throw new Error(`${emsg(v, key)}\n${e}`); }
      if (copy === undefined) throw new Error(emsg(v, key));
      map.value.set(key, copy);
    });
    return map;
  }

  /** Construct */
  async __call__(evalObj, args) {
    let obj = this.createInstance();
    if (this.value.has("_Construct")) {
      let construct = this.value.get("_Construct").castTo("any"), ret;
      construct = construct.getFn ? construct.getFn() : construct;
      if (construct instanceof RunspaceFunction) {
        let firstArg = Object.keys(construct.rargs)[0], data = firstArg ? construct.args.get(firstArg) : undefined;
        if (!data || data.pass !== 'ref' || data.type !== 'map' || data.optional !== false || data.ellipse !== false) throw new Error(`[${errors.BAD_ARG}] Argument Error: First argument of _Construct should match '${firstArg ?? 'obj'}: ref map', got '${firstArg ? construct.argumentSignature(firstArg) : ''}'`);
        try {
          ret = await construct.call(evalObj, [obj, ...args]);
        } catch (e) {
          throw new Error(`[${errors.GENERAL}] _Construct ${construct.signature()}:\n${e}`);
        }
      } else {
        throw new Error(`[${errors.TYPE_ERROR}] Type Error: expected _Construct to be a function, got ${construct.type()}`);
      }
    }
    return obj;
  }

  __iter__() {
    return Array.from(this.value.entries()).map(([k, v]) => ([new StringValue(this.rs, k), v]));
  }

  /** operator: == */
  __eq__(a) {
    let bool = false;
    if (a.type() === 'map') {
      let ethis = Array.from(this.value.entries()), ea = Array.from(a.value.entries());
      bool = (ethis.length === ea.length) ?
        ethis.map(key => equal(this.value.get(key[0]), a.value.get(key[0]))).every(x => x)
        : false;
    }
    return new BoolValue(this.rs, bool);
  }
}

/** Stores a RunspaceFunction */
class FunctionRefValue extends Value {
  constructor(runspace, fn = undefined) {
    super(runspace, fn);
    this.prependArgs = [];
  }

  type() { return "func"; }

  exists() {
    return this.value !== undefined;
  }

  getFn() {
    return this.value;
  }

  toString() {
    return `<func ${this.value.name}>`;
  }

  /** When this is called. Takes array of Value classes as arguments */
  async __call__(evalObj, args) {
    const fn = this.getFn();
    if (this.prependArgs.length > 0) args = [...this.prependArgs, ...args];
    if (fn) {
      try {
        return await fn.call(evalObj, args);
      } catch (e) {
        throw new Error(`[${errors.GENERAL}] Function ${fn.signature()}:\n${e}`);
      }
    } else {
      this._throwNullRef();
    }
  }

  /** Throw NULL REFERENCE error */
  _throwNullRef() {
    throw new Error(`[${errors.NULL_REF}] Null Reference: reference to undefined function ${this}`);
  }

  /** copy() function */
  __copy__() { return new FunctionRefValue(this.rs, this.value); }

  /** operator: == */
  __eq__(a) { return new BoolValue(this.rs, a.type() === 'func' ? this.value === a.value : false); }
}


/** Convert primitive JS value to Value class */
function primitiveToValueClass(runspace, primitive) {
  if (primitive instanceof Value) return primitive; // Already a value
  if (runspace == undefined) return new UndefinedValue(runspace); // undefined
  if (typeof primitive === 'boolean') return new BoolValue(runspace, primitive); // Boolean
  const c = Complex.is(primitive);
  if (c !== false) return new NumberValue(runspace, c); // Number
  if (primitive instanceof Set) return new SetValue(runspace, Array.from(primitive).map(p => primitiveToValueClass(runspace, p))); // Set
  if (primitive instanceof Map) { // Map
    let map = new MapValue(rs);
    primitive.forEach((v, k) => {
      map.value.set(k, primitiveToValueClass(runspace, v));
    });
    return map;
  }
  if (Array.isArray(primitive)) return new ArrayValue(runspace, primitive.map(p => primitiveToValueClass(runspace, p))); // Array
  if (primitive instanceof RunspaceFunction) {
    const varVal = runspace.getVar(primitive.name);
    if (varVal instanceof FunctionRefValue) return varVal;
    return new FunctionRefValue(this, primitive); // Function
  }
  return new StringValue(runspace, primitive); // Else, string
}

/** This is used for Value.__new__ */
Value.typeMap = {
  complex: NumberValue,
  complex_int: NumberValue,
  real: NumberValue,
  real_int: NumberValue,
  string: StringValue,
  char: CharValue,
  bool: BoolValue,
  array: ArrayValue,
  set: SetValue,
  map: MapValue,
};

Value.__new__ = (rs, t) => {
  if (t in Value.typeMap) return new Value.typeMap[t](rs);
  return undefined;
};

/** Setup casting maps */
UndefinedValue.castMap = {
  string: o => new StringValue(o.rs, 'undef'),
  char: o => new CharValue(o.rs, 0),
  complex: o => new NumberValue(o.rs, NaN),
  complex_int: o => new NumberValue(o.rs, NaN),
  real: o => new NumberValue(o.rs, NaN),
  real_int: o => new NumberValue(o.rs, NaN),
  bool: o => new BoolValue(o.rs, false),
};

NumberValue.castMap = {
  complex: o => o,
  complex_int: o => new NumberValue(o.rs, Complex.floor(o.value)),
  real: o => new NumberValue(o.rs, o.value.a),
  real_int: o => new NumberValue(o.rs, Math.floor(o.value.a)),
  string: o => {
    let s;
    if (isNaN(o.value.a) || isNaN(o.value.b)) s = 'nan';
    else if (o.value.b === 0 && !isFinite(o.value.a)) s = o.value.a < 0 ? "-inf" : "inf";
    else if (!isFinite(o.value.a) || !isFinite(o.value.b)) s = 'inf';
    else s = str(o.value);
    return new StringValue(o.rs, s);
  },
  char: o => new CharValue(o.rs, Math.floor(o.value.a)),
  bool: o => {
    if (o.value.b === 0) return new BoolValue(o.rs, !!o.value.a);
    if (o.value.a === 0) return new BoolValue(o.rs, !!o.value.b);
    return new BoolValue(o.rs, true);
  },
};

StringValue.castMap = {
  string: o => o,
  char: o => {
    if (o.value.length === 1) return new CharValue(o.rs, o.value[0]);
    throw new Error(`[${errors.CAST_ERROR}] Cannot safely cast string of length ${o.value.length} to type char`);
  },
  bool: o => new BoolValue(o.rs, !!o.value),
  complex: o => new NumberValue(o.rs, +o.value),
  complex_int: o => new NumberValue(o.rs, Math.floor(+o.value)),
  real: o => new NumberValue(o.rs, +o.value),
  real_int: o => new NumberValue(o.rs, Math.floor(+o.value)),
  array: o => new ArrayValue(o.rs, o.value.split('').map(s => new StringValue(o.rs, s))),
  set: o => new SetValue(o.rs, o.value.split('').map(s => new StringValue(o.rs, s))),
};

CharValue.castMap = {
  char: o => o,
  string: o => new StringValue(o.rs, String.fromCharCode(o.value)),
  bool: o => new BoolValue(o.rs, !!o.value),
  complex: o => new NumberValue(o.rs, o.value),
  complex_int: o => new NumberValue(o.rs, o.value),
  real: o => new NumberValue(o.rs, o.value),
  real_int: o => new NumberValue(o.rs, o.value),
};

BoolValue.castMap = {
  bool: o => o,
  complex: o => new NumberValue(o.rs, +o.value),
  complex_int: o => new NumberValue(o.rs, +o.value),
  real: o => new NumberValue(o.rs, +o.value),
  real_int: o => new NumberValue(o.rs, +o.value),
  string: o => new StringValue(o.rs, o.value.toString()),
  char: o => new CharValue(o.rs, +o.value),
};

ArrayValue.castMap = {
  array: o => o,
  set: o => new SetValue(o.rs, o.value),
  string: o => new StringValue(o.rs, "[" + o.value.map(t => t.toString()).join(',') + "]"),
  bool: o => new BoolValue(o.rs, o.value.length !== 0),
  map: o => {
    const map = new MapValue(o.rs);
    o.value.forEach((v, i) => map.value.set(i, v));
    return map;
  },
};

SetValue.castMap = {
  set: o => o,
  array: o => new ArrayValue(o.rs, o.value),
  string: o => new StringValue(o.rs, "{" + o.value.map(t => t.toString()).join(',') + "}"),
  bool: o => new BoolValue(o.rs, o.value.length !== 0),
  map: o => o.__len__() === 0 ? new MapValue(o.rs) : undefined, // Convert empty sets to map, nothing else
};

MapValue.castMap = {
  map: o => o,
  string: o => new StringValue(o.rs, "{" + Array.from(o.value.entries()).map(pair => pair.join(':')).join(',') + "}"),
  bool: o => new BoolValue(o.rs, !!o.value),
  array: o => new ArrayValue(o.rs, o.__iter__().map(a => new ArrayValue(o.rs, a))),
};

FunctionRefValue.castMap = {
  func: o => o,
  string: o => new StringValue(o.rs, o.toString()),
  bool: o => new BoolValue(o.rs, true),
};

module.exports = { Value, UndefinedValue, NumberValue, StringValue, CharValue, BoolValue, ArrayValue, SetValue, MapValue, FunctionRefValue, primitiveToValueClass };