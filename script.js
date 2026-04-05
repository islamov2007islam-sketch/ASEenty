import * as THREE from 'three';

// === НАСТРОЙКИ ИГРЫ ===
const CONFIG = {
    walkSpeed: 4.0,
    runSpeed: 7.0,
    inertia: 0.15, // Плавность ходьбы (Phasmophobia)
    mouseSens: 0.002,
    staminaDrain: 25,
    staminaRegen: 15
};

// Глобальные переменные
let scene, camera, renderer, clock;
let isGameRunning = false;
let keys = { w: false, a: false, s: false, d: false, shift: false, e: false };
let velocity = new THREE.Vector3();
let stamina = 100;
let inventory = [];

// Списки для коллизий
const walls = [];
const floors = [];
const interactables = [];
let interactionTarget = null;

// UI Элементы
const uiMenu = document.getElementById('main-menu');
const uiVideo = document.getElementById('video-container');
const uiHud = document.getElementById('game-hud');
const introVideo = document.getElementById('intro-video');
const promptText = document.getElementById('interaction-prompt');
const staminaBar = document.getElementById('stamina-bar');
const inventoryList = document.getElementById('inventory-list');

// === ИНИЦИАЛИЗАЦИЯ ===
function init3D() {
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020101);
    scene.fog = new THREE.FogExp2(0x020101, 0.1);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    // Спавн в подвале (Y=0)
    camera.position.set(0, 1.7, 0); 
    scene.add(camera);

    // Свет
    scene.add(new THREE.AmbientLight(0xffffff, 0.15)); // Чтобы было видно очертания

    const flashlight = new THREE.SpotLight(0xfff0dd, 3, 30, Math.PI / 5, 0.5, 1);
    flashlight.castShadow = true;
    camera.add(flashlight);
    camera.add(flashlight.target);
    flashlight.target.position.set(0, 0, -1);

    clock = new THREE.Clock();
    buildHouse();
    setupControls();
    animate();
}

// === СТРОИТЕЛЬСТВО ДОМА И ПРЕДМЕТОВ ===
function buildHouse() {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1a1515, roughness: 1.0 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });

    function addWall(x, y, z, w, h, d) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
        mesh.position.set(x, y + h/2, z);
        scene.add(mesh);
        walls.push(new THREE.Box3().setFromObject(mesh));
    }

    function addFloor(x, y, z, w, d) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), floorMat);
        mesh.position.set(x, y, z);
        scene.add(mesh);
        floors.push(mesh);
    }

    // --- 1. ПОДВАЛ (Y=0) ---
    addFloor(0, 0, 0, 30, 30); // Пол подвала
    addWall(0, 0, -15, 30, 5, 1); // Задняя стена
    addWall(0, 0, 15, 30, 5, 1);  // Передняя
    addWall(-15, 0, 0, 1, 5, 30); // Левая
    addWall(15, 0, 0, 1, 5, 30);  // Правая

    // --- 2. ПЕРВЫЙ ЭТАЖ (Y=5) ---
    // Пол с дыркой для лестницы (Лестница будет на X=10)
    addFloor(-5, 5, 0, 20, 30);
    addFloor(12.5, 5, 0, 5, 30);
    addFloor(7.5, 5, -10, 5, 10);
    addFloor(7.5, 5, 10, 5, 10);
    
    // Стены первого этажа
    addWall(0, 5, -15, 30, 5, 1);
    addWall(0, 5, 15, 30, 5, 1);
    addWall(-15, 5, 0, 1, 5, 30);
    addWall(15, 5, 0, 1, 5, 30);

    // --- 3. ЛЕСТНИЦА ИЗ ПОДВАЛА НАВЕРХ ---
    for(let i=0; i<10; i++) {
        addFloor(7.5, i * 0.5, 4.5 - i, 5, 1); // 10 ступенек
    }

    // --- 4. ДВЕРИ ДЛЯ ПОБЕГА ---
    spawnDoor('ДВЕРЬ ПОДВАЛА', ['КЛЮЧ ПОДВАЛА 1', 'КЛЮЧ ПОДВАЛА 2'], 0, 0, -14.8, 0x331111);
    spawnDoor('ГЛАВНАЯ ДВЕРЬ', ['ЛОМ', 'КЛЮЧ ОТ ЗАМКА', 'КУСАЧКИ', 'ГЛАВНЫЙ КЛЮЧ'], 0, 5, 14.8, 0x550000);

    // --- 5. ПРЕДМЕТЫ ---
    spawnItem('КЛЮЧ ПОДВАЛА 1', 0, 0.2, 5, 0x00ff00); // Легкий
    spawnItem('КЛЮЧ ПОДВАЛА 2', -13, 0.2, 13, 0x00ff00); // Спрятан в углу подвала

    spawnItem('ЛОМ', -13, 5.2, -13, 0xff0000); // Этаж 1
    spawnItem('КЛЮЧ ОТ ЗАМКА', 13, 5.2, -13, 0xff0000); // Этаж 1
    spawnItem('КУСАЧКИ', -13, 5.2, 13, 0xff0000); // Этаж 1
    spawnItem('ГЛАВНЫЙ КЛЮЧ', 0, 5.2, -5, 0xff0000); // Этаж 1 (возле лестницы)
}

