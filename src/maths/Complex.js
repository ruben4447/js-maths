/**
 * @prop a - Real component in 'a + bi' notation
 * @prop b - Imaginary component in 'a + bi' notation
 * 
 * Thanks to http://scipp.ucsc.edu/~haber/archives/physics116A10/arc_10.pdf, https://en.wikipedia.org/wiki/Complex_number, https://www.youtube.com/channel/UC_SvYP0k05UKiJ_2ndB02IA
 */
class Complex {
  /**
   * Build a complex number in form 'a + bi', where a and b are real
   */
  constructor(a = 0, b = 0) {
    this.a = +a;
    this.b = +b;
  }

  /** Do we only have a real component? */
  isReal() {
    return this.b === 0;
  }

  /** Add a complex number to this: this = this + z */
  add(z) {
    z = Complex.assert(z);
    this.a += z.a;
    this.b += z.b;
    return this;
  }

  /** Subtract a complex number from this: this = this - z */
  sub(z) {
    z = Complex.assert(z);
    this.a -= z.a;
    this.b -= z.b;
    return this;
  }

  /** Multiply by a complex number : this = this * z */
  mult(z) {
    z = Complex.assert(z);
    let a = (this.a * z.a) - (this.b * z.b);
    let b = (this.a * z.b) + (this.b * z.a);
    this.a = a;
    this.b = b;
    return this;
  }

  /** Get/set magnitude of complex number on argand plane */
  mag(r = undefined) {
    if (r === undefined) return Math.sqrt(Math.pow(this.a, 2) + Math.pow(this.b, 2));
    let θ = this.arg();
    this.a = r * Math.cos(θ);
    this.b = r * Math.sin(θ);
    return this;
  }

  /** Get/set arg - angle between self and positive Real axis */
  arg(θ = undefined) {
    if (θ === undefined) return Math.atan2(this.b, this.a);
    let r = this.mag();
    this.a = r * Math.cos(θ);
    this.b = r * Math.sin(θ);
    return this;
  }

  /** Find complex conjugate (z*). Return as new Complex number. */
  conjugate() {
    return new Complex(this.a, -this.b);
  }

  /** Find reciprocal */
  reciprocal() {
    let a = this.a / (Math.pow(this.a, 2) + Math.pow(this.b, 2));
    let b = this.b / (Math.pow(this.a, 2) + Math.pow(this.b, 2));
    this.a = a;
    this.b = -b;
    return this;
  }

  /** Divide by complex: this = this / w */
  div(z) {
    z = Complex.assert(z);
    let denom = (z.a * z.a) + (z.b * z.b);
    let a = (this.a * z.a) + (this.b * z.b);
    let b = (this.b * z.a) - (this.a * z.b);
    this.a = a / denom;
    this.b = b / denom;
    return this;
  }

  /** CCalculate this % z */
  modulo(z) {
    z = Complex.assert(z);
    let divb = Complex.div(this, z);
    let ans = this.sub(_zapply(divb, Math.floor).mult(z));
    this.a = ans.a;
    this.b = ans.b;
    return this;
  }

  /** Raise to a power: this = this ^ z */
  pow(z) {
    // (a + bi) ^ (c + di)
    z = Complex.assert(z);
    let a, b;
    if (z.equals(0)) { // n^0
      a = 1;
      b = 0;
    } else if (z.equals(1)) { // n^1
      a = this.a;
      b = this.b;
    } else if (this.equals(0) && z.b === 0 && z.a > 0) { // 0^n where n > 0 if 0 else NaN
      if (z.b === 0 && z.a > 0) {
        a = 0;
        b = 0;
      } else {
        a = NaN;
        b = NaN;
      }
    } else {
      const r = this.mag(), θ = this.arg();
      let common = Math.pow(r, z.a) * Math.exp(-z.b * θ); // Commong multiplier of both
      let value = (z.a * θ) + (z.b * Math.log(r)); // Commong value of trig functions
      a = common * Math.cos(value);
      b = common * Math.sin(value);
    }
    this.a = a;
    this.b = b;
    return this;
  }

