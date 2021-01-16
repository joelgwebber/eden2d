import { Chunk, locChunk } from "./chunk";
import { Loc } from "./loc";
import { Render } from "./render";
import { parse } from "./script/kurt";
import { IScope, isScope, locNum, Scope, scopeParent, scopeRef, _root, scopeEval, lookupSym } from "./script/scope";
import { $, $$, chuck, EDict, EExpr, ESym, nil, symName, _, _blk, _def, _parent, _set } from "./script/script";

export let EntityClass = [_def, $$('Entity'), {
  'jump': [$('chunk'), _blk, (scope: Scope) => {
    let self = locEnt(scope, $('@'));
    let to = locChunk(scope, $('chunk'));
    to.addEntity(self);
    return self;
  }],

  'move-to': parse(`[x y | do
    [def :loc [@:loc]]
    [set loc:x x]
    [set loc:y y]
  ]`),

  'top-with': parse(`[comp | do
    [def :loc [@:loc]]
    [[[@:chunk]:top-with] [loc:x] [loc:y] comp]
  ]`),
}];

export class Entity implements IScope {
  private _chunk: Chunk;
  private _id: number;
  private _comps: EDict = {};
  private _parent: EExpr;

  constructor(scope: Scope) {
    this._parent = lookupSym(scope, $('Entity'));
  }

  get id(): number { return this._id }
  get chunk(): Chunk { return this._chunk }
  get names(): string[] { return ['id', 'chunk', 'parent']; }

  def(sym: ESym, value: EExpr): void {
    let name = symName(sym);
    switch (name) {
      case 'chunk':
      case 'id':
      case 'parent':
        // TODO: Pass scope to def/ref?
        chuck(_root, `can't set ${symName(sym)} on Entity`);
    }
    this._comps[name] = value;
  }

  ref(sym: ESym): EExpr {
    let name = symName(sym);
    switch (name) {
      case 'chunk': return this._chunk;
      case 'id': return this._id;
      case 'parent': return this._parent;
    }
    return this._comps[name];
  }

  hasComp(key: ESym): boolean { return symName(key) in this._comps; }

  // Accessors for common component types.
  loc(): Loc { return this.ref($('loc')) as Loc }
  render(): Render { return this.ref($('render')) as Render }

  setChunkAndId(chunk: Chunk, id: number) {
    this._chunk = chunk;
    this._id = id;
  }
}

// Convenience scope implementation for simple components.
// TODO: add type checking and read-only semantics?
export class NativeComp implements IScope {

  get names(): string[] {
    return Object.getOwnPropertyNames(this);
  }

  ref(sym: ESym): EExpr {
    let name = symName(sym);
    if (this.hasOwnProperty(name)) {
      return (this as any)[name];
    }
    return nil;
  }

  def(sym: ESym, value: EExpr): void {
    let name = symName(sym);
    if (this.hasOwnProperty(name)) {
      (this as any)[name] = value;
      return;
    }
    chuck(_root, `unknown property ${name}`);
  }
}

export function isEntity(expr: EExpr): Entity {
  let scope = isScope(expr);
  while (scope) {
    if (scope instanceof Entity) {
      return expr as Entity;
    }
    scope = scopeParent(scope);
  }
  return undefined;
}

export function locEnt(scope: Scope, sym: ESym): Entity {
  let ent = isEntity(scopeEval(scope, sym));
  if (ent === undefined) {
    chuck(scope, `${name}: ${scopeRef(scope, sym)} is not an entity`);
  }
  return ent as Entity;
}
