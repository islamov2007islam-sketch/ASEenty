import * as THREE from 'three';

let scene, camera, renderer, clock;
let isPaused = false, isStarted = false;
let keys = {};
let velocity = new THREE.Vector3();
let stamina = 100;
let inventory = [];

const objects = { walls: [], items: [], interact: [] };

// Настройки "движка"
const SETTINGS = {
    fov: 75,
    speed: 5.5,
    staminaRegen: 10,
    staminaDecay: 20
};

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020000);
    scene.fog = new THREE.FogExp2(0x020000, 0.15);

    camera = new THREE.PerspectiveCamera(SETTINGS.fov, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio > 1 ? 2 : 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // --- ОСВЕЩЕНИЕ (Granny Style) ---
    const ambient = new THREE.AmbientLight(0xff0000, 0.02); // Едва заметный красный подтон
    scene.add(ambient);

    // Фонарик игрока
    const flashlight = new THREE.SpotLight(0xffffff, 4, 25, Math.PI/6, 0.5, 1);
    flashlight.castShadow = true;
    camera.add(flashlight);
    camera.add(flashlight.target);
    flashlight.target.position.z = -1;

    createWorld();
    setupInput();
    animate();
}

function createWorld() {
    // Пол с "грязной" текстурой (имитация через Roughness)
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9, metalness: 0.1 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1.0 });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Добавляем лампы в доме (как в Granny)
    addPointLight(5, 4, 5, 0xffaa00);
    addPointLight(-5, 4, -5, 0x00ff00);

    // Стены дома
    createWall(0, 0, -10, 20, 6, 1, wallMat); // Задняя
    createWall(-10, 0, 0, 1, 6, 20, wallMat); // Левая
    createWall(10, 0, 0, 1, 6, 20, wallMat);  // Правая
    
    // Предметы (Ключи)
    spawnItem("RED_KEY", 8, 0.5, -8, 0xff0000);
    spawnItem("GEAR_PART", -7, 0.5, 5, 0x888888);
}

function addPointLight(x, y, z, color) {
    const light = new THREE.PointLight(color, 2, 15);
    light.position.set(x, y, z);
    light.castShadow = true;
    scene.add(light);
    
    // Визуальная модель лампы
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshBasicMaterial({color}));
    lamp.position.set(x, y, z);
    scene.add(lamp);
}

function createWall(x, y, z, w, h, d, mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y + h/2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    objects.walls.push(new THREE.Box3().setFromObject(mesh));
}

function spawnItem(name, x, y, z, color) {
    const item = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshStandardMaterial({color, emissive: color, emissiveIntensity: 0.5}));
    item.position.set(x, y, z);
    item.userData = { name, isItem: true };
    scene.add(item);
    objects.interact.push(item);
}

function setupInput() {
    window.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        if(e.code === 'Escape' && isStarted) togglePause();
    });
    window.addEventListener('keyup', (e) => keys[e.code] = false);

    document.getElementById('btn-start').onclick = () => {
        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('game-hud').classList.remove('hidden');
        document.body.requestPointerLock();
        isStarted = true;
    };

    document.getElementById('btn-resume').onclick = () => togglePause();

    document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement && !isPaused) {
            camera.rotation.y -= e.movementX * 0.002;
            camera.rotation.x -= e.movementY * 0.002;
            camera.rotation.x = Math.max(-1.5, Math.min(1.5, camera.rotation.x));
        }
    });
}

function togglePause() {
    isPaused = !isPaused;
    const menu = document.getElementById('pause-menu');
    if (isPaused) {
        menu.classList.remove('hidden');
        document.exitPointerLock();
    } else {
        menu.classList.add('hidden');
        document.body.requestPointerLock();
    }
}

function animate() {
    requestAnimationFrame(animate);
    if (isPaused || !isStarted) return;

    const delta = 0.016; // Фиксированный шаг (как в Unity FixedUpdate)
    
    // Передвижение
    let move = new THREE.Vector3();
    if (keys['KeyW']) move.z -= 1;
    if (keys['KeyS']) move.z += 1;
    if (keys['KeyA']) move.x -= 1;
    if (keys['KeyD']) move.x += 1;

    move.normalize().applyQuaternion(camera.quaternion);
    move.y = 0;

    // Стамина
    const isRunning = keys['ShiftLeft'] && move.length() > 0 && stamina > 0;
    const currentSpeed = isRunning ? SETTINGS.speed * 1.6 : SETTINGS.speed;
    
    if (isRunning) stamina -= SETTINGS.staminaDecay * delta;
    else stamina = Math.min(100, stamina + SETTINGS.staminaRegen * delta);
    
    document.getElementById('stamina-bar').style.width = stamina + "%";
    document.getElementById('stamina-val').innerText = Math.floor(stamina) + "%";

    velocity.lerp(move.multiplyScalar(currentSpeed), 0.1);
    
    const oldPos = camera.position.clone();
    camera.position.add(velocity.clone().multiplyScalar(delta));

    // Простая коллизия
    const playerBox = new THREE.Box3().setFromCenterAndSize(camera.position, new THREE.Vector3(0.7, 2, 0.7));
    for(let wall of objects.walls) {
        if(playerBox.intersectsBox(wall)) camera.position.copy(oldPos);
    }

    // Взаимодействие (Raycast)
    updateInteraction();
    
    renderer.render(scene, camera);
}

function updateInteraction() {
    const ray = new THREE.Raycaster();
    ray.setFromCamera({x:0, y:0}, camera);
    const hits = ray.intersectObjects(objects.interact);
    
    const prompt = document.getElementById('interaction-prompt');
    if(hits.length > 0 && hits[0].distance < 3) {
        const obj = hits[0].object;
        prompt.innerText = `[E] COLLECT_${obj.userData.name}`;
        if(keys['KeyE']) {
            inventory.push(obj.userData.name);
            scene.remove(obj);
            objects.interact.splice(objects.interact.indexOf(obj), 1);
            updateInvUI();
        }
    } else {
        prompt.innerText = "";
    }
}

function updateInvUI() {
    const list = document.getElementById('inventory-list');
    list.innerHTML = inventory.map(i => `<li>> ${i}</li>`).join('');
}

init();
