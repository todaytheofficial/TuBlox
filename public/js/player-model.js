// ============================================
// PLAYER MODEL RENDERER
// Profile: полное тело (голова до ног)
// Users: верхняя половина тела + лицо (бюст)
// ============================================

class PlayerModelRenderer {
    constructor(options = {}) {
        this.modelPath = options.modelPath || '/assets/models/player.fbx';
        this.cache = {
            bust: null,    // верхняя часть тела + лицо (для Users)
            full: null     // полное тело (для Profile)
        };
        this.model = null;
        this.isLoading = false;
        this.loadCallbacks = [];
    }

    load() {
        if (this.cache.bust && this.cache.full) {
            return Promise.resolve();
        }
        if (this.isLoading) {
            return new Promise((resolve) => {
                this.loadCallbacks.push(resolve);
            });
        }

        this.isLoading = true;

        return new Promise((resolve, reject) => {
            if (typeof THREE === 'undefined') {
                console.warn('[PlayerModel] THREE.js not loaded, using fallback');
                this.generateFallback();
                resolve();
                return;
            }

            const loader = new THREE.FBXLoader();

            loader.load(
                this.modelPath,
                (fbx) => {
                    this.model = fbx;
                    this.processModel(fbx);

                    // ==============================
                    // Рендерим ОБА кадра один раз
                    // ==============================
                    this.cache.bust = this.renderShot(fbx, 'bust');
                    this.cache.full = this.renderShot(fbx, 'full');

                    this.isLoading = false;
                    console.log('[PlayerModel] ✓ Оба кадра отрендерены');

                    resolve();
                    this.loadCallbacks.forEach(cb => cb());
                    this.loadCallbacks = [];
                },
                undefined,
                (error) => {
                    console.error('[PlayerModel] ✗ Ошибка:', error);
                    this.generateFallback();
                    this.isLoading = false;
                    resolve();
                    this.loadCallbacks.forEach(cb => cb());
                    this.loadCallbacks = [];
                }
            );
        });
    }

