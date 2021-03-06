import { _ns } from "../script/dict";

import crate from "./crate.kurt";
import wand from "./wand.kurt";
import chest from "./chest.kurt";
import brazier from "./brazier.kurt";
import key from "./key.kurt";
import torch from "./torch.kurt";

export function nsItems() {
  _ns('Items', [`[def {
      Located:    Comps:Located
      Rendered:   Comps:Rendered
      Portable:   Comps:Portable
      Programmed: Comps:Programmed
      Usable:     Comps:Usable
      Contains:   Comps:Contains
      Solid:      Comps:Solid
      Ticks:      Comps:Ticks
      Animated:   Comps:Animated
      Flaming:    Comps:Flaming
    }]`,
    crate, wand, chest, brazier, key, torch]
  );
}
