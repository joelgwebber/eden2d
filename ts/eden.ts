import { Application } from "pixi.js";
import { Chunk } from "./chunk";
import { Entity, EntityType, Var } from "./entity";
import { Key } from "./key";
import { newPlayer } from "./player";
import { Resources } from "./res";
import { World } from "./world";

class Eden {
  private _app: Application;
  private _world: World;
  private _chunk: Chunk;
  private _player: Entity;

  constructor() {
    this._app = new Application({ backgroundColor: 0x1099bb });
    this._app.resizeTo = window;

    document.body.appendChild(this._app.view);
    document.addEventListener('keydown', (evt) => this.keyDown(evt), true);

    Resources.load(() => this.ready());
  }

  private ready() {
    this._world = new World();

    let chunk = this.createChunk();
    this._player = this.createPlayer(chunk);
    this.showChunk(chunk);

    let invChunkId = this._chunk.eval(['get', this._player.id, Var.Contents]);
    let invChunk = this._world.chunk(invChunkId);
    this._app.stage.addChild(invChunk.container);

    this._app.stage.interactive = true;
    this._app.ticker.add(() => this.tick())
    this._app.start();
  }

  private createChunk(): Chunk {
    let chunk0 = this._world.toyChunk();
    let chunk1 = this._world.toyChunk();

    chunk0.eval(['portal', { type: [EntityType.StairDown], from: chunk0.id, fx: 1, fy: 5, to: chunk1.id, tx: 0, ty: 5 }]);
    chunk1.eval(['portal', { type: [EntityType.StairUp], from: chunk1.id, fx: 1, fy: 5, to: chunk0.id, tx: 2, ty: 5 }]);

    chunk1.eval(['def', 'foo', ['func', [], ['new', { chunk: chunk1.id, type: [EntityType.ObjectCrate] }]]]);
    return chunk0;
  }

  private createPlayer(chunk: Chunk): Entity {
    let playerId = newPlayer(this._world, chunk.id);
    return chunk.entity(playerId);
  }

  private showChunk(chunk: Chunk) {
    if (this._chunk) {
      this._app.stage.removeChild(this._chunk.container);
    }
    this._chunk = chunk;
    this._app.stage.addChild(this._chunk.container);
  }

  private keyDown(evt: KeyboardEvent) {
    switch (evt.keyCode) {
      // Move.
      case Key.UP: case Key.W: this.move(0, -1); break;
      case Key.DOWN: case Key.S: this.move(0, 1); break;
      case Key.LEFT: case Key.A: this.move(-1, 0); break;
      case Key.RIGHT: case Key.D: this.move(1, 0); break;

      // Go.
      case Key.G: this._chunk.eval(['player:follow', { player: this._player.id }]); break;

      // Create.
      case Key.C: this._chunk.eval(['player:create', { player: this._player.id, type: [EntityType.ObjectKey] }]); break;

      // Take, put.
      case Key.T: this._chunk.eval(['player:take', { player: this._player.id }]); break;
      case Key.P: this._chunk.eval(['player:put', { player: this._player.id }]); break;

      // Selection.
      case Key._1: case Key._2: case Key._3: case Key._4:
      case Key._5: case Key._6: case Key._7: case Key._8: case Key._9:
        this.select(evt.keyCode - Key._1)
        break;
      case Key._0:
        this.select(9);
        break;

      case Key.Q:
        this._chunk.eval(['foo', {}]);
        break;
    }
  }

  private move(dx: number, dy: number) {
    this._chunk.eval(['player:move', { player: this._player.id, dx: dx, dy: dy }]);
  }

  private select(slot: number) {
    this._chunk.eval(['player:select', { player: this._player.id, slot: slot }]);
  }

  private tick() {
    // Follow the player across chunks.
    if (this._player.chunk != this._chunk) {
      this.showChunk(this._player.chunk);
    }

    let w = this._app.view.width;
    let h = this._app.view.height;

    let invId = this._player.getVar(Var.Contents);
    this._world.chunk(invId).container.setTransform(0, h - 64, 4, 4);

    let x = (this._player.x - 4) * 16;
    let y = (this._player.y - 4) * 16;
    this._chunk.tick(x, y, 4, w, h);
  }
}

new Eden();
