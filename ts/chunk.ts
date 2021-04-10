import { Container } from "pixi.js";
import { Entity, locEnt } from "./entity";
import { _eval } from "./script/eval";
import { IDict, Dict, dictParent, dictRef, isDict, _root, isTagProp } from "./script/dict";
import { $, chuck, EDict, EExpr, ESym, nil, symName, _, _blk, _def, _self, _set } from "./script/script";
import { World } from "./world";
import { locNum, locSym, envEval } from "./script/env";
import { _parse } from "./script/parse";
import { registerDefroster } from "./script/freezer";

export type ChunkId = number;

// TODO:
// - Lazy-init containers (and thus the underlying entity sprites), because most will be invisible most of the time.
// - Implement efficient collision detection.
// - Create efficient entity filters by component query.
export class Chunk implements IDict {
  static Dict = {
    'add': [$('ent'), _blk, (env: Dict) => {
      let ent = locEnt(env, $('ent'));
      locChunk(env, _self).addEntity(ent);
      return ent;
    }],

    'add-at': _parse('Chunk:add-at', `(ent x y | [@:add ent]:move-to x y)`),

    'remove': [$('ent'), _blk, (env: Dict) => {
      let ent = locEnt(env, $('ent'));
      locChunk(env, _self).removeEntity(ent);
      return ent;
    }],

    'entities-at': [$('x'), $('y'), _blk, (env: Dict) => {
      return locChunk(env, _self).entitiesAt(
        locNum(env, $('x')),
        locNum(env, $('y'))
      );
    }],

    'top-at': [$('x'), $('y'), _blk, (env: Dict) => {
      return locChunk(env, _self).topEntity(
        locNum(env, $('x')),
        locNum(env, $('y')),
      );
    }],

    'top-with': [$('x'), $('y'), $('comp'), _blk, (env: Dict) => {
      return locChunk(env, _self).topEntityWith(
        locNum(env, $('x')),
        locNum(env, $('y')),
        locSym(env, $('comp'))
      );
    }],

    'near-with': [$('x'), $('y'), $('comp'), _blk, (env: Dict) => {
      return locChunk(env, _self).nearEntityWith(
        locNum(env, $('x')),
        locNum(env, $('y')),
        locSym(env, $('comp'))
      );
    }],

    'perform': [$('action'), _blk, _parse('Chunk:perform', `(action | do
      -- Let each entity prepare the action (possibly mutating it),
      -- then perform it once all of them have had a crack.
      -- TODO: Give the chunk a crack at it.
      [for-each action:ents (ent | ent:prepare action)]
      [for-each action:ents (ent | ent:perform action)]
    )`)],
  };

  private _entities: { [id: number]: Entity } = {};
  private _nextId = 1;
  private _container: Container;
  private _defs: EDict;
  private _millis = 0;
  private _lastTickMillis = 0;

  constructor(private _world: World, private _id: number) {
    this._container = new Container();
    _eval(_root, [_set, this, {'^': $('Chunk')}]);
  }

  defrost(entities: {[id: number]: Entity}, nextId: number, defs: EDict) {
    this._entities = entities;
    this._nextId = nextId;
    this._defs = defs;
    this.container.removeChildren();
    this._millis = this._lastTickMillis = 0;
  }

  get world(): World { return this._world }
  get id(): number { return this._id }
  get container(): Container { return this._container }

  get names(): string[] { return this._defs ? Object.keys(this._defs) : [] }
  exists(sym: ESym): boolean { return symName(sym) in this._defs }
  ref(name: ESym): EExpr { return this._defs && this._defs[symName(name)] }
  def(name: ESym, value: EExpr): void { (this._defs || (this._defs = {}))[symName(name)] = value }

  entitiesAt(x: number, y: number): Entity[] {
    // TODO: Do some indexing to not make this obscenely slow.
    let ents: Entity[] = [];
    this.forEachEnt((id, ent) => {
      let loc = ent.loc;
      if (loc) {
        if (loc.x == x && loc.y == y) {
          ents.push(ent);
        }
      }
    });
    return ents;
  }

  entitiesWith(x: number, y: number, comp: ESym): Entity[] {
    return this.entitiesAt(x, y).filter((ent) => ent.hasComp(comp) ? ent : nil);
  }

