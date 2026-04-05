import * as THREE from 'three';

// === КОНФИГУРАЦИЯ И СОСТОЯНИЕ ===
const STATE = {
    coins: parseInt(localStorage.getItem('destiny_coins')) || 0,
    upgrades: JSON.parse(localStorage.getItem('destiny_upgrades')) || { speed: 1, stamina: 1, light: 1 },
    stamina: 100,
    isRunning: false,
    inGame: false,
    isDead: false,
    monsterAlert: 0 // 0 - патруль, 1 - преследование
};

// Настройки баланса
const CONFIG = {
    baseSpeed: 0.12,
    runMultiplier: 1.6,
    staminaDepletion: 0.4,
    staminaRegen: 0.2,
    monsterSpeed: 0.09
};

// === ИНИЦИАЛИЗАЦИЯ ДВИЖКА ===
const canvas = document.querySelector('#game-canvas');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const walls = [];

// === ОСВЕЩЕНИЕ И ТУМАН ===
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.FogExp2(0x000000, 0.15);

const ambientLight = new THREE.AmbientLight(0x404040, 0.2); 
scene.add(ambientLight);

const flashlight = new THREE.SpotLight(0xffffff, 2);
flashlight.angle = Math.PI / 6;
flashlight.penumbra = 0.3;
flashlight.castShadow = true;
flashlight.visible = false;
camera.add(flashlight);
flashlight.target.position.set(0, 0, -5);
camera.add(flashlight.target);
scene.add(camera);

// === ГЕНЕРАЦИЯ МИРА ===
function createWorld() {
    // Пол (дорога и земля)
    const floorGeo = new THREE.PlaneGeometry(200, 200);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Дорожная разметка
    for(let i = -100; i < 100; i += 10) {
        const stripe = new THREE.Mesh(
            new THREE.PlaneGeometry(0.5, 4),
            new THREE.MeshBasicMaterial({ color: 0x555500 })
        );
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(0, 0.01, i);
        scene.add(stripe);
    }

    // Лес (упрощенные деревья для оптимизации)
    const treeGeo = new THREE.CylinderGeometry(0.2, 0.4, 6);
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x050505 });
    for(let i = 0; i < 150; i++) {
        const tree = new THREE.Mesh(treeGeo, treeMat);
        let x = (Math.random() - 0.5) * 100;
        let z = (Math.random() - 0.5) * 100;
        if (Math.abs(x) < 7) x += 10; // Очистка дороги
        tree.position.set(x, 3, z);
        scene.add(tree);
        walls.push(tree);
    }

    // Заброшенный дом (группа объектов)
    const house = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 8), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
    body.position.set(15, 3, -20);
    house.add(body);
    walls.push(body);
    scene.add(house);
}

// === МОНСТР AI ===
let monster;
function createMonster() {
    const mGroup = new THREE.Group();
    // Туловище (черный силуэт)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.3, 3), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    mGroup.add(body);
    // Глаза
    const eyeGeo = new THREE.SphereGeometry(0.05);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const e1 = new THREE.Mesh(eyeGeo, eyeMat); e1.position.set(0.2, 1.2, 0.4);
    const e2 = new THREE.Mesh(eyeGeo, eyeMat); e2.position.set(-0.2, 1.2, 0.4);
    mGroup.add(e1, e2);
    
    monster = mGroup;
    monster.position.set(-15, 1.5, -30);
    scene.add(monster);
}

function updateMonsterAI(delta) {
    if (!monster || !STATE.inGame) return;

    const dist = camera.position.distanceTo(monster.position);

    // Логика обнаружения
    if (dist < 15 && (STATE.isRunning || STATE.upgrades.light > 1)) {
        STATE.monsterAlert = 1; // Заметил
    }

    if (STATE.monsterAlert === 1) {
        monster.lookAt(camera.position.x, 1.5, camera.position.z);
        monster.translateZ(CONFIG.monsterSpeed + (Math.random() * 0.02));
        
        if (dist < 2) triggerDeath();
    } else {
        // Патруль
        monster.position.x += Math.sin(clock.elapsedTime) * 0.05;
    }
}

// === КАТСЦЕНА И ГЕЙМПЛЕЙ ===
async function startIntro() {
    STATE.inGame = false;
    document.getElementById('main-menu').classList.add('hidden');
    
    // Эффект пробуждения
    camera.position.set(2, 0.2, 10);
    camera.rotation.x = -0.5;
    
    await wait(2000);
    // Камера медленно поднимается
    let up = setInterval(() => {
        camera.position.y += 0.01;
        camera.rotation.x += 0.003;
        if(camera.position.y >= 1.6) {
            clearInterval(up);
            unlockControls();
        }
    }, 30);

    // Событие с грузовиком через 10 сек
    setTimeout(triggerTruckEvent, 10000);
}