  /** Is this == z */
  equals(z) {
    z = Complex.assert(z);
    return this.a === z.a && this.b === z.b;
  }

  toString(radix = undefined, ncase = undefined) {
    if (Complex.isNaN(this)) return 'nan';
    if (this.a === 0 && this.b === 0) return '0';
    let str = '', string;
    if (ncase === "upper") string = z => z.toString(radix).toUpperCase();
    else if (ncase === "lower") string = z => z.toString(radix).toLowerCase();
    else string = z => z.toString(radix);
    if (this.a !== 0) str += isFinite(this.a) ? string(this.a) : 'inf';
    if (this.b !== 0) {
      if (this.b >= 0 && this.a !== 0) str += '+';
      if (this.b === -1) str += '-';
      else if (this.b !== 1) str += isFinite(this.b) ? string(this.b) : 'inf';
      str += Complex.imagLetter;
    }
    return str;
  }

  toLocaleString(locales = undefined, options = undefined) {
    if (Complex.isNaN(this)) return 'nan';
    if (this.a === 0 && this.b === 0) return '0';
    let str = '';
    if (this.a !== 0) str += isFinite(this.a) ? this.a.toLocaleString(locales, options) : 'inf';
    if (this.b !== 0) {
      if (this.b >= 0 && this.a !== 0) str += '+';
      if (this.b === -1) str += '-';
      else if (this.b !== 1) str += isFinite(this.b) ? this.b.toLocaleString(locales, options) : 'inf';
      str += Complex.imagLetter;
    }
    return str;
  }

  toExponential(fdigits = undefined) {
    if (Complex.isNaN(this)) return 'nan';
    if (this.a === 0 && this.b === 0) return '0';
    let str = '';
    if (this.a !== 0) str += isFinite(this.a) ? this.a.toExponential(fdigits) : 'inf';
    if (this.b !== 0) {
      if (this.b >= 0 && this.a !== 0) str += '+';
      if (this.b === -1) str += '-';
      else if (this.b !== 1) str += isFinite(this.b) ? this.b.toExponential(fdigits) : 'inf';
      str += Complex.imagLetter;
    }
    return str;
  }

  /** Return copy of this */
  copy() {
    return new Complex(this.a, this.b);
  }

  /** Return new complex number = a + b */
  static add(a, b) {
    a = Complex.assert(a);
    b = Complex.assert(b);
    return a.copy().add(b);
  }

  /** Return new complex number = a - b */
  static sub(a, b) {
    a = Complex.assert(a);
    b = Complex.assert(b);
    return a.copy().sub(b);
  }

  /** Return new complex number = a * b */
  static mult(a, b) {
    a = Complex.assert(a);
    b = Complex.assert(b);
    return a.copy().mult(b);
  }

  /** Return new complex number = a / b */
  static div(a, b) {
    a = Complex.assert(a);
    b = Complex.assert(b);
    return a.copy().div(b);
  }

  /** Return new complex number = a % b */
  static modulo(a, b) {
    a = Complex.assert(a);
    b = Complex.assert(b);
    return a.copy().modulo(b);
  }

  /** Return new complex number = a ^ b */
  static pow(a, b) {
    a = Complex.assert(a);
    b = Complex.assert(b);
    return a.copy().pow(b);
  }

  /** Calculate sine of a complex number */
  static sin(z) {
    z = Complex.assert(z);

    return new Complex(Math.sin(z.a) * Math.cosh(z.b), Math.cos(z.a) * Math.sinh(z.b));
  }

  /** Calculate hyperbolic sine of a complex number */
  static sinh(z) {
    // sinh(a + bi) = sinh(a)cos(b) + cosh(a)sin(b)i
    z = Complex.assert(z);
    return new Complex(Math.sinh(z.a) * Math.cos(z.b), Math.cosh(z.a) * Math.sin(z.b));
  }

