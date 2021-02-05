import { _apply, _eval } from "./eval";
import { _print } from "./print";
import { Dict, dictFind, dictNames, dictRef, isDict, _root } from "./dict";
import { chuck, $, isList, _blk, _, isBlock, _def, _do, nil, eq, isSym, EExpr, _callerTagName, _callerTag } from "./script";
import { envNew, expectBool, expectNum, locBool, locList, locNum } from "./env";
import { parse } from "./kurt";

export const _debug = $('debug');
export const _and = $('and');
export const _if = $('if');
export const _forEach = $('for-each');
export const _log = $('log');
export const _add = $('+');
export const _mul = $('*');
export const _gt = $('>');
export const _lt = $('<');
export const _gte = $('>=');
export const _lte = $('<=');
export const _eq = $('=');
export const _not = $('!');
export const __eval = $('eval');
export const _list = $('list');

export let builtinDefs = [_def, {
  'debug': [_blk, (env: Dict) => {
    debugger;
    return nil;
  }],

  'eval': [$('expr'), _blk, (env: Dict) => {
    return _eval(env, dictRef(env, $('expr')));
  }],

  'list': [$('...elems'), _blk, (env: Dict) => {
    return locList(env, $('elems'));
  }],

  'and': [$('...vals'), _blk, (env: Dict) => {
    let vals = locList(env, $('vals'));
    for (let val of vals) {
      if (!expectBool(env, _eval(env, [{}, val]))) {
        return false;
      }
    }
    return true;
  }],

  'or': [$('...vals'), _blk, (env: Dict) => {
    let vals = locList(env, $('vals'));
    for (let val of vals) {
      if (expectBool(env, _eval(env, [{}, val]))) {
        return true;
      }
    }
    return false;
  }],

  'if': [$('expr'), $('then'), $('else'), _blk, (env: Dict) => {
    // if:
    let b = dictRef(env, $('expr'));
    if (typeof b != 'boolean') {
      chuck(env, `${b} must be boolean`);
    }

    if (b) {
      // then:
      let then = dictRef(env, $('then'));
      return _eval(env, [{}, then]);
    } else {
      // else:
      let els = dictRef(env, $('else'));
      if (els !== nil) {
        return _eval(env, [{}, els]);
      }
    }
    return nil;
  }],

  'for-each': [$('list'), $('expr'), _blk, (env: Dict) => {
    let list = isList(dictRef(env, $('list')));
    let expr = dictRef(env, $('expr'))
    for (let item of list) {
      _eval(env, [expr, _(item)]);
    }
    return nil;
  }],

  'for-each-entry': [$('dict'), $('expr'), _blk, (env: Dict) => {
    let dict = isDict(dictRef(env, $('dict')));
    let expr = dictRef(env, $('expr'))
    for (let name of dictNames(dict)) {
      let sym = $(name);
      _eval(env, [expr, _(sym), _(dictRef(dict, sym))]);
    }
    return nil;
  }],

  'log': [$('...msgs'), _blk, (env: Dict) => {
    let msgs = locList(env, $('msgs'));
    let pmsgs: string[] = [];
    for (let msg of msgs) {
      pmsgs.push(_print(msg));
    }
    console.log(...pmsgs);
    return nil;
  }],

  '+': [$('...vals'), _blk, (env: Dict) => {
    let vals = locList(env, $('vals'));
    let result = 0;
    for (let val of vals) {
      result += expectNum(env, val);
    }
    return result;
  }],

  '*': [$('...vals'), _blk, (env: Dict) => {
    let vals = locList(env, $('vals'));
    let result = 1;
    for (let val of vals) {
      result *= expectNum(env, val);
    }
    return result;
  }],

  '>': [$('x'), $('y'), _blk, (env: Dict) => {
    return locNum(env, $('x')) > locNum(env, $('y'));
  }],

  '<': [$('x'), $('y'), _blk, (env: Dict) => {
    return locNum(env, $('x')) < locNum(env, $('y'));
  }],

  '>=': [$('x'), $('y'), _blk, (env: Dict) => {
    return locNum(env, $('x')) >= locNum(env, $('y'));
  }],

  '<=': [$('x'), $('y'), _blk, (env: Dict) => {
    return locNum(env, $('x')) <= locNum(env, $('y'));
  }],

  '=': [$('a'), $('b'), _blk, (env: Dict) => {
    return eq(dictRef(env, $('a')), dictRef(env, $('b')));
  }],

  '!=': parse(`[a b | ![= a b]]`),

  '!': [$('x'), _blk, (env: Dict) => {
    return !locBool(env, $('x'));
  }],

  '?=': [$('...exprs'), _blk, (env: Dict) => {
    let exprs = locList(env, $('exprs'));
    let val: EExpr = nil;
    let cur = isDict(dictRef(env, _callerTag));
    for (let expr of exprs) {
      if (cur === nil) {
        return nil;
      }

      // :sym -- find in the current scope.
      let sym = isSym(expr);
      if (sym !== nil) {
        let target = dictFind(cur, sym);
        if (target == nil) {
          return nil;
        }
        val = dictRef(target, sym);
        cur = isDict(val);
        continue;
      }

      // {dict} -- becomes both val and current env.
      let dict = isDict(expr);
      if (dict) {
        val = cur = dict;
        continue;
      }

      // [| block]
      let block = isBlock(expr);
      if (block !== nil) {
        // Eval block in the current env, so that the block can reference
        // the result of the last expression as 'env'.
        val = _eval(env, [cur, expr]);
        cur = isDict(val);
        continue;
      }

      // TODO: list?

      // Other values
      cur = nil;
      val = expr;
    }
    return val;
  }],
}];
