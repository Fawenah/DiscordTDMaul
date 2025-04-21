import { Room } from "colyseus";
import { State, Tower, Player } from "../schema/State.js";

export class MyGameRoom extends Room<State> {
  onCreate(options) {
    this.state(new State());

    this.onMessage("place_tower", (client, data) => {
      const tower = new Tower();
      tower.x = data.x;
      tower.y = data.y;
      tower.level = data.level;
      tower.owner = client.sessionId;

      this.state.towers.push(tower);
    });

    this.onMessage("upgrade_tower", (client, data) => {
      const tower = this.state.towers.find(t => t.x === data.x && t.y === data.y);
      if (tower && tower.owner === client.sessionId) {
        tower.level += 1;
      }
    });

    this.onMessage("monster_killed", (client, data) => {
      const player = this.state.players[client.sessionId];
      if (player) player.gold += data.gold || 1;
    });

    this.onMessage("tower_sold", (client, data) => {
      this.broadcast("tower_sold", data); // data = { x, y, owner }
    });
    
  }

  onJoin(client) {
    console.log(`${client.sessionId} joined`);
    const player = new Player();
    this.state.players[client.sessionId] = player;
  }

  onLeave(client) {
    console.log(`${client.sessionId} left`);
    delete this.state.players[client.sessionId];
  }
}
