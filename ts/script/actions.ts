import { entChunk, EntityId, Var } from "../entity";
import { World } from "../world";
import { builtins } from "./builtins";
import { EArgs, ECall, EDef, EExpr, EGet, EImpl, ELet, ELoc, ENative, ESet, Frame, KDef, KGet, KLet, KNative, KSet } from "./script";

export class Actions {
  private _defs: { [name: string]: EDef[] } = {};

  constructor(private _world: World) {
    for (let def of builtins) {
      this.def(def);
    }
  }

  eval(expr: EExpr, stack: Frame[] = []): any {
    switch (typeof expr) {
      case 'number':
      case 'string':
      case 'boolean':
        return expr;

      case 'object':
        if (expr.constructor == Array) {
          if (typeof expr[0] != "string") {
            return undefined;
          }
          switch (expr[0]) {
            case KDef: return this.def(expr as EDef);
            case KLet: return this.let(expr as ELet, stack);
            case KSet: return this.set(expr as ESet, stack);
            case KGet: return this.get(expr as EGet, stack);
            default:
              if (expr.length == 1) {
                return this.loc(expr, stack);
              } else {
                return this.call(expr as ECall, stack);
              }
          }
        }
        return undefined;
    }
  }

  private let(l: ELet, stack: Frame[]): any {
    let args: EArgs = l[1];
    let body: EExpr[] = l[2];

    // Eval all args first.
    let frame: Frame = {};
    for (let name in args) {
      frame[name] = this.eval(args[name], stack);
    }

    for (let expr of body) {
      this.eval(expr, stack.concat(frame));
    }
  }

  private loc(l: ELoc, stack: Frame[]): any {
    let name: string = l[0];
    for (let parent of stack) {
      if (name in parent) {
        return parent[name];
      }
    }
    return undefined;
  }

  get(g: EGet, stack: Frame[]): any {
    let entId = this.eval(g[1], stack) as EntityId;
    let name = g[2];
    let chunkId = entChunk(entId);
    let chunk = this._world.chunk(chunkId);
    let ent = chunk.entity(entId);
    return ent.getVar(name as Var);
  }

  set(s: ESet, stack: Frame[]): void {
    let entId = this.eval(s[1], stack) as EntityId;
    let name = s[2];
    let value = this.eval(s[3], stack);
    let chunkId = entChunk(entId);
    let chunk = this._world.chunk(chunkId);
    let ent = chunk.entity(entId);
    ent.setVar(name as Var, value);
  }

  private def(def: EDef): any {
    let name = def[1];
    if (!(name in this._defs)) {
      this._defs[name] = [];
    }
    // TODO: validate def syntax.
    this._defs[name].push(def);
  }

  private call(call: ECall, stack: Frame[]): any {
    let name = call[0];
    let args = call[1];

    // Eval all args eagerly.
    let frame: Frame = {};
    for (let name in args) {
      frame[name] = this.eval(args[name], stack);
    }

    // Find all matching procedures and execute them.
    let last: any = undefined;
    if (name in this._defs) {
      let defs = this._defs[name];
      outer:
      for (let def of defs) {
        let sig = def[2];
        for (let arg of sig) {
          if (!(arg in frame)) {
            // Missing arg; skip this def.
            continue outer;
          }
        }
        let impl = def[3];
        last = this.exec(impl, frame, stack);
      }
    }

    // TODO: Ew, gross. Language design issue -- what to return when multiple defs match?
    return last;
  }

  private exec(impl: EImpl, frame: Frame, stack: Frame[]): any {
    switch (impl[0]) {
      case KNative: {
        // Call native impl.
        let native = impl as ENative;
        let fn = native[1] as (world: World, frame: Frame) => any;
        return fn(this._world, frame);
      }

      default: {
        // Evaluate body.
        let body = impl as EExpr[];
        let last: any;
        for (let expr of body) {
          last = this.eval(expr, stack.concat(frame));
        }
        return last;
      }
    }
  }
}