    processModel(fbx) {
        fbx.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                if (child.material) {
                    const mats = Array.isArray(child.material)
                        ? child.material
                        : [child.material];
                    mats.forEach(m => {
                        m.metalness = 0;
                        m.roughness = 1;
                        m.emissive = new THREE.Color(0x000000);
                        m.emissiveIntensity = 0;
                    });
                }
            }
        });
    }

    // ============================================
    // ГЛАВНАЯ ФУНКЦИЯ — разная камера для каждого типа
    // ============================================
    renderShot(fbx, type) {

        // ----------------------------------------
        // Размеры канваса
        // ----------------------------------------
        let width, height;

        if (type === 'full') {
            // Profile — высокий вертикальный кадр
            width  = 400;
            height = 550;
        } else {
            // Users (bust) — квадратный / чуть вертикальный
            width  = 200;
            height = 200;
        }

        // ----------------------------------------
        // Сцена
        // ----------------------------------------
        const scene = new THREE.Scene();

        const camera = new THREE.PerspectiveCamera(
            type === 'full' ? 35 : 30,   // FOV уже для буста → крупнее лицо
            width / height,
            0.01,
            1000
        );

        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,                  // прозрачный фон
            preserveDrawingBuffer: true
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(2);        // чёткость ×2
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.outputEncoding = THREE.sRGBEncoding;

        // ----------------------------------------
        // Освещение — мягкое, равномерное
        // ----------------------------------------
        const ambient = new THREE.AmbientLight(0xffffff, 1.0);
        scene.add(ambient);

        const frontLight = new THREE.DirectionalLight(0xffffff, 0.8);
        frontLight.position.set(0, 1, 3);
        scene.add(frontLight);

        const topLight = new THREE.DirectionalLight(0xffffff, 0.5);
        topLight.position.set(0, 4, 0);
        scene.add(topLight);

        const leftLight = new THREE.DirectionalLight(0xffffff, 0.25);
        leftLight.position.set(-3, 1, 1);
        scene.add(leftLight);

        const rightLight = new THREE.DirectionalLight(0xffffff, 0.25);
        rightLight.position.set(3, 1, 1);
        scene.add(rightLight);

        // Подсветка снизу чтобы ноги не были чёрными
        const bottomLight = new THREE.DirectionalLight(0xffffff, 0.15);
        bottomLight.position.set(0, -2, 1);
        scene.add(bottomLight);

        // ----------------------------------------
        // Клонируем модель
        // ----------------------------------------
        const clone = fbx.clone();

        // Лёгкий поворот — 3/4 вид, как в Roblox
        clone.rotation.y = Math.PI + 0.3;

        // Считаем размеры модели
        const box    = new THREE.Box3().setFromObject(clone);
        const size   = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // ============================================
        // FULL — ПРОФИЛЬ: всё тело от ног до головы
        // Камера статична, видно полностью
        // ============================================
        if (type === 'full') {

            // Ставим модель так чтобы ноги были внизу
            clone.position.set(
                -center.x,
                -box.min.y,      // ноги на y=0
                -center.z
            );

            // Камера смотрит на центр тела
            const bodyCenter = size.y * 0.48;

            // Расстояние чтобы вся модель влезла
            const fovRad   = camera.fov * (Math.PI / 180);
            const fitDist  = (size.y * 1.2) / (2 * Math.tan(fovRad / 2));
            const cameraZ  = Math.max(fitDist, size.y * 0.9);

            camera.position.set(0, bodyCenter, cameraZ);
            camera.lookAt(0, bodyCenter, 0);

        }

        // ============================================
        // BUST — USERS: верхняя половина тела + лицо
        // Камера ближе, обрезает ниже пояса
        // ============================================
        else {

            // Ставим модель — ноги на y=0
            clone.position.set(
                -center.x,
                -box.min.y,
                -center.z
            );

            // Точка фокуса — верхняя часть тела
            // ~70% высоты = грудь/шея, чтобы лицо было в кадре
            const focusY = size.y * 0.72;

            // Камера ближе — показывает только верх
            const cameraZ = size.y * 0.55;

            camera.position.set(0, focusY, cameraZ);
            camera.lookAt(0, focusY, 0);
        }

        scene.add(clone);

        // ----------------------------------------
        // Рендер одного кадра
        // ----------------------------------------
        renderer.render(scene, camera);

        // Сохраняем как PNG
        const dataUrl = renderer.domElement.toDataURL('image/png');

        // ----------------------------------------
        // Очистка памяти
        // ----------------------------------------
        renderer.dispose();
        scene.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                const mats = Array.isArray(obj.material)
                    ? obj.material
                    : [obj.material];
                mats.forEach(m => m.dispose());
            }
        });

        return dataUrl;
    }

    // ============================================
    // Фоллбэк если модель не загрузилась
    // ============================================
    generateFallback() {
        // Bust fallback — лицо + плечи
        const bustSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
            <rect x="25" y="55" width="50" height="40" rx="8" fill="#666"/>
            <rect x="10" y="60" width="18" height="30" rx="6" fill="#666"/>
            <rect x="72" y="60" width="18" height="30" rx="6" fill="#666"/>
            <rect x="38" y="45" width="24" height="14" rx="4" fill="#ccc"/>
            <rect x="25" y="8" width="50" height="42" rx="10" fill="#ccc"/>
            <rect x="25" y="5" width="50" height="18" rx="8" fill="#3a3a3a"/>
            <ellipse cx="38" cy="30" rx="5" ry="6" fill="#fff"/>
            <ellipse cx="62" cy="30" rx="5" ry="6" fill="#fff"/>
            <circle cx="39" cy="31" r="3" fill="#222"/>
            <circle cx="63" cy="31" r="3" fill="#222"/>
            <path d="M42 42 Q50 48 58 42" stroke="#555" stroke-width="2" fill="none" stroke-linecap="round"/>
        </svg>`;

        // Full body fallback — всё тело
        const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 200">
            <ellipse cx="50" cy="195" rx="25" ry="5" fill="rgba(0,0,0,0.1)"/>
            <rect x="32" y="120" width="14" height="55" rx="4" fill="#555"/>
            <rect x="54" y="120" width="14" height="55" rx="4" fill="#555"/>
            <rect x="30" y="170" width="18" height="10" rx="3" fill="#333"/>
            <rect x="52" y="170" width="18" height="10" rx="3" fill="#333"/>
            <rect x="28" y="65" width="44" height="58" rx="6" fill="#666"/>
            <rect x="12" y="68" width="14" height="45" rx="5" fill="#666"/>
            <rect x="74" y="68" width="14" height="45" rx="5" fill="#666"/>
            <rect x="14" y="110" width="10" height="12" rx="4" fill="#ccc"/>
            <rect x="76" y="110" width="10" height="12" rx="4" fill="#ccc"/>
            <rect x="42" y="55" width="16" height="14" rx="3" fill="#ccc"/>
            <rect x="30" y="15" width="40" height="45" rx="8" fill="#ccc"/>
            <rect x="30" y="12" width="40" height="18" rx="6" fill="#3a3a3a"/>
            <ellipse cx="40" cy="38" rx="4" ry="5" fill="#fff"/>
            <ellipse cx="60" cy="38" rx="4" ry="5" fill="#fff"/>
            <circle cx="41" cy="39" r="2.5" fill="#222"/>
            <circle cx="61" cy="39" r="2.5" fill="#222"/>
            <path d="M42 50 Q50 56 58 50" stroke="#555" stroke-width="2" fill="none" stroke-linecap="round"/>
        </svg>`;

        this.cache.bust = 'data:image/svg+xml;base64,' + btoa(bustSvg);
        this.cache.full = 'data:image/svg+xml;base64,' + btoa(fullSvg);
    }

    getBustImage() { return this.cache.bust; }
    getFullImage() { return this.cache.full; }
}

