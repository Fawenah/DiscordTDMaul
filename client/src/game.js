import { Application, Graphics, Text, TextStyle, Container } from 'pixi.js';
import { maps } from './mapData.js';
import { Monster } from './Monster.js';
import { Projectile } from './Projectile.js';

const originalMap = maps.waves;

// ===== Constants ===== 
const HUD_HEIGHT = 40;

const TILE_SIZE = 40;
// Get the map size from the original map
const MAP_WIDTH = originalMap[0].length;
const MAP_HEIGHT = originalMap.length;

const SPAWN_TIME = 500; // in ms

const TILE_GROUND = 0;
const TILE_BLOCK = 1;
const TILE_TOWER = 2;
const TILE_PATH = 9;
const TILE_SPAWN = 8;
const TILE_GOAL = 7;

const START_GOLD = 200;
const START_LIVES = 10;
const START_TOWER_LEVEL = 1;
const TOWER_COST = 5;
const UPGRADE_COST_SCALE = 5; // Cost increase per level

const ATTACKSPEED_DEFAULT = 250;
const PROJECTILE_SPEED = 3;

const players = new Map(); // Store player data
let localPlayerId = null; // Keep track of the local player ID

// ===== External Functions =====

// Creates a new game instance and initializes the Pixi application
export async function createGame(container, sdk, auth) {
    
    console.log("Known players after init:", [...players.keys()]);
    const app = new Application();
    let lives = START_LIVES;
    let gameOver = false;
    let gold = START_GOLD;
    const towers = [];
    const projectiles = [];
    
    function handleGameOver(app, container) {
        gameOver = true;
        
        const gameOverText = new Text('Game Over', {
            fill: '#ffffff',
            fontSize: 48,
            fontWeight: 'bold',
        });
        
        gameOverText.x = app.screen.width / 2 - gameOverText.width / 2;
        gameOverText.y = app.screen.height / 2 - gameOverText.height / 2;
        
        app.stage.addChild(gameOverText);
        
        setTimeout(() => {
            container.innerHTML = '';
            createGame(container, sdk, auth); // restart the game
        }, 3000);
    }
    
    function getTowerAt(x, y) {
        return towers.find(t => t.x === x && t.y === y);
    }
    
    
    function upgradeTower(app, tower, player) {
        if (tower.ownerId !== player.id) {
            console.warn("You can only upgrade your own towers!");
            return;
        }
        
        const newLevel = tower.level + 1;
        const upgradeCost = TOWER_COST + tower.level * UPGRADE_COST_SCALE;
        
        if (player.gold < upgradeCost) {
            console.log(`Not enough gold to upgrade. Needed: ${upgradeCost}`);
            return;
        }
        
        player.gold -= upgradeCost;
        updatePlayerGoldText(player.id);
        
        tower.level = newLevel;
        
        // Apply new stats
        const { damage, attackSpeed, range } = getTowerStatsForLevel(newLevel);
        tower.damage = damage;
        tower.attackSpeed = attackSpeed;
        tower.range = range;
        
        // Update graphics
        tower.gfx.destroy();
        tower.gfx = drawTowerGraphic(app, tower.x, tower.y, newLevel);
        tower.container.addChildAt(tower.gfx, 0); // Below overlay
        
        // Recalculate center
        const cx = tower.x * TILE_SIZE + TILE_SIZE / 2;
        const cy = tower.y * TILE_SIZE + TILE_SIZE / 2 + HUD_HEIGHT;
        
        // Update range circle
        tower.rangeCircle.clear();
        tower.rangeCircle
        .circle(cx, cy, range)
        .stroke({ width: 1, color: 0xffffff, alpha: 0.15 });
        
        app.stage.addChild(tower.overlay); // Bring overlay to front
        setupTowerHover(tower);
        
        console.log(`Tower at (${tower.x}, ${tower.y}) upgraded to level ${newLevel}`);
    }
    
    
    
    function handleTowerPlacement(app, tileX, tileY, userId) {
        const player = players.get(userId);
        if (!player) return;
        if (
            tileX < 0 || tileX >= MAP_WIDTH ||
            tileY < 0 || tileY >= MAP_HEIGHT
        ) {
            console.warn("Clicked outside map bounds");
            return;
        }
        
        const existingTower = getTowerAt(tileX, tileY);
        if (existingTower) {
            upgradeTower(app, existingTower, player);
            return;
        }
        
        
        // Placement logic
        if (player.gold < TOWER_COST) {
            console.log("Not enough gold to place tower!");
            return;
        }
        
        const tile = mapData[tileY][tileX];
        if (tile !== TILE_GROUND) {
            console.log("Cannot build on this tile:", tile);
            return;
        }
        
        player.gold -= TOWER_COST;
        updatePlayerGoldText(userId); // ✅ reflect gold change for the right player
        mapData[tileY][tileX] = TILE_TOWER;
        
        const level = 1;
        const { damage, attackSpeed, range } = getTowerStatsForLevel(level);
        const cx = tileX * TILE_SIZE + TILE_SIZE / 2;
        const cy = tileY * TILE_SIZE + TILE_SIZE / 2 + HUD_HEIGHT;
        
        const container = new Container(); // NEW
        
        // Tower visual (polygon)
        const gfx = drawTowerGraphic(app, tileX, tileY, level);
        container.addChild(gfx);
        
        // Range circle
        const rangeCircle = new Graphics()
        .circle(cx, cy, range)
        .stroke({ width: 1, color: 0xffffff, alpha: 0.15 });
        rangeCircle.visible = false; // Optional: only show on hover
        container.addChild(rangeCircle);
        
        // Cooldown overlay
        const overlay = new Graphics();
        overlay.visible = false;
        container.addChild(overlay);
        
        // Enable hover interaction
        container.eventMode = 'static';
        container.cursor = 'pointer';
        container.on('pointerover', () => rangeCircle.visible = true);
        container.on('pointerout', () => rangeCircle.visible = false);
        
        
        // Add entire container to stage
        app.stage.addChild(container);
        
        const tower = {
            x: tileX,
            y: tileY,
            level,
            cooldown: 0,
            damage,
            attackSpeed,
            range,
            gfx,
            overlay,
            rangeCircle,
            container,
        };
        
        towers.push(tower);
        setupTowerHover(tower);
        console.log(`Tower placed at (${tileX}, ${tileY})`);
    }
    
    
    // Await app init
    await app.init({
        width: TILE_SIZE * MAP_WIDTH,
        height: TILE_SIZE * MAP_HEIGHT,
        background: '#ff0000',
    });
    console.log("Pixi app initialized");
    
    const me = auth.user;
    localPlayerId = me.id; // keep track globally or scoped in createGame
    handlePlayerJoin(app, me.id, me.username);
    
    const hud = new Graphics()
    .rect(0, 0, TILE_SIZE * MAP_WIDTH, HUD_HEIGHT)
    .fill({ color: 0x1e1e1e }); // dark background
    app.stage.addChild(hud);
    
    const restartButton = new Text({
        text: 'Restart',
        style: {
            fill: 0xffffff,
            fontSize: 18,
            fontWeight: 'bold',
            fontFamily: 'Arial',
            stroke: 0x000000,
            strokeThickness: 3,
        },
    });
    restartButton.interactive = true;
    restartButton.cursor = 'pointer';
    
    restartButton.x = TILE_SIZE * MAP_WIDTH - 90; // adjust as needed
    restartButton.y = 10;
    
    restartButton.on('pointerdown', () => {
        console.log("Restart button clicked");
        container.innerHTML = '';
        createGame(container);
    });
    
    restartButton.on('pointerover', () => {
        restartButton.style.fill = 0xffcc00;
    });
    restartButton.on('pointerout', () => {
        restartButton.style.fill = 0xffffff;
    });
    
    
    app.stage.addChild(restartButton);
    
    
    const livesText = new Text({
        text: `Lives: ${lives}`,
        style: {
            fill: 0xffffff,
            fontSize: 20,
            fontWeight: 'bold',
            fontFamily: 'Arial',
            stroke: 0x000000,
            strokeThickness: 3,
        },
    });
    livesText.x = 10;
    livesText.y = 10; // inside HUD bar
    app.stage.addChild(livesText);
    
    container.appendChild(app.canvas);
    console.log("Pixi app canvas appended to container");
    
    // ===== Join/Leave Events =====
    sdk.subscribe('ACTIVITY_JOIN', ({ user }) => {
        handlePlayerJoin(app, user.id);
    });
    
    sdk.subscribe('ACTIVITY_LEAVE', ({ user }) => {
        handlePlayerLeave(app, user.id);
    });
    
    sdk.subscribe('ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE', ({ participants }) => {
        for (const user of participants) {
            if (!players.has(user.id)) {
                handlePlayerJoin(app, user.id, user.username);
            }
        }
        
        // Remove players who left
        for (const id of players.keys()) {
            if (!participants.find(p => p.id === id)) {
                handlePlayerLeave(app, id);
            }
        }
    });
    
    app.canvas.addEventListener("click", (event) => {
        const rect = app.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        
        // Skip clicks in the HUD
        if (mouseY < HUD_HEIGHT) return;
        
        const tileX = Math.floor(mouseX / TILE_SIZE);
        const tileY = Math.floor((mouseY - HUD_HEIGHT) / TILE_SIZE);
        
        handleTowerPlacement(app, tileX, tileY, localPlayerId);
    });
    
    app.canvas.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        const rect = app.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        
        const tileX = Math.floor(mouseX / TILE_SIZE);
        const tileY = Math.floor((mouseY - HUD_HEIGHT) / TILE_SIZE);
        
        if (
            tileX < 0 || tileX >= MAP_WIDTH ||
            tileY < 0 || tileY >= MAP_HEIGHT
        ) return;
        
        if (mapData[tileY][tileX] === TILE_TOWER) {
            const index = towers.findIndex(t => t.x === tileX && t.y === tileY);
            if (index === -1) return;
            
            const tower = towers[index];
            const player = players.get(tower.ownerId); // ✅ get the owning player
            
            if (!player) {
                console.warn("Could not find player for this tower!");
                return;
            }

            if (tower.ownerId !== localPlayerId) {
                console.warn("You can only sell your own towers!");
                return;
            }
            
            // Refund calculation
            let totalInvested = TOWER_COST;
            for (let lvl = 1; lvl < tower.level; lvl++) {
                totalInvested += TOWER_COST + lvl * UPGRADE_COST_SCALE;
            }
            const refund = Math.floor(totalInvested / 2);
            player.gold += refund;
            
            updatePlayerGoldText(tower.ownerId); // ✅ update gold for correct player
            
            console.log(`Tower sold. Refunded ${refund} gold to ${tower.ownerId}.`);
            
            // Remove visuals
            tower.gfx.destroy();
            tower.overlay.destroy();
            tower.rangeCircle.destroy();
            tower.container.destroy();
            
            towers.splice(index, 1);
            mapData[tileY][tileX] = TILE_GROUND;
            
            // Redraw ground tile
            const tileGfx = new Graphics()
            .rect(tileX * TILE_SIZE, tileY * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE)
            .fill({ color: 0x80a343 });
            app.stage.addChild(tileGfx);
            
            console.log(`Tower sold at (${tileX}, ${tileY})`);
        }
    });
    
    
    
    // Spawn points are tiles with value 8 in the mapData
    //const spawnPoints = findSpawnPoints(mapData);
    const mapData = originalMap.map(row => [...row]);
    const spawnPoints = findSpawnPointsAndClear(mapData);
    
    drawMap(app, mapData);
    console.log("Map drawn");
    
    drawGrid(app);
    console.log("Grid drawn");
    
    if (!spawnPoints || spawnPoints.length === 0) {
        console.error("No spawn points found in map!");
        return;
    }
    console.log("Found spawn points:", spawnPoints);
    
    const goal = findGoal(mapData);
    if (!goal) return;
    
    const monsters = [];
    const pathCache = {};
    
    setInterval(() => {
        const [sx, sy] = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
        const key = `${sx},${sy}`;
        
        if (!pathCache[key]) {
            pathCache[key] = tracePathToGoal(sx, sy, goal[0], goal[1], mapData);
        }
        
        const monster = new Monster(
            app,
            pathCache[key],
            goal,
            () => {
                lives--;
                livesText.text = `Lives: ${lives}`;
                if (lives <= 0) handleGameOver(app, container);
            },
            (killerId) => {
                const killer = players.get(killerId);
                if (killer) {
                    killer.gold += 1;
                    updatePlayerGoldText(killerId); // ✅ only update that player
                }
            }
        );
        monsters.push(monster);
    }, SPAWN_TIME);
    
    
    app.ticker.add(() => {
        if (gameOver) return;
        
        monsters.forEach(m => m.update());
        
        towers.forEach(tower => {
            const attackSpeed = tower.attackSpeed || ATTACKSPEED_DEFAULT;
            
            if (tower.cooldown > 0) {
                tower.cooldown--;
                
                // Circular cooldown: draw a pie segment
                const progress = tower.cooldown / attackSpeed;
                const cx = tower.x * TILE_SIZE + TILE_SIZE / 2;
                const cy = tower.y * TILE_SIZE + TILE_SIZE / 2 + HUD_HEIGHT;
                const radius = TILE_SIZE / 2;
                
                tower.overlay.clear();
                tower.overlay.visible = true;
                tower.overlay.beginFill(0x000000, 0.5);
                tower.overlay.moveTo(cx, cy);
                
                const endAngle = -Math.PI / 2 + 2 * Math.PI * progress;
                tower.overlay.arc(cx, cy, radius, -Math.PI / 2, endAngle);
                tower.overlay.lineTo(cx, cy);
                tower.overlay.endFill();
            } else {
                tower.overlay.visible = false;
                
                // Try to fire
                const towerX = tower.x * TILE_SIZE + TILE_SIZE / 2;
                const towerY = tower.y * TILE_SIZE + TILE_SIZE / 2 + HUD_HEIGHT;
                const range = tower.range;
                
                const target = monsters.find(monster => {
                    if (!monster.alive) return false;
                    const [mx, my] = monster.getPosition();
                    const dx = towerX - mx;
                    const dy = towerY - my;
                    return Math.sqrt(dx * dx + dy * dy) <= range;
                });
                
                if (target) {
                    const damageValue = Math.floor(Math.random() * 21) + tower.damage;
                    tower.cooldown = attackSpeed;
                    
                    const projectile = new Projectile(
                        app,
                        towerX,
                        towerY,
                        target,
                        damageValue,
                        PROJECTILE_SPEED,
                        tower.ownerId // Pass the owner ID to the projectile
                    );
                    projectiles.push(projectile);
                }
            }
        });
        
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const p = projectiles[i];
            if (p.active) {
                p.update();
            } else {
                projectiles.splice(i, 1);
            }
        }
    });
    
    console.log("Known players after init 2:", [...players.keys()]);
}


