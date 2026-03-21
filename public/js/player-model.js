class PlayerModelViewer {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            width: options.width || container.clientWidth || 200,
            height: options.height || container.clientHeight || 280,
            modelPath: options.modelPath || '/assets/models/player.fbx',
            autoRotate: options.autoRotate || false,
            backgroundColor: options.backgroundColor || null,
            isProfile: options.isProfile || false
        };

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.model = null;
        this.mixer = null;
        this.isDestroyed = false;
        this.clock = new THREE.Clock();

        // Mouse rotation
        this.isDragging = false;
        this.previousMouseX = 0;
        this.modelRotationY = Math.PI + 0.3;
        this.targetRotationY = Math.PI + 0.3;

        this.init();
    }

    init() {
        this.scene = new THREE.Scene();

        if (this.options.backgroundColor !== null) {
            this.scene.background = new THREE.Color(this.options.backgroundColor);
        }

        this.camera = new THREE.PerspectiveCamera(
            40,
            this.options.width / this.options.height,
            0.01,
            1000
        );

        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: this.options.backgroundColor === null
        });
        this.renderer.setSize(this.options.width, this.options.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.toneMapping = THREE.NoToneMapping;

        this.container.innerHTML = '';
        this.container.appendChild(this.renderer.domElement);

        if (this.options.isProfile) {
            this.setupMouseControls();
        }

        this.setupLights();
        this.loadModel();
        this.animate();
    }

    setupMouseControls() {
        const canvas = this.renderer.domElement;
        canvas.style.cursor = 'grab';

        canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.previousMouseX = e.clientX;
            canvas.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            const deltaX = e.clientX - this.previousMouseX;
            this.targetRotationY += deltaX * 0.012;
            this.previousMouseX = e.clientX;
        });

        window.addEventListener('mouseup', () => {
            this.isDragging = false;
            canvas.style.cursor = 'grab';
        });

        canvas.addEventListener('touchstart', (e) => {
            this.isDragging = true;
            this.previousMouseX = e.touches[0].clientX;
        });

        canvas.addEventListener('touchmove', (e) => {
            if (!this.isDragging) return;
            e.preventDefault();
            const deltaX = e.touches[0].clientX - this.previousMouseX;
            this.targetRotationY += deltaX * 0.012;
            this.previousMouseX = e.touches[0].clientX;
        }, { passive: false });

        canvas.addEventListener('touchend', () => {
            this.isDragging = false;
        });
    }

    setupLights() {
        // Основной ambient — мягкий общий свет
        const ambient = new THREE.AmbientLight(0xffffff, 1.0);
        this.scene.add(ambient);

        // Фронтальный свет — освещает лицо
        const frontLight = new THREE.DirectionalLight(0xffffff, 0.8);
        frontLight.position.set(0, 1, 2);
        this.scene.add(frontLight);

        // Верхний свет
        const topLight = new THREE.DirectionalLight(0xffffff, 0.4);
        topLight.position.set(0, 3, 0);
        this.scene.add(topLight);

        // Левый боковой
        const leftLight = new THREE.DirectionalLight(0xffffff, 0.2);
        leftLight.position.set(-2, 1, 0);
        this.scene.add(leftLight);

        // Правый боковой
        const rightLight = new THREE.DirectionalLight(0xffffff, 0.2);
        rightLight.position.set(2, 1, 0);
        this.scene.add(rightLight);
    }

    loadModel() {
        const loader = new THREE.FBXLoader();

        loader.load(
            this.options.modelPath,
            (fbx) => {
                this.model = fbx;

                const box = new THREE.Box3().setFromObject(this.model);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());

                if (this.options.isProfile) {
                    // Ставим ноги на уровень 0, центрируем по X и Z
                    this.model.position.set(
                        -center.x,
                        -box.min.y,
                        -center.z
                    );

                    // Рассчитываем дистанцию камеры чтобы всё тело влезло
                    const fov = this.camera.fov * (Math.PI / 180);
                    const aspect = this.options.width / this.options.height;

                    const fitH = (size.y * 1.2) / (2 * Math.tan(fov / 2));
                    const fitW = fitH / aspect;
                    const cameraZ = Math.max(fitH, fitW) * 1.05;

                    // Смотрим на центр тела по высоте
                    const lookAtY = size.y * 0.5;

                    this.camera.position.set(0, lookAtY, cameraZ);
                    this.camera.lookAt(0, lookAtY, 0);

                } else {
                    // Bust/голова для маленьких аватарок
                    this.model.position.set(
                        -center.x,
                        -center.y,
                        -center.z
                    );

                    const headY = size.y * 0.28;
                    const cameraZ = size.y * 0.65;

                    this.camera.position.set(0, headY, cameraZ);
                    this.camera.lookAt(0, headY, 0);
                }

                this.model.rotation.y = this.modelRotationY;
                this.targetRotationY = this.modelRotationY;

                // Анимации
                if (fbx.animations && fbx.animations.length > 0) {
                    this.mixer = new THREE.AnimationMixer(this.model);

                    let idleClip = null;
                    for (const clip of fbx.animations) {
                        if (clip.name.toLowerCase().includes('idle')) {
                            idleClip = clip;
                            break;
                        }
                    }

                    // Если idle не найден — берём первую анимацию
                    if (!idleClip) {
                        idleClip = fbx.animations[0];
                    }

                    if (idleClip) {
                        const action = this.mixer.clipAction(idleClip);
                        action.play();
                    }
                }

                // Материалы
                this.model.traverse((child) => {
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

                this.scene.add(this.model);

                // Скрываем placeholder
                const placeholder = this.container.closest('.profile-avatar-frame')
                    ?.querySelector('.avatar-placeholder');
                if (placeholder) {
                    placeholder.style.opacity = '0';
                    setTimeout(() => placeholder.remove(), 300);
                }

                console.log('[PlayerModel] ✓ Loaded | size:', size);
            },
            (xhr) => {
                if (xhr.total) {
                    const pct = Math.round((xhr.loaded / xhr.total) * 100);
                    const percentEl = this.container.querySelector('.percent');
                    if (percentEl) percentEl.textContent = pct + '%';
                }
            },
            (error) => {
                console.error('[PlayerModel] ✗ Error:', error);
                this.showError();
            }
        );
    }

    showError() {
        this.container.innerHTML = `
            <div style="
                display:flex;
                align-items:center;
                justify-content:center;
                height:100%;
                color:#555;
                font-size:12px;
                text-align:center;
                padding:10px;
                font-family:'General Sans',sans-serif;
            ">
                <div>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
                        style="width:32px;height:32px;margin-bottom:8px;display:block;margin-left:auto;margin-right:auto;">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    Failed to load model
                </div>
            </div>
        `;
    }

    animate() {
        if (this.isDestroyed) return;

        requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();
        if (this.mixer) {
            this.mixer.update(delta);
        }

        // Плавное вращение
        if (this.model && this.options.isProfile) {
            this.modelRotationY += (this.targetRotationY - this.modelRotationY) * 0.1;
            this.model.rotation.y = this.modelRotationY;
        }

        this.renderer.render(this.scene, this.camera);
    }

    destroy() {
        this.isDestroyed = true;
        if (this.mixer) this.mixer.stopAllAction();
        if (this.renderer) this.renderer.dispose();
        if (this.scene) {
            this.scene.traverse((obj) => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                    mats.forEach(m => m.dispose());
                }
            });
        }
        this.container.innerHTML = '';
    }
}