  /** Calculate hyperbolic arcsine of a number */
  static arcsinh(z) {
    // arcsinh(z) = ln[z + |1 + z^2|^0.5 * e^((i/2) * arg(1 + z^2))]
    z = Complex.assert(z);
    let opz2 = Complex.add(1, Complex.mult(z, z)); // 1 + z^2
    return Complex.log(Complex.add(z, Complex.mult(Complex.pow(Complex.abs(opz2), 0.5), Complex.exp(Complex.div(Complex.I(), 2).mult(opz2.arg())))));
  }

  /** Calculate arcsine of a complex number */
  static arcsin(z) {
    z = Complex.assert(z);

    let sqrt = new Complex(1 - Math.pow(z.a, 2) + Math.pow(z.b, 2), -2 * z.a * z.b).pow(0.5); // sqrt(1 - z^2)
    let ln = Complex.log(new Complex(-z.b + sqrt.a, z.a + sqrt.b)); // ln(iz + <sqrt>)
    let k = new Complex(0, -1); // -i
    return Complex.mult(k, ln); // <k> * <ln>
  }

  /** Calculate cosine of a complex number */
  static cos(z) {
    z = Complex.assert(z);
    return new Complex(Math.cos(z.a) * Math.cosh(z.b), -1 * Math.sin(z.a) * Math.sinh(z.b));
  }

  /** Calculate hyperbolic cosine of a complex number */
  static cosh(z) {
    // cosh(a + bi) = cosh(a)cos(b) + sinh(a)sin(b)i
    z = Complex.assert(z);
    return new Complex(Math.cosh(z.a) * Math.cos(z.b), Math.sinh(z.a) * Math.sin(z.b));
  }

  /** Calculate arccosine of a complex number */
  static arccos(z) {
    z = Complex.assert(z);
    let sqrt = new Complex(Math.pow(z.a, 2) - Math.pow(z.b, 2) - 1, 2 * z.a * z.b).pow(0.5); // sqrt(z^2 - 1)
    let ln = Complex.log(new Complex(z.a + sqrt.a, z.b + sqrt.b)); // ln(z + <sqrt>)
    let k = new Complex(0, -1); // -i
    return Complex.mult(k, ln); // <k> * <ln>
  }

  /** Calculate hyperbolic arccosine of a number
   * ! Output using (1+2i) differs slightly from both NumPy and Wolfram Alpha
  */
  static arccosh(z) {
    // arccosh(z) = ln[z + |z^2 - 1|^0.5 * e^((i/2) * arg(z^2 - 1))]
    z = Complex.assert(z);
    let z2mo = Complex.sub(Complex.mult(z, z), 1); // z^2 - 1
    return Complex.log(Complex.add(z, Complex.mult(Complex.pow(Complex.abs(z2mo), 0.5), Complex.exp(Complex.div(Complex.I(), 2).mult(z2mo.arg())))));
  }

  /** Calculate tangent of a complex number */
  static tan(z) {
    z = Complex.assert(z);
    return Complex.div(Complex.sin(z), Complex.cos(z));
  }

  /** Calculate hyperbolic tangent of a complex number */
  static tanh(z) {
    // tanh(a + bi) = [sinh(2a) + sin(2b)i] / [cosh(2a) + cos(2b)]
    z = Complex.assert(z);
    return Complex.add(Math.sinh(2 * z.a), new Complex(0, Math.sin(2 * z.b))).div(Math.cosh(2 * z.a) + Math.cos(2 * z.b));
  }

  /** Calculate arctangent of a complex number */
  static arctan(z) {
    // arctan(z) = 1/(2i) * ln[(1 + iz)/(1 - iz)]
    z = Complex.assert(z);
    const iz = Complex.mult(Complex.I(), z);
    return Complex.mult(Complex.div(1, new Complex(0, 2)), Complex.log(Complex.div(Complex.add(1, iz), Complex.sub(1, iz))));
  }