function triggerTruckEvent() {
    const truck = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 8), new THREE.MeshStandardMaterial({ color: 0x0a0a0a }));
    const headL = new THREE.PointLight(0xffffff, 10, 20);
    headL.position.set(0, 1, 4);
    truck.add(body, headL);
    truck.position.set(0, 1.5, -60);
    scene.add(truck);

    let drive = setInterval(() => {
        truck.position.z += 0.8;
        if(truck.position.z > camera.position.z - 5) {
            clearInterval(drive);
            // Резкий скример
            document.getElementById('flash-overlay').style.opacity = '1';
            setTimeout(() => {
                document.getElementById('flash-overlay').style.opacity = '0';
                scene.remove(truck);
                startActualGame();
            }, 500);
        }
    }, 16);
}

function startActualGame() {
    STATE.inGame = true;
    flashlight.visible = true;
    document.getElementById('hud').style.display = 'block';
    createMonster();
}

function triggerDeath() {
    STATE.isDead = true;
    STATE.inGame = false;
    document.exitPointerLock();
    document.getElementById('death-screen').classList.remove('hidden');
}

// === УПРАВЛЕНИЕ ===
const keys = {};
document.addEventListener('keydown', e => keys[e.code] = true);
document.addEventListener('keyup', e => keys[e.code] = false);

function unlockControls() {
    canvas.addEventListener('click', () => {
        if(!STATE.isDead) canvas.requestPointerLock();
    });
}

document.addEventListener('mousemove', e => {
    if (document.pointerLockElement === canvas) {
        yaw -= e.movementX * 0.002;
        pitch -= e.movementY * 0.002;
        pitch = Math.max(-Math.PI/2.2, Math.min(Math.PI/2.2, pitch));
    }
});

let yaw = 0, pitch = 0;
function updateMovement(delta) {
    if (!STATE.inGame && camera.position.y < 1.5) return;

    camera.rotation.set(pitch, yaw, 0, 'YXZ');

    const speed = (keys['ShiftLeft'] && STATE.stamina > 5) ? 
        CONFIG.baseSpeed * CONFIG.runMultiplier * STATE.upgrades.speed : 
        CONFIG.baseSpeed;

    STATE.isRunning = (keys['KeyW'] || keys['KeyS']) && keys['ShiftLeft'] && STATE.stamina > 5;

    if (keys['KeyW']) camera.translateZ(-speed);
    if (keys['KeyS']) camera.translateZ(speed);
    if (keys['KeyA']) camera.translateX(-speed);
    if (keys['KeyD']) camera.translateX(speed);

    // Выносливость
    if (STATE.isRunning) {
        STATE.stamina -= CONFIG.staminaDepletion / STATE.upgrades.stamina;
    } else {
        STATE.stamina = Math.min(100, STATE.stamina + CONFIG.staminaRegen);
    }
    document.getElementById('stamina-bar').style.width = STATE.stamina + '%';

    // Сбор монет (пассивный за выживание)
    if(STATE.inGame && clock.elapsedTime % 5 < 0.02) {
        STATE.coins += 1;
        updateUI();
    }
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
function updateUI() {
    document.getElementById('menu-coins').innerText = STATE.coins;
    document.getElementById('game-coins').innerText = STATE.coins;
    localStorage.setItem('destiny_coins', STATE.coins);
    localStorage.setItem('destiny_upgrades', JSON.stringify(STATE.upgrades));
}

function wait(ms) { return new Promise(res => setTimeout(res, ms)); }

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (!STATE.isDead) {
        updateMovement(delta);
        updateMonsterAI(delta);
    }

    renderer.render(scene, camera);
}

// Кнопки меню
document.getElementById('btn-play').onclick = startIntro;
document.getElementById('btn-shop').onclick = () => {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('shop-screen').classList.remove('hidden');
};
document.getElementById('btn-back').onclick = () => {
    document.getElementById('shop-screen').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
};

// Логика покупки
document.querySelectorAll('.btn-buy').forEach(btn => {
    btn.onclick = () => {
        const item = btn.dataset.item;
        const price = parseInt(btn.dataset.price);
        if (STATE.coins >= price && STATE.upgrades[item] < 1.35) {
            STATE.coins -= price;
            STATE.upgrades[item] += 0.15;
            updateUI();
            alert('Улучшено!');
        } else {
            alert('Недостаточно монет или макс. уровень');
        }
    };
});

// Старт
createWorld();
updateUI();
animate();

// Ресайз
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