// ============================================
// Profile Page
// ============================================

function initProfileModel() {
    const content = document.getElementById('profile-content');
    if (!content) return;

    const tryInit = () => {
        const avatar = content.querySelector('.profile-avatar:not(.model-init)');
        if (!avatar) return;

        avatar.classList.add('model-init');

        const initWithSize = () => {
            const w = avatar.clientWidth || 380;
            const h = avatar.clientHeight || 280;

            // Ждём пока контейнер получит реальные размеры
            if (w < 10 || h < 10) {
                requestAnimationFrame(initWithSize);
                return;
            }

            new PlayerModelViewer(avatar, {
                width: w,
                height: h,
                autoRotate: false,
                backgroundColor: null,
                isProfile: true
            });
        };

        initWithSize();
    };

    tryInit();

    const observer = new MutationObserver(() => {
        tryInit();
    });

    observer.observe(content, { childList: true, subtree: true });
}

// ============================================
// Users Page
// ============================================

function initUsersModels() {
    const grid = document.getElementById('users-grid');
    if (!grid) return;

    const viewers = [];

    const tryInitAvatars = () => {
        const avatars = grid.querySelectorAll('.user-avatar:not(.model-init)');
        avatars.forEach((avatar) => {
            avatar.classList.add('model-init');

            const viewer = new PlayerModelViewer(avatar, {
                width: avatar.clientWidth || 44,
                height: avatar.clientHeight || 44,
                autoRotate: false,
                backgroundColor: null,
                isProfile: false
            });

            viewers.push(viewer);
        });
    };

    tryInitAvatars();

    const observer = new MutationObserver(() => {
        tryInitAvatars();
    });

    observer.observe(grid, { childList: true, subtree: true });

    window.addEventListener('beforeunload', () => {
        viewers.forEach(v => v.destroy());
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
});