// ===== Internal Functions =====

// Draws the map using the mapData array
function drawMap(app, mapData) {
    for (let y = 0; y < mapData.length; y++) {
        for (let x = 0; x < mapData[y].length; x++) {
            const tile = mapData[y][x];
            
            let color = 0x80a343;
            if (tile === TILE_PATH) color = 0xa36e43;
            else if (tile === TILE_BLOCK) color = 0x222222;
            else if (tile === TILE_TOWER) color = 0xa611a8;
            else if (tile === TILE_SPAWN) color = 0x00ffff;
            else if (tile === TILE_GOAL) color = 0xff0000;
            
            const g = new Graphics()
            .rect(x * TILE_SIZE, y * TILE_SIZE + HUD_HEIGHT, TILE_SIZE, TILE_SIZE)
            .fill({ color });
            
            app.stage.addChild(g);
        }
    }
}



// Draws the grid lines on top of the map
function drawGrid(app) {
    const g = new Graphics();
    
    g.stroke({ width: 1, color: 0x333333 });
    
    for (let x = 0; x <= MAP_WIDTH; x++) {
        g.moveTo(x * TILE_SIZE, HUD_HEIGHT).lineTo(x * TILE_SIZE, TILE_SIZE * MAP_HEIGHT + HUD_HEIGHT);
    }
    
    for (let y = 0; y <= MAP_HEIGHT; y++) {
        g.moveTo(0, y * TILE_SIZE + HUD_HEIGHT).lineTo(TILE_SIZE * MAP_WIDTH, y * TILE_SIZE + HUD_HEIGHT);
    }
    
    app.stage.addChild(g);
}


