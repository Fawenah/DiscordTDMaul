import express from "express";
import { createServer } from "http";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { MyGameRoom } from "./rooms/MyGameRoom.js"; // Ensure you have this room defined
import { ROOM_NAME } from "../shared/constants.js";

const app = express();
const server = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server }),
});

// Define your room handlers
gameServer.define(ROOM_NAME, MyGameRoom);

// Start the server
gameServer.listen(2567).then(() => {
  console.log("Colyseus server is listening on ws://localhost:2567");
});