  /** Calculate hyperbolic arctangent of a number */
  static arctanh(z) {
    // arctanh(z) = (1/2)ln[(1+z)/(1-z)]
    z = Complex.assert(z);
    return Complex.mult(0.5, Complex.log(Complex.div(Complex.add(1, z), Complex.sub(1, z))));
  }

  /** Calculate log() of a complex number [natural log] */
  static log(z) {
    z = Complex.assert(z);
    return new Complex(Math.log(z.mag()), z.arg());
  }

  /** Is this not-a-number? */
  static isNaN(z) {
    z = Complex.assert(z);
    return isNaN(z.a) || isNaN(z.b);
  }

  /** Is this finite? */
  static isFinite(z) {
    z = Complex.assert(z);
    return isFinite(z.a) && isFinite(z.b);
  }

  /** Calculate Math.abs() of a complex number - magnitude */
  static abs(z) {
    z = Complex.assert(z);
    return z.mag();
  }

  /** square root */
  static sqrt(z) {
    z = Complex.assert(z);
    return Complex.pow(z, 1 / 2);
  }

  /** cube root */
  static cbrt(z) {
    z = Complex.assert(z);
    return Complex.pow(z, 1 / 3);
  }

  /** Return ceiling of a number */
  static ceil(z) {
    return _zapply(z, Math.ceil);
  }

  /** Return floor of a number */
  static floor(z) {
    return _zapply(z, Math.floor);
  }

  /** Return rounded value of z */
  static round(z) {
    return _zapply(z, Math.round);
  }

  /** Round to certain decimal place. <dp> is an integer */
  static roundDp(z, dp) {
    const K = Math.pow(10, dp);
    return new Complex(Math.round(z.a * K) / K, Math.round(z.b * K) / K);
  }

  /** Calculate Math.exp of a complex number */
  static exp(z) {
    // exp(a + bi) = e^a * [ cos(b) + isin(b) ]
    z = Complex.assert(z);
    const ea = Math.exp(z.a); // e ^ a
    return new Complex(ea * Math.cos(z.b), ea * Math.sin(z.b));
  }

  /** Generate complex number from polar representation */
  static fromPolar(r, θ) {
    return new Complex(r * Math.cos(θ), r * Math.sin(θ));
  }
}

/** What letter to use for the imaginary component? */
Complex.imagLetter = 'i';

Complex.I = () => new Complex(0, 1);
Complex.NaN = () => new Complex(NaN, NaN);

/** Make sure input is Complex. Return value, or error. */
Complex.assert = function (z) {
  if (z instanceof Complex) return z;
  if (typeof z === 'number' || typeof z === 'boolean') return new Complex(z, 0);
  if (typeof z === 'bigint') return new Complex(Number(z), 0);
  if (typeof z === 'string') {
    let parts = z.split(/(?=[\-\+])/).map(x => x.trim()).filter(x => x.length > 0);
    let complex;
    if (parts.length === 1) {
      complex = new Complex(+parts[0], 0);
    } else if (parts.length === 2 && parts[1].indexOf(Complex.imagLetter) !== -1) {
      let imag = parts[1].replace(Complex.imagLetter, '');
      if (imag === '-' || imag === '+') imag += '1';
      complex = new Complex(+parts[0], +imag);
    }
    if (complex && !Complex.isNaN(complex)) return complex;
  }
  throw new TypeError(`Expected Complex, got ${typeof z} ${z}`);
};

/** Is value a complex number? Return <false> or the complex number. */
Complex.is = function (value) {
  try {
    return Complex.assert(value);
  } catch (e) {
    return false;
  }
};

// Apply a function to a complex number
function _zapply(z, fn) {
  z = Complex.assert(z);
  z.a = fn(z.a);
  z.b = fn(z.b);
  return z;
}

module.exports = Complex;