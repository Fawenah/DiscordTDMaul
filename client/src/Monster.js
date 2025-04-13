import { Graphics, Container } from 'pixi.js';

const HUD_HEIGHT = 40;

export class Monster {
    constructor(app, path, goalTile, onReachGoal, onKill) {
        this.app = app;
        this.path = path;
        this.currentStep = 0;
        this.speed = 0.5;
        this.maxHP = 100;
        this.hp = this.maxHP;
        this.alive = true;
        
        this.hpBarBackground = new Graphics()
        .rect(-12, -20, 24, 4)
        .fill({ color: 0x333333 });
        
        this.hpBar = new Graphics()
        .rect(-12, -20, 24, 4)
        .fill({ color: 0x00ff00 });
        
        this.sprite = new Graphics()
        .circle(0, 0, 10)
        .fill({ color: 0xff4444 });
        
        this.container = new Container();
        app.stage.addChild(this.container);
        this.container.addChild(this.sprite);
        this.container.addChild(this.hpBarBackground);
        this.container.addChild(this.hpBar);
        this.setPosition(path[0]);
        
        this.goalTile = goalTile;
        this.onReachGoal = onReachGoal;

        this.onKill = onKill;
        this.killerId = null; // Track who last hit the monster

    }
    
    
    setPosition([x, y]) {
        this.sprite.x = x;
        this.sprite.y = y;
        
        this.hpBar.x = x;
        this.hpBar.y = y;
        
        this.hpBarBackground.x = x;
        this.hpBarBackground.y = y;
    }
    
    
    update() {
        if (!this.alive) return;
        
        if (this.currentStep >= this.path.length - 1) {
            this.reachGoal();
            return;
        }
        
        const [x1, y1] = this.path[this.currentStep];
        const [x2, y2] = this.path[this.currentStep + 1];
        
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const dirX = dx / dist;
        const dirY = dy / dist;
        
        const moveX = this.sprite.x + dirX * this.speed;
        const moveY = this.sprite.y + dirY * this.speed;
        
        const reachedX = Math.abs(moveX - x2) < this.speed;
        const reachedY = Math.abs(moveY - y2) < this.speed;
        
        this.sprite.x = moveX;
        this.sprite.y = moveY;
        
        // ✅ Keep health bar visually in sync
        const barOffsetY = -5; // or tweak as needed
        this.hpBar.x = moveX;
        this.hpBar.y = moveY - barOffsetY;
        this.hpBarBackground.x = moveX;
        this.hpBarBackground.y = moveY - barOffsetY;
        
        
        if (reachedX && reachedY) {
            this.currentStep++;
            this.setPosition(this.path[this.currentStep]);
        }
    }
    
    takeDamage(amount, sourcePlayerId) {
        this.hp -= amount;
        if (sourcePlayerId) this.killerId = sourcePlayerId; // ✅ track who hit
        if (this.hp <= 0) {
            this.die();
            return;
        }
    
        const hpPercent = Math.max(this.hp / this.maxHP, 0);
        this.hpBar.scale.x = hpPercent;
    }    
    
    
    die() {
        this.alive = false;
        this.container.destroy();
        if (this.onDeath && this.killerId) {
            this.onDeath(this.killerId); // ✅ pass killer info
        }
    }
    
    
    
    getPosition() {
        return [this.sprite.x, this.sprite.y];
    }
    
    
    reachGoal() {
        if (this.alive) {
            this.alive = false;
            this.container.destroy(); // remove visual
            if (this.onReachGoal) this.onReachGoal();
        }
    }
}
