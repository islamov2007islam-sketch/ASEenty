class MainScene extends Phaser.Scene {
    constructor() {
        super("main");
    }

    create() {
        this.player = new Player(this, 100, 100);

        this.map = new GameMap(this);
        this.map.create();

        this.bots = [];
        for (let i = 0; i < 3; i++) {
            this.bots.push(new Bot(this, 500 + i * 60, 300));
        }

        this.ui = new UI(this);

        this.startTime = this.time.now;
    }

    update(time) {
        this.player.update();

        this.bots.forEach(bot => bot.update(this.player, time));

        this.ui.update(time, this.startTime, this.player);
    }
}

const config = {
    type: Phaser.AUTO,
    width: 1000,
    height: 600,
    physics: {
        default: "arcade",
        arcade: { debug: false }
    },
    scene: [MainScene]
};

new Phaser.Game(config);
