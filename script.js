import * as THREE from 'three';

// === КОНФИГУРАЦИЯ ИГРЫ ===
const CONFIG = {
    speed: 4.0,           // Базовая скорость
    runSpeed: 7.0,        // Скорость бега
    inertia: 0.15,        // Инерция (Phasmophobia style)
    mouseSens: 0.002,     // Чувствительность мыши
    staminaDrain: 20,     // Трата выносливости в секунду
    staminaRegen: 10      // Восстановление
};

// === ПЕРЕМЕННЫЕ ===
let scene, camera, renderer, clock;
let isGameRunning = false;
let keys = { w: false, a: false, s: false, d: false, shift: false, e: false };
let velocity = new THREE.Vector3();
let playerDirection = new THREE.Vector3();
let stamina = 100;
let inventory = [];
let interactionTarget = null;

// Коллизии (стены)
const wallBoundingBoxes = [];
const playerBox = new THREE.Box3();

// Элементы UI
const uiMainMenu = document.getElementById('main-menu');
const uiVideoContainer = document.getElementById('video-container');
const uiGameHud = document.getElementById('game-hud');
const introVideo = document.getElementById('intro-video');
const interactionPrompt = document.getElementById('interaction-prompt');
const staminaBar = document.getElementById('stamina-bar');
const inventoryList = document.getElementById('inventory-list');
const screamerOverlay = document.getElementById('screamer-overlay');
const screamSound = document.getElementById('scream-sound');

// === ИНИЦИАЛИЗАЦИЯ 3D ===
function init3D() {
    const canvas = document.getElementById('game-canvas');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x010101); // Очень темный фон
    scene.fog = new THREE.FogExp2(0x010101, 0.12); // Густой туман

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 1.7, 0); // Высота человека
    scene.add(camera);

    // ОСВЕЩЕНИЕ (Исправлено - теперь видно!)
    // 1. Тусклый общий свет, чтобы не было кромешной тьмы
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2); 
    scene.add(ambientLight);

    // 2. Фонарик игрока (Phasmophobia style)
    const flashlight = new THREE.SpotLight(0xffeedd, 3, 25, Math.PI / 5, 0.5, 1.5);
    flashlight.castShadow = true;
    flashlight.position.set(0, 0, 0);
    camera.add(flashlight);
    camera.add(flashlight.target);
    flashlight.target.position.set(0, 0, -1);

    clock = new THREE.Clock();
    buildLevel();
    setupControls();
    
    // Запуск цикла рендера
    animate();
}

// === ГЕНЕРАЦИЯ УРОВНЯ (ПОДВАЛ) ===
function buildLevel() {
    // Текстуры материалов (базовые цвета)
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x2c2520, roughness: 1.0 });

    // Пол
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Потолок
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), wallMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 4;
    scene.add(ceiling);

    // Функция создания стен с коллизией
    function createWall(x, z, width, depth) {
        const geo = new THREE.BoxGeometry(width, 4, depth);
        const wall = new THREE.Mesh(geo, wallMat);
        wall.position.set(x, 2, z);
        wall.castShadow = true;
        wall.receiveShadow = true;
        scene.add(wall);
        
        // Добавляем невидимую коробку для физики (чтобы не проходить сквозь)
        const box = new THREE.Box3().setFromObject(wall);
        wallBoundingBoxes.push(box);
    }

    // Внешние стены подвала
    createWall(0, -15, 30, 1); // Передняя
    createWall(0, 15, 30, 1);  // Задняя
    createWall(-15, 0, 1, 30); // Левая
    createWall(15, 0, 1, 30);  // Правая

    // Внутренние стены (Лабиринт для усложнения)
    createWall(-5, -5, 10, 1);
    createWall(5, 5, 1, 10);
    createWall(-10, 8, 5, 1);

    // === ПРЕДМЕТЫ И ИНТЕРАКТИВ ===
    const itemGeo = new THREE.BoxGeometry(0.4, 0.1, 0.2);
    
    // Ключ 1 (Легкий, на видном месте)
    const key1Mat = new THREE.MeshStandardMaterial({ color: 0xaaaa00 });
    const key1 = new THREE.Mesh(itemGeo, key1Mat);
    key1.position.set(-2, 0.5, -2);
    key1.userData = { type: 'key', id: 1, name: 'КЛЮЧ ОТ ПОДВАЛА (1/2)' };
    scene.add(key1);

    // Ключ 2 (Сложный, спрятан за углом)
    const key2Mat = new THREE.MeshStandardMaterial({ color: 0x00aa00 });
    const key2 = new THREE.Mesh(itemGeo, key2Mat);
    key2.position.set(12, 0.1, 12); // В дальнем углу на полу
    key2.userData = { type: 'key', id: 2, name: 'КЛЮЧ ОТ ПОДВАЛА (2/2)' };
    scene.add(key2);

    // Выходная дверь
    const doorGeo = new THREE.BoxGeometry(2, 3.8, 0.2);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x4a1515 }); // Красная дверь
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, 1.9, -14.8);
    door.userData = { type: 'door', reqKeys: 2 };
    scene.add(door);
    
    // Коллизия двери
    const doorBox = new THREE.Box3().setFromObject(door);
    wallBoundingBoxes.push(doorBox);
}

// === УПРАВЛЕНИЕ ===
function setupControls() {
    document.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if(keys.hasOwnProperty(key)) keys[key] = true;
    });
    
    document.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        if(keys.hasOwnProperty(key)) keys[key] = false;
    });

    document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === document.body && isGameRunning) {
            camera.rotation.y -= e.movementX * CONFIG.mouseSens;
            camera.rotation.x -= e.movementY * CONFIG.mouseSens;
            // Ограничение камеры по вертикали
            camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, camera.rotation.x));
        }
    });

    document.addEventListener('mousedown', () => {
        if(isGameRunning) document.body.requestPointerLock();
    });
}

