class Player {
    constructor(scene, x, y) {
        this.scene = scene;

        this.sprite = scene.physics.add.rectangle(x, y, 25, 25, 0x00ffcc);
        this.sprite.body.setCollideWorldBounds(true);

        this.keys = scene.input.keyboard.addKeys("W,A,S,D,SHIFT");

        this.stamina = 100;
    }

    update() {
        let speed = 150;

        if (this.keys.SHIFT.isDown && this.stamina > 0) {
            speed = 260;
            this.stamina -= 0.5;
        } else {
            this.stamina += 0.3;
        }

        this.stamina = Phaser.Math.Clamp(this.stamina, 0, 100);

        this.sprite.body.setVelocity(0);

        if (this.keys.A.isDown) this.sprite.body.setVelocityX(-speed);
        if (this.keys.D.isDown) this.sprite.body.setVelocityX(speed);
        if (this.keys.W.isDown) this.sprite.body.setVelocityY(-speed);
        if (this.keys.S.isDown) this.sprite.body.setVelocityY(speed);
    }
}
