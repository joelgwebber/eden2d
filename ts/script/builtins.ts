import { chuck, EExpr, EVal, _native, Scope, _self, _set, _ } from "./script";
import { Chunk, isChunk } from "../chunk";
import { Entity, EntityType, isEntity } from "../entity";
import { World } from "../world";

export const _add = _('+');
export const _newChunk = _('newChunk');
export const _new = _('new');
export const _move = _('move');
export const _jump = _('jump');
export const _topWith = _('topWith');

export const builtins: EExpr[] = [
  [_set, _self, '+', [_native, ['x', 'y'],
    function (scope: Scope): EVal {
      return locNum(scope, 'x') + locNum(scope, 'y');
    }
  ]],

  [_set, _self, 'newChunk', [_native, [],
    function (scope: Scope): EVal {
      return worldFrom(scope).newChunk();
    }
  ]],

  [_set, _self, 'new', [_native, ['chunk', 'type'],
    function (scope: Scope): EVal {
      let chunk = locChunk(scope, 'chunk');
      let ent = new Entity(locStr(scope, 'type') as EntityType);
      chunk.addEntity(ent);
      return ent;
    }
  ]],

  [_set, _self, 'move', [_native, ['ent', 'x', 'y'],
    function (scope: Scope): EVal {
      let x = locNum(scope, 'x');
      let y = locNum(scope, 'y');
      let ent = locEnt(scope, 'ent');
      ent.move(x, y);
      return undefined;
    }
  ]],

  [_set, _self, 'jump', [_native, ['ent', 'chunk'],
    function (scope: Scope): EVal {
      let ent = locEnt(scope, 'ent');
      let to = locChunk(scope, 'chunk');
      to.addEntity(ent);
      return ent;
    }
  ]],

  [_set, _self, 'topWith', [_native, ['chunk', 'x', 'y', 'var'],
    function (scope: Scope): EVal {
      let chunk = locChunk(scope, 'chunk');
      let x = locNum(scope, 'x');
      let y = locNum(scope, 'y');
      let v = locStr(scope, 'var');
      let ents = chunk.entitiesAt(x, y);
      for (var ent of ents) {
        if (ent.ref(v) !== undefined) {
          return ent;
        }
      }
      return undefined;
    }
  ]],
];

function worldFrom(scope: Scope): World {
  let cur = scope;
  while (cur) {
    if (cur instanceof World) {
      return cur;
    }
    cur = cur.parent;
  }
  chuck(scope, "missing world scope");
}

function locNum(scope: Scope, name: string): number {
  let value = scope.ref(name) as number;
  if (typeof value != "number") {
    chuck(scope, `${name}: ${value} is not a number`);
  }
  return value;
}

function locStr(scope: Scope, name: string): string {
  let value = scope.ref(name) as string;
  if (typeof value != "string") {
    chuck(scope, `${name}: ${value} is not a string`);
  }
  return value;
}

function locChunk(scope: Scope, name: string): Chunk {
  let chunk = isChunk(scope.ref(name));
  if (chunk === undefined) {
    chuck(scope, `${name} is not a chunk`);
  }
  return chunk as Chunk;
}

function locEnt(scope: Scope, name: string): Entity {
  let ent = isEntity(scope.ref(name));
  if (ent === undefined) {
    chuck(scope, `${name} is not an entity`);
  }
  return ent as Entity;
}
