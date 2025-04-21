import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

export class Tower extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") level: number = 0;
  @type("string") owner: string = "";
}

export class Player extends Schema {
  @type("number") gold: number = 100;
}

export class State extends Schema {
  @type({ map: Player }) players: MapSchema<Player> = new MapSchema<Player>();
  @type([ Tower ]) towers: ArraySchema<Tower> = new ArraySchema<Tower>();  
}