// ============================================
// ГЛОБАЛЬНЫЙ ЭКЗЕМПЛЯР
// ============================================

const playerRenderer = new PlayerModelRenderer();

// ============================================
// Применить аватар к контейнеру
// ============================================

function applyAvatar(container, type) {
    if (!container || container.classList.contains('avatar-done')) return;
    container.classList.add('avatar-done');

    const src = type === 'full'
        ? playerRenderer.getFullImage()
        : playerRenderer.getBustImage();

    if (!src) return;

    // Удаляем плейсхолдер
    const placeholder = container.querySelector('.avatar-placeholder');
    if (placeholder) placeholder.remove();

    const img = document.createElement('img');
    img.src = src;
    img.alt = 'Player';
    img.draggable = false;

    if (type === 'full') {
        // Profile — contain чтобы не обрезать
        img.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: contain;
            display: block;
        `;
    } else {
        // Users — cover чтобы заполнить квадрат
        img.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
            border-radius: inherit;
        `;
    }

    container.innerHTML = '';
    container.appendChild(img);

    // Убираем плейсхолдер в родительском фрейме
    if (type === 'full') {
        const fp = container.closest('.profile-avatar-frame')
            ?.querySelector('.avatar-placeholder');
        if (fp) fp.remove();
    }
}

// ============================================
// Profile Page — полное тело
// ============================================

function initProfileModel() {
    const content = document.getElementById('profile-content');
    if (!content) return;

    const tryInit = () => {
        const avatar = content.querySelector('.profile-avatar:not(.avatar-done)');
        if (!avatar) return;
        applyAvatar(avatar, 'full');   // ← ПОЛНОЕ ТЕЛО
    };

    playerRenderer.load().then(() => {
        tryInit();
        const observer = new MutationObserver(() => tryInit());
        observer.observe(content, { childList: true, subtree: true });
    });
}

// ============================================
// Users Page — верхняя половина + лицо
// ============================================

function initUsersModels() {
    const grid = document.getElementById('users-grid');
    if (!grid) return;

    const tryInit = () => {
        const avatars = grid.querySelectorAll('.user-avatar:not(.avatar-done)');
        avatars.forEach(a => applyAvatar(a, 'bust'));  // ← БЮСТ
    };

    playerRenderer.load().then(() => {
        tryInit();
        const observer = new MutationObserver(() => tryInit());
        observer.observe(grid, { childList: true, subtree: true });
    });
}

// ============================================
// Home Page — бюст
// ============================================

function initHomeAvatar() {
    const avatar = document.getElementById('home-avatar');
    if (!avatar) return;

    playerRenderer.load().then(() => {
        applyAvatar(avatar, 'bust');
    });
}

// ============================================
// Init
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.profile-page')) {
        initProfileModel();
    }
    if (document.querySelector('.users-page')) {
        initUsersModels();
    }
    if (document.querySelector('.home-page')) {
        initHomeAvatar();
    }
});