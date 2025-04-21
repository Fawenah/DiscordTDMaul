import { Graphics } from 'pixi.js';

export class Projectile {
    constructor(app, startX, startY, target, damage = 34, speed = 5, ownerId = null) {
        this.ownerId = ownerId;
        this.app = app;
        this.target = target;
        this.damage = damage;
        this.speed = speed;
        this.active = true;
        
        this.sprite = new Graphics()
        .circle(0, 0, 4)
        .fill({ color: 0xffff00 });
        
        this.sprite.x = startX;
        this.sprite.y = startY;
        
        app.stage.addChild(this.sprite);
    }
    
    update() {
        if (!this.active || !this.target?.alive) {
            this.destroy();
            return;
        }
        
        const [tx, ty] = this.target.getPosition();
        const dx = tx - this.sprite.x;
        const dy = ty - this.sprite.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist <= this.speed) {
            this.target.takeDamage(this.damage, this.ownerId);
            this.destroy();
            return;
        }
        
        this.sprite.x += (dx / dist) * this.speed;
        this.sprite.y += (dy / dist) * this.speed;
    }
    
    destroy() {
        this.active = false;
        this.sprite.destroy();
    }
}
