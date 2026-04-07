class Bot {
    constructor(scene, x, y) {
        this.scene = scene;

        this.sprite = scene.physics.add.rectangle(x, y, 25, 25, 0xff4444);
        this.sprite.body.setCollideWorldBounds(true);

        this.state = "patrol";
        this.memory = 0;

        scene.physics.add.collider(this.sprite, scene.map.walls);
    }

    update(player, time) {
        let dx = player.sprite.x - this.sprite.x;
        let dy = player.sprite.y - this.sprite.y;
        let dist = Math.sqrt(dx * dx + dy * dy);

        let canSee = dist < 200 && !this.blocked(player);

        if (canSee) {
            this.state = "chase";
            this.memory = time;
        } else if (time - this.memory < 3000) {
            this.state = "search";
        } else {
            this.state = "patrol";
        }

        if (this.state === "chase") {
            this.sprite.body.setVelocity(dx * 2.5, dy * 2.5);
        } else if (this.state === "search") {
            this.sprite.body.setVelocity(dx * 1.2, dy * 1.2);
        } else {
            if (!this.moveTime || time > this.moveTime) {
                this.sprite.body.setVelocity(
                    Phaser.Math.Between(-80, 80),
                    Phaser.Math.Between(-80, 80)
                );
                this.moveTime = time + 2000;
            }
        }

        if (dist < 25) {
            location.reload();
        }
    }

    blocked(player) {
        let line = new Phaser.Geom.Line(
            this.sprite.x,
            this.sprite.y,
            player.sprite.x,
            player.sprite.y
        );

        for (let w of this.scene.map.walls) {
            if (Phaser.Geom.Intersects.LineToRectangle(line, w.getBounds())) {
                return true;
            }
        }
        return false;
    }
}