// === ЛОГИКА ИГРЫ ===
function updatePhysics(delta) {
    if(!isGameRunning) return;

    // Стамина
    let isRunning = keys.shift && stamina > 0 && (keys.w || keys.s || keys.a || keys.d);
    let targetSpeed = isRunning ? CONFIG.runSpeed : CONFIG.speed;

    if (isRunning) {
        stamina -= CONFIG.staminaDrain * delta;
    } else {
        stamina = Math.min(100, stamina + CONFIG.staminaRegen * delta);
    }
    staminaBar.style.width = stamina + '%';

    // Вектор направления (Phasmophobia style movement)
    playerDirection.set(0, 0, 0);
    if (keys.w) playerDirection.z -= 1;
    if (keys.s) playerDirection.z += 1;
    if (keys.a) playerDirection.x -= 1;
    if (keys.d) playerDirection.x += 1;
    
    playerDirection.normalize();
    playerDirection.applyQuaternion(camera.quaternion);
    playerDirection.y = 0; // Не летаем

    // Инерция (плавное ускорение/замедление)
    let targetVelocity = playerDirection.multiplyScalar(targetSpeed);
    velocity.lerp(targetVelocity, CONFIG.inertia);

    // Сохраняем старую позицию на случай столкновения
    const oldPosition = camera.position.clone();

    // Двигаем камеру
    camera.position.addScaledVector(velocity, delta);
    
    // Эффект шагов (Head bobbing)
    if(velocity.lengthSq() > 0.1) {
        camera.position.y = 1.7 + Math.sin(clock.elapsedTime * (isRunning ? 12 : 8)) * 0.05;
    } else {
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, 1.7, 0.1);
    }

    // === ПРОВЕРКА КОЛЛИЗИЙ (Чтобы не ходить сквозь стены) ===
    // Создаем хитбокс вокруг игрока
    playerBox.setFromCenterAndSize(camera.position, new THREE.Vector3(0.6, 2, 0.6));
    
    let isColliding = false;
    for(let box of wallBoundingBoxes) {
        if(playerBox.intersectsBox(box)) {
            isColliding = true;
            break;
        }
    }

    // Если столкнулись - отменяем движение
    if(isColliding) {
        camera.position.copy(oldPosition);
        velocity.set(0,0,0);
    }
}

function checkInteraction() {
    if(!isGameRunning) return;

    // Луч из центра экрана
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(scene.children);

    interactionPrompt.innerText = "";
    interactionTarget = null;

    if (intersects.length > 0) {
        const obj = intersects[0].object;
        const distance = intersects[0].distance;

        if (distance < 2.5 && obj.userData) {
            interactionTarget = obj;
            
            if (obj.userData.type === 'key') {
                interactionPrompt.innerText = `[E] ПОДОБРАТЬ ${obj.userData.name}`;
            } 
            else if (obj.userData.type === 'door') {
                let keysCount = inventory.length;
                if(keysCount < obj.userData.reqKeys) {
                    interactionPrompt.innerText = `НУЖНО КЛЮЧЕЙ: ${keysCount} / ${obj.userData.reqKeys}`;
                } else {
                    interactionPrompt.innerText = "[E] ОТКРЫТЬ ДВЕРЬ";
                }
            }
        }
    }

    // Обработка нажатия E
    if (keys.e && interactionTarget) {
        if (interactionTarget.userData.type === 'key') {
            // Берем ключ
            inventory.push(interactionTarget.userData.name);
            scene.remove(interactionTarget);
            interactionTarget = null;
            updateInventoryUI();
            keys.e = false; // защита от залипания
        } 
        else if (interactionTarget.userData.type === 'door' && inventory.length >= 2) {
            // Победа/Переход дальше
            isGameRunning = false;
            document.exitPointerLock();
            triggerScreamer(); // Скример при выходе!
        }
    }
}

function updateInventoryUI() {
    inventoryList.innerHTML = "";
    inventory.forEach(item => {
        let li = document.createElement('li');
        li.innerText = "- " + item;
        inventoryList.appendChild(li);
    });
}

function triggerScreamer() {
    screamerOverlay.classList.remove('hidden');
    screamSound.play();
    setTimeout(() => {
        alert("ВЫ СБЕЖАЛИ ИЗ ПОДВАЛА... НО ВПЕРЕДИ ВЕСЬ ДОМ. (КОНЕЦ ДЕМО)");
        location.reload();
    }, 2000);
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    
    updatePhysics(delta);
    checkInteraction();
    
    renderer.render(scene, camera);
}

// === ПОСЛЕДОВАТЕЛЬНОСТЬ ЗАПУСКА ===
document.getElementById('btn-start').onclick = () => {
    uiMainMenu.classList.add('hidden');
    uiVideoContainer.classList.remove('hidden');
    
    // Запускаем катсцену
    introVideo.play().catch(e => {
        // Если браузер заблокировал автоплей
        console.log("Автоплей заблокирован", e);
        endCutscene(); 
    });

    introVideo.onended = endCutscene;
};

function endCutscene() {
    uiVideoContainer.classList.add('hidden');
    uiGameHud.classList.remove('hidden');
    init3D();
    isGameRunning = true;
    document.body.requestPointerLock();
}

// Адаптивность при изменении окна
window.addEventListener('resize', () => {
    if(camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
});
