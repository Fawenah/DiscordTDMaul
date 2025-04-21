import express from "express";
import { createServer } from "http";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { MyGameRoom } from "./rooms/MyGameRoom.js"; // ✅ correct import

const app = express();
const server = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server }),
});

// ✅ Define room using the correct class name
gameServer.define("my_game_room", MyGameRoom);

gameServer.listen(2567).then(() => {
  console.log("Colyseus server is listening on ws://localhost:2567");
});
