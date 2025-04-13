import { DiscordSDK } from "@discord/embedded-app-sdk";
import { createGame } from "./src/game.js";

import rocketLogo from '/rocket.png';
import "./style.css";

// Will eventually store the authenticated user's access_token
let auth;

const discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);

setupDiscordSdk().then(() => {
  console.log("Discord SDK is authenticated");

  // Ensure DOM is ready before running createGame
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", () => {
      startGame();
    });
  } else {
    // DOM is already loaded
    startGame();
  }
});


async function startGame() {
  console.log("Starting game...");

  const container = document.getElementById("app");
  if (!container) {
    console.error("ERROR: #app container not found in DOM.");
    return;
  }

  container.innerHTML = "";
  await createGame(container, discordSdk, auth); // must await because Pixi v8 init is async
}


async function setupDiscordSdk() {
  await discordSdk.ready();
  console.log("Discord SDK is ready");

  // Authorize with Discord Client
  const { code } = await discordSdk.commands.authorize({
    client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: [
      "identify",
      "guilds",
      "applications.commands"
    ],
  });

  // Retrieve an access_token from your activity's server
  // Note: We need to prefix our backend `/api/token` route with `/.proxy` to stay compliant with the CSP.
  // Read more about constructing a full URL and using external resources at
  // https://discord.com/developers/docs/activities/development-guides#construct-a-full-url
  const response = await fetch("/.proxy/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
    }),
  });
  const { access_token } = await response.json();

  // Authenticate with Discord client (using the access_token)
  auth = await discordSdk.commands.authenticate({
    access_token,
  });

  if (auth == null) {
    throw new Error("Authenticate command failed");
  }
}