function spawnDoor(name, req, x, y, z, color) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 0.4), new THREE.MeshStandardMaterial({color}));
    mesh.position.set(x, y + 2, z);
    mesh.userData = { isDoor: true, name: name, reqItems: req };
    scene.add(mesh);
    interactables.push(mesh);
    walls.push(new THREE.Box3().setFromObject(mesh)); // Дверь нельзя пройти насквозь
}

function spawnItem(name, x, y, z, color) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), new THREE.MeshStandardMaterial({color, emissive: color, emissiveIntensity: 0.3}));
    mesh.position.set(x, y, z);
    mesh.userData = { isItem: true, name: name };
    scene.add(mesh);
    interactables.push(mesh);
}

// === УПРАВЛЕНИЕ ===
function setupControls() {
    document.addEventListener('keydown', e => { if(keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true; });
    document.addEventListener('keyup', e => { if(keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false; });
    
    document.addEventListener('mousedown', () => { if(isGameRunning) document.body.requestPointerLock(); });

    document.addEventListener('mousemove', e => {
        if (document.pointerLockElement && isGameRunning) {
            camera.rotation.y -= e.movementX * CONFIG.mouseSens;
            camera.rotation.x -= e.movementY * CONFIG.mouseSens;
            camera.rotation.x = Math.max(-1.5, Math.min(1.5, camera.rotation.x));
        }
    });
}

// === ЛОГИКА ФИЗИКИ И ВЗАИМОДЕЙСТВИЯ ===
function updatePhysics(delta) {
    if(!isGameRunning) return;

    // Стамина
    let running = keys.shift && stamina > 0 && (keys.w || keys.s || keys.a || keys.d);
    let speed = running ? CONFIG.runSpeed : CONFIG.walkSpeed;
    
    if (running) stamina -= CONFIG.staminaDrain * delta;
    else stamina = Math.min(100, stamina + CONFIG.staminaRegen * delta);
    staminaBar.style.width = stamina + '%';

    // Вектор ходьбы
    let dir = new THREE.Vector3();
    if (keys.w) dir.z -= 1;
    if (keys.s) dir.z += 1;
    if (keys.a) dir.x -= 1;
    if (keys.d) dir.x += 1;
    dir.normalize().applyQuaternion(camera.quaternion);
    dir.y = 0;

    velocity.lerp(dir.multiplyScalar(speed), CONFIG.inertia);

    const oldPos = camera.position.clone();
    camera.position.x += velocity.x * delta;
    camera.position.z += velocity.z * delta;

    // 1. Коллизии со стенами (Нельзя пройти сквозь)
    const playerBox = new THREE.Box3().setFromCenterAndSize(camera.position, new THREE.Vector3(0.6, 1.5, 0.6));
    for(let wBox of walls) {
        if(playerBox.intersectsBox(wBox)) {
            camera.position.x = oldPos.x;
            camera.position.z = oldPos.z;
            break;
        }
    }

    // 2. Гравитация и лестницы (Лучик вниз проверяет пол)
    let targetY = 1.7;
    const rayOrigin = camera.position.clone();
    rayOrigin.y += 2; // Бросаем луч сверху вниз
    const downRay = new THREE.Raycaster(rayOrigin, new THREE.Vector3(0, -1, 0));
    const intersects = downRay.intersectObjects(floors);
    
    if(intersects.length > 0) {
        targetY = intersects[0].point.y + 1.7; // 1.7 = Рост игрока
    }
    camera.position.y += (targetY - camera.position.y) * 0.2; // Плавный подъем по ступенькам
}

function checkInteractions() {
    if(!isGameRunning) return;
    
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = ray.intersectObjects(interactables);

    promptText.innerText = "";
    interactionTarget = null;

    if (hits.length > 0 && hits[0].distance < 3) {
        let obj = hits[0].object;
        interactionTarget = obj;

        if(obj.userData.isItem) {
            promptText.innerText = `[E] ПОДОБРАТЬ: ${obj.userData.name}`;
        } else if(obj.userData.isDoor) {
            let req = obj.userData.reqItems;
            let missing = req.filter(i => !inventory.includes(i));
            
            if(missing.length === 0) promptText.innerText = `[E] ОТКРЫТЬ ДВЕРЬ И СБЕЖАТЬ!`;
            else promptText.innerText = `НУЖНО ПРЕДМЕТОВ: ${req.length - missing.length}/${req.length}\n(Нужен: ${missing[0]})`;
        }
    }

    // Обработка кнопки E
    if (keys.e && interactionTarget) {
        if (interactionTarget.userData.isItem) {
            inventory.push(interactionTarget.userData.name);
            scene.remove(interactionTarget);
            interactables.splice(interactables.indexOf(interactionTarget), 1);
            
            // Обновляем список в UI
            inventoryList.innerHTML = "";
            inventory.forEach(item => {
                let li = document.createElement('li');
                li.innerText = "> " + item;
                inventoryList.appendChild(li);
            });
        } 
        else if (interactionTarget.userData.isDoor) {
            let missing = interactionTarget.userData.reqItems.filter(i => !inventory.includes(i));
            if(missing.length === 0) triggerWin();
        }
        keys.e = false;
    }
}

function triggerWin() {
    isGameRunning = false;
    document.exitPointerLock();
    document.getElementById('screamer-overlay').classList.remove('hidden');
    document.getElementById('scream-sound').play().catch(()=>{});
    
    setTimeout(() => {
        alert("ВЫ СБЕЖАЛИ! ИГРА ПРОЙДЕНА!");
        location.reload();
    }, 2000);
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock?.getDelta() || 0;
    updatePhysics(delta);
    checkInteractions();
    if(renderer) renderer.render(scene, camera);
}

// === ЗАПУСК ИГРЫ И КАТСЦЕНЫ ===
document.getElementById('btn-start').onclick = () => {
    uiMenu.classList.add('hidden');
    uiVideo.classList.remove('hidden');

    // Предохранитель: если видео не найдено, игра всё равно начнется!
    introVideo.onerror = startGame; 
    introVideo.onended = startGame;

    introVideo.play().catch(err => {
        console.warn("Браузер заблокировал автовоспроизведение видео", err);
        startGame();
    });
};

function startGame() {
    uiVideo.classList.add('hidden');
    uiHud.classList.remove('hidden');
    init3D();
    isGameRunning = true;
    document.body.requestPointerLock();
}

window.addEventListener('resize', () => {
    if(camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
});
