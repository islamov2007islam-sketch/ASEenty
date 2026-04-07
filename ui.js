class UI {
    constructor(scene) {
        this.scene = scene;

        this.text = scene.add.text(10, 10, "", {
            font: "16px Arial",
            fill: "#ffffff"
        });
    }

    update(time, startTime, player) {
        this.text.setText(
            "Time: " + Math.floor((time - startTime) / 1000) +
            "\nStamina: " + Math.floor(player.stamina)
        );
    }
}