// Converts tile coordinates to pixel coordinates
function tileToPos(x, y) {
    return [
        x * TILE_SIZE + TILE_SIZE / 2,
        y * TILE_SIZE + TILE_SIZE / 2 + HUD_HEIGHT
    ];
}


function tracePathToGoal(startX, startY, goalX, goalY, map) {
    const queue = [[startX, startY, []]];
    const visited = new Set();
    const toKey = (x, y) => `${x},${y}`;
    visited.add(toKey(startX, startY));
    
    const directions = [
        [1, 0], [-1, 0], [0, 1], [0, -1]
    ];
    
    while (queue.length > 0) {
        const [x, y, path] = queue.shift();
        const newPath = [...path, tileToPos(x, y)];
        
        if (x === goalX && y === goalY) {
            return newPath;
        }
        
        for (const [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;
            
            if (
                ny >= 0 && ny < map.length &&
                nx >= 0 && nx < map[0].length &&
                (map[ny][nx] === 9 || map[ny][nx] === 7) &&
                !visited.has(toKey(nx, ny))
            ) {
                visited.add(toKey(nx, ny));
                queue.push([nx, ny, newPath]);
            }
        }
    }
    
    console.warn(`No path found from (${startX}, ${startY}) to (${goalX}, ${goalY})`);
    return [];
}



function findSpawnPointsAndClear(map) {
    const points = [];
    
    for (let y = 0; y < map.length; y++) {
        for (let x = 0; x < map[y].length; x++) {
            if (map[y][x] === 8) {
                points.push([x, y]);
                map[y][x] = 9; // Turn into path after collecting
            }
        }
    }
    
    return points;
}


function findGoal(map) {
    for (let y = 0; y < map.length; y++) {
        for (let x = 0; x < map[y].length; x++) {
            if (map[y][x] === 7) {
                return [x, y];
            }
        }
    }
    console.warn("No goal tile (7) found in map!");
    return null;
}


function drawTowerGraphic(app, tileX, tileY, level = 1) {
    const sides = Math.max(3, level + 2); // Level 1 = 3 sides, Level 2 = 4 sides, etc.
    const size = TILE_SIZE;
    const cx = tileX * size + size / 2;
    const cy = tileY * size + size / 2 + HUD_HEIGHT;
    const r = size / 2;
    
    const g = new Graphics();
    g.moveTo(cx + r * Math.cos(0), cy + r * Math.sin(0));
    
    for (let i = 1; i <= sides; i++) {
        const angle = (i * 2 * Math.PI) / sides;
        g.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
    }
    
    g.closePath();
    g.fill({ color: 0xa611a8 }); // You can change color based on level too
    app.stage.addChild(g);
    return g;
}

function getTowerStatsForLevel(level) {
    return {
        damage: 5 + level * 5,                  // e.g. 10, 15, 20...
        attackSpeed: Math.max(ATTACKSPEED_DEFAULT - level * 10, 30), // Faster with level (min 30)
        range: TILE_SIZE * (1.3 + level * 0.5), // Slightly increasing range
    };
}


function setupTowerHover(tower) {
    tower.container.eventMode = 'static';
    tower.container.cursor = 'pointer';
    
    // Optional: create the tooltip only once
    if (!tower.tooltip) {
        const style = new TextStyle({
            fill: '#ffffff',
            fontSize: 12,
            fontFamily: 'Arial',
            stroke: '#000000',
            strokeThickness: 2,
        });
        
        const tooltip = new Text('', style);
        tooltip.visible = false;
        tooltip.zIndex = 1000;
        tooltip.x = tower.x * TILE_SIZE + 4;
        tooltip.y = tower.y * TILE_SIZE + HUD_HEIGHT - 10;
        tower.tooltip = tooltip;
        tower.container.addChild(tooltip);
    }
    
    tower.container.on('pointerover', () => {
        tower.rangeCircle.visible = true;
        tower.tooltip.text = `Level: ${tower.level}
Damage: ${(tower.damage).toFixed(0)}
Range: ${(tower.range).toFixed(1)}
Speed: ${(60 / tower.attackSpeed).toFixed(2)}`;
        tower.tooltip.visible = true;
    });
    
    tower.container.on('pointerout', () => {
        tower.rangeCircle.visible = false;
        tower.tooltip.visible = false;
    });
    
    tower.container.setChildIndex(tower.tooltip, tower.container.children.length - 1);
}


function handlePlayerJoin(app, userId, tag = null) {
    const goldValues = Array.from(players.values()).map(p => p.gold);
    const minGold = goldValues.length > 0 ? Math.min(...goldValues) : START_GOLD;
    const newGold = Math.max(START_GOLD / 2, Math.floor(minGold / 2));
    
    const player = {
        id: userId,
        tag: tag || `Player ${players.size + 1}`,
        gold: newGold,
        towers: [],
        goldText: null,
        nameText: null,
        alive: true,
    };
    
    players.set(userId, player);
    console.log(`${userId} joined with ${newGold} gold.`);
    
    let index = 0;
    for (const [id, p] of players.entries()) {
        const isLocal = id === localPlayerId;
        if (!p.goldText || !p.nameText) {
            createPlayerGoldText(app, p, index, isLocal);
        }
        index++;
    }
    
    layoutPlayerGoldTexts(app);
}


function layoutPlayerGoldTexts(app) {
    let index = 0;
    for (const player of players.values()) {
        const x = 150 + index * 150;
        if (player.goldText) {
            player.goldText.x = x;
            player.goldText.y = 24;
        }
        if (player.nameText) {
            player.nameText.x = x;
            player.nameText.y = 8;
        }
        index++;
    }
}



function handlePlayerLeave(userId) {
    const player = players.get(userId);
    if (!player) return;
    
    const refund = player.towers.reduce((sum, tower) => {
        let invested = TOWER_COST;
        for (let lvl = 1; lvl < tower.level; lvl++) {
            invested += TOWER_COST + lvl * UPGRADE_COST_SCALE;
        }
        return sum + Math.floor(invested / 2);
    }, 0);
    
    // Remove towers
    player.towers.forEach(tower => {
        mapData[tower.y][tower.x] = TILE_GROUND;
        tower.gfx.destroy();
        tower.overlay.destroy();
        tower.rangeCircle?.destroy();
        towers.splice(towers.indexOf(tower), 1);
    });
    
    players.delete(userId);
    
    // Redistribute gold
    const remaining = Array.from(players.values());
    const share = Math.floor(refund / remaining.length);
    remaining.forEach(p => p.gold += share);
    
    console.log(`${userId} left. Redistributed ${refund} gold.`);
}

function getPlayerGoldText(userId) {
    const player = players.get(userId);
    if (!player || !player.goldText) return null;
    return player.goldText;
}

function updatePlayerGoldText(userId) {
    const player = players.get(userId);
    if (player && player.goldText) {
        player.goldText.text = `Gold: ${player.gold}`;
    }
}

function createPlayerGoldText(app, player, index, isLocal = false) {
    const label = isLocal ? "You" : player.tag || `Player ${index + 1}`;
    
    const nameText = new Text({
        text: label,
        style: {
            fill: 0xffffff,
            fontSize: 12,
            fontFamily: 'Arial',
        },
    });
    nameText.x = 150 + index * 150;
    nameText.y = 8;
    app.stage.addChild(nameText);
    player.nameText = nameText;
    
    const goldText = new Text({
        text: `Gold: ${player.gold}`,
        style: {
            fill: 0xffff00,
            fontSize: 20,
            fontWeight: 'bold',
            fontFamily: 'Arial',
            stroke: 0x000000,
            strokeThickness: 3,
        },
    });
    goldText.x = 150 + index * 150;
    goldText.y = 20;
    app.stage.addChild(goldText);
    player.goldText = goldText;
}