  // Finds the top-most entity at an exact location.
  topEntity(x: number, y: number): Entity {
    let ents = this.entitiesAt(x, y);
    if (ents.length == 0) {
      return nil;
    }
    return ents[ents.length - 1];
  }

  // Finds the top-most entity at an exact location, with the given component.
  topEntityWith(x: number, y: number, comp: ESym): Entity {
    let ents = this.entitiesAt(x, y);
    for (let i = ents.length-1; i >= 0; i--) {
      let ent = ents[i];
      if (ent.ref(comp) !== nil) {
        return ent;
      }
    }
    return nil;
  }

  // Finds the top-most entity near a location (within one unit), with the given component.
  nearEntityWith(x: number, y: number, comp: ESym): Entity {
    let deltas = [[0, 0], [-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
    for (let delta of deltas) {
      let ent = this.topEntityWith(x + delta[0], y + delta[1], comp);
      if (ent) {
        return ent;
      }
    }
    return nil;
  }

  addEntity(entity: Entity) {
    if (entity.chunk) {
      if (entity.chunk == this) {
        return;
      }
      entity.chunk.removeEntity(entity);
    }

    let idx = this._nextId++;
    entity.setChunkAndId(this, idx);
    this._entities[idx] = entity;
    if (entity.rendered) {
      this._container.addChild(entity.rendered.sprite);
    }
  }

  removeEntity(entity: Entity) {
    if (entity.chunk != this) {
      return;
    }

    delete this._entities[entity.id];
    entity.setChunkAndId(null, 0);
    if (entity.rendered) {
      this._container.removeChild(entity.rendered.sprite);
    }
  }

  tick(deltaMillis: number) {
    // Ticker handling.
    // TODO: Simple 4Hz for now; use ticker freq.
    let tickMillis = 250;
    this._millis += deltaMillis;
    let ticks = Math.floor((this._millis - this._lastTickMillis) / tickMillis);
    this._lastTickMillis += ticks * tickMillis;

    this.forEachEnt((id, ent) => {
      // Movement & collision.
      let loc = ent.loc;
      if (loc && (loc.dx != 0 || loc.dy != 0)) {
        let nx = loc.x + loc.dx, ny = loc.y + loc.dy;
        let ent = this.topEntityWith(nx, ny, $('solid'));
        if (ent !== nil) {
          let solid = ent.ref($('solid')) as Dict;
          if (dictRef(solid, $('solid'))) {
            return;
          }
        }
        loc.x = nx; loc.y = ny;
        loc.dx = 0; loc.dy = 0;
      }

      // Ticks.
      for (let i = 0; i < ticks; i++) {
        let ticker = isDict(ent.ref($('ticker')));
        if (ticker !== nil) {
          let block = dictRef(ticker, $('block'));
          _eval(this, [block, ent]);
        }
      }
    });
  }

  render(x: number, y: number, z: number) {
    this._container.setTransform(-x * z, -y * z, z, z);

    // TODO: Create a nicer way to build systems with component queries.
    // TODO: Add some kind of component dirty tracking to avoid running through them all?
    this.forEachEnt((id, ent) => {
      let loc = ent.loc;
      let render = ent.rendered;
      if (loc && render) {
        render.sprite.position.x = loc.x * 16;
        render.sprite.position.y = loc.y * 16;
      }
    });
  }

  private forEachEnt(fn: (id: number, ent: Entity) => void) {
    for (let id in this._entities) {
      if (isTagProp(id)) {
        // _entities can get gummed up with tag properties because of [freeze].
        continue;
      }
      fn(parseInt(id), this._entities[id]);
    }
  }

  native(): any {
    return {
      native: 'Chunk',
      entities: this._entities,
      nextId: this._nextId,
      defs: this._defs,
    }
  }
}

export function isChunk(expr: EExpr): Chunk {
  let env = isDict(expr);
  while (env) {
    if (env instanceof Chunk) {
      return expr as Chunk;
    }
    env = dictParent(env);
  }
  return undefined;
}

export function locChunk(env: Dict, sym: ESym): Chunk {
  let chunk = isChunk(envEval(env, sym));
  if (chunk === undefined) {
    chuck(env, `${name}: ${dictRef(env, sym)} is not a chunk`);
  }
  return chunk as Chunk;
}

registerDefroster('Chunk', (obj) => {
  var chunk = new Chunk(World.inst, obj.id);
  chunk.defrost(obj.entities, obj.nextId, obj.defs);
  return chunk;
});
