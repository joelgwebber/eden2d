import { Container, Graphics } from "pixi.js";
import { Chunk, isChunk } from "./chunk";
import { ContainerPanel } from "./containerpanel";
import { Panel, PanelOwner } from "./eden";
import { Entity, isEntity } from "./entity";
import { Key } from "./key";
import { Dict, isDict } from "./script/dict";
import { _eval } from "./script/eval";
import { parse } from "./script/kurt";
import { $, $$, EExpr, nil } from "./script/script";
import { World } from "./world";

import worldpanel_kurt from "./worldpanel.kurt";

export class WorldPanel implements Panel {
  private _world: World;
  private _container: Container;
  private _chunk: Chunk;
  private _invChunk: Chunk;
  private _player: Entity;
  private _impl: Dict;

  constructor(private _owner: PanelOwner) {
    _eval(_owner.world, parse(worldpanel_kurt)); // TODO: Do this only once.

    this._world = this._owner.world;

    let chunk = this.createChunk();
    this._player = isEntity(this.eval($('player-make'), chunk));
    this._impl = isDict(_eval(_owner.world, [[$('WorldPanel'), $$('make')], this._player]));

    let bg = new Graphics();
    bg.beginFill(0, 0.5);
    bg.drawRect(0, 0, 16 * 10 * 4, 16 * 4);
    bg.endFill();

    this._container = new Container();
    this._container.addChild(bg);

    this._invChunk = this.eval([this._player, $$('player')], $$('contents')) as Chunk;
    this._container.addChild(this._invChunk.container);

    this.showChunk(chunk);
  }

  get container(): Container {
    return this._container;
  }

  private createChunk(): Chunk {
    let chunk0 = this._world.toyChunk();
    let chunk1 = this._world.toyChunk();
    this.eval([$('Stairs'), $$('make')], chunk0, 1, 5, chunk1, 0, 5, false);
    this.eval([$('Stairs'), $$('make')], chunk1, 1, 5, chunk0, 2, 5, true);
    this.eval([chunk0, $$('add')], [[$('Wand'), $$('make')]]);
    return chunk0;
  }

  tick(): void {
    // Follow the player across chunks.
    let chunk = this._player.chunk;
    if (chunk != this._chunk) {
      this.showChunk(chunk);
    }

    this._invChunk.render(0, 0, 4);

    let px = this._player.loc.x;
    let py = this._player.loc.y;
    let x = (px - 4) * 16;
    let y = (py - 4) * 16;
    this._chunk.render(x, y, 4);
  }

  keyDown(evt: KeyboardEvent) {
    switch (evt.keyCode) {
      case Key.UP:    case Key.W: this.call('move',  0, -1); break;
      case Key.DOWN:  case Key.S: this.call('move',  0,  1); break;
      case Key.LEFT:  case Key.A: this.call('move', -1,  0); break;
      case Key.RIGHT: case Key.D: this.call('move',  1,  0); break;

      case Key.ENTER: this.call('enter');        break;
      case Key.Q:     this.call('use-selected'); break;
      case Key.SPACE: this.call('take');         break;
      case Key.R:     this.call('put');          break;
      case Key.E:     this.openSelected();       break;

      case Key._1: case Key._2: case Key._3:
      case Key._4: case Key._5: case Key._6:
      case Key._7: case Key._8: case Key._9: this.call('select-inv', evt.keyCode - Key._1); break;
      case Key._0:                           this.call('select-inv', 9);                    break;
    }
  }

  private openSelected() {
    let chunk = isChunk(this.call('selected-container'));
    if (chunk) {
      this._owner.showPanel(new ContainerPanel(chunk, this._owner));
    }
  }

  private showChunk(chunk: Chunk) {
    if (this._chunk) {
      this._container.removeChild(this._chunk.container);
    }
    this._chunk = chunk;
    this._container.addChildAt(this._chunk.container, 0);
  }

  private call(blockName: string, ...expr: EExpr[]): EExpr {
    return _eval(this._owner.world, [[this._impl, $$(blockName)], ...expr]);
  }

  private eval(...expr: EExpr[]): EExpr {
    return _eval(this._world, expr);
  }
}
