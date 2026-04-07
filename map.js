class GameMap {
    constructor(scene) {
        this.scene = scene;
        this.walls = [];
    }

    create() {
        for (let i = 0; i < 8; i++) {
            this.createWall(
                Phaser.Math.Between(100, 900),
                Phaser.Math.Between(100, 500),
                Phaser.Math.Between(100, 250),
                20
            );
        }
    }

    createWall(x, y, w, h) {
        let wall = this.scene.add.rectangle(x, y, w, h, 0x555555);
        this.scene.physics.add.existing(wall, true);
        this.walls.push(wall);
    }
}
