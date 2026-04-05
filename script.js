// Основные переменные
let scene, camera, renderer, clock;
let isStarted = false, isPaused = false;
let keys = {};
let objects = { walls: [], items: [] };
let stamina = 100;

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050000);
    scene.fog = new THREE.FogExp2(0x050000, 0.1);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.7, 5);

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;

    // Свет (как в Unity/Granny)
    const ambient = new THREE.AmbientLight(0xffffff, 0.05);
    scene.add(ambient);

    const flashlight = new THREE.SpotLight(0xffffff, 2, 20, Math.PI / 6, 0.5);
    flashlight.castShadow = true;
    camera.add(flashlight);
    camera.add(flashlight.target);
    flashlight.target.position.z = -1;
    scene.add(camera);

    createMap();
    setupEvents();
    animate();
}

function createMap() {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

    // Пол
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Пример стен (Домина)
    addWall(0, 0, -10, 20, 5, 1, wallMat);
    addWall(-10, 0, 0, 1, 5, 20, wallMat);
    addWall(10, 0, 0, 1, 5, 20, wallMat);
}

function addWall(x, y, z, w, h, d, mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    objects.walls.push(new THREE.Box3().setFromObject(mesh));
}

function setupEvents() {
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

    document.getElementById('btn-resume').onclick = togglePause;

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
    document.getElementById('pause-menu').classList.toggle('hidden', !isPaused);
    if (!isPaused) document.body.requestPointerLock();
    else document.exitPointerLock();
}

function animate() {
    requestAnimationFrame(animate);
    if (!isStarted || isPaused) return;

    // Движение
    let dir = new THREE.Vector3();
    if (keys['KeyW']) dir.z -= 1;
    if (keys['KeyS']) dir.z += 1;
    if (keys['KeyA']) dir.x -= 1;
    if (keys['KeyD']) dir.x += 1;

    if (dir.length() > 0) {
        dir.normalize().applyQuaternion(camera.quaternion);
        dir.y = 0;
        
        const speed = keys['ShiftLeft'] && stamina > 0 ? 0.15 : 0.07;
        if (keys['ShiftLeft'] && stamina > 0) stamina -= 0.5;
        else stamina = Math.min(100, stamina + 0.2);

        camera.position.add(dir.multiplyScalar(speed));
        document.getElementById('stamina-fill').style.width = stamina + "%";
    }

    renderer.render(scene, camera);
}

// Запуск
window.onload = init;
