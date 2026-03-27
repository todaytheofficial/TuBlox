// ============================================
// PLAYER MODEL RENDERER
// Renders FBX model → takes screenshot → shows as static image
// Like Roblox: bust for users, full body for profile
// ============================================

class PlayerModelRenderer {
    constructor(options = {}) {
        this.modelPath = options.modelPath || '/assets/models/player.fbx';
        this.cache = {
            bust: null,    // data URL for head/bust shot
            full: null     // data URL for full body shot
        };
        this.model = null;
        this.isLoading = false;
        this.loadCallbacks = [];
    }

    // Load model once, generate both images
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
            // Check if THREE is available
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

                    // Render bust shot
                    this.cache.bust = this.renderShot(fbx, 'bust');
                    // Render full body shot
                    this.cache.full = this.renderShot(fbx, 'full');

                    this.isLoading = false;
                    console.log('[PlayerModel] ✓ Rendered both shots');

                    resolve();
                    this.loadCallbacks.forEach(cb => cb());
                    this.loadCallbacks = [];
                },
                undefined,
                (error) => {
                    console.error('[PlayerModel] ✗ Error:', error);
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
                    const mats = Array.isArray(child.material) ? child.material : [child.material];
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

    renderShot(fbx, type) {
        // Create offscreen renderer
        const width = type === 'bust' ? 150 : 400;
        const height = type === 'bust' ? 150 : 500;

        const scene = new THREE.Scene();

        const camera = new THREE.PerspectiveCamera(40, width / height, 0.01, 1000);

        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(2);
        renderer.toneMapping = THREE.NoToneMapping;

        // Lights
        const ambient = new THREE.AmbientLight(0xffffff, 1.0);
        scene.add(ambient);

        const frontLight = new THREE.DirectionalLight(0xffffff, 0.8);
        frontLight.position.set(0, 1, 2);
        scene.add(frontLight);

        const topLight = new THREE.DirectionalLight(0xffffff, 0.4);
        topLight.position.set(0, 3, 0);
        scene.add(topLight);

        const leftLight = new THREE.DirectionalLight(0xffffff, 0.2);
        leftLight.position.set(-2, 1, 0);
        scene.add(leftLight);

        const rightLight = new THREE.DirectionalLight(0xffffff, 0.2);
        rightLight.position.set(2, 1, 0);
        scene.add(rightLight);

        // Clone model for independent positioning
        const clone = fbx.clone();
        clone.rotation.y = Math.PI + 0.3;

        const box = new THREE.Box3().setFromObject(clone);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        if (type === 'full') {
            // Full body — feet at bottom, whole character visible
            clone.position.set(-center.x, -box.min.y, -center.z);

            const fov = camera.fov * (Math.PI / 180);
            const fitH = (size.y * 1.15) / (2 * Math.tan(fov / 2));
            const cameraZ = fitH * 1.05;
            const lookAtY = size.y * 0.48;

            camera.position.set(0, lookAtY, cameraZ);
            camera.lookAt(0, lookAtY, 0);
        } else {
            // Bust — head and shoulders like Roblox thumbnail
            clone.position.set(-center.x, -center.y, -center.z);

            const headY = size.y * 0.30;
            const cameraZ = size.y * 0.55;

            camera.position.set(0, headY, cameraZ);
            camera.lookAt(0, headY, 0);
        }

        scene.add(clone);

        // Render single frame
        renderer.render(scene, camera);

        // Extract image
        const dataUrl = renderer.domElement.toDataURL('image/png');

        // Cleanup
        renderer.dispose();
        scene.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();
        });

        return dataUrl;
    }

    generateFallback() {
        // SVG fallback if model fails to load
        const bustSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50">
            <rect x="5" y="8" width="40" height="38" rx="8" fill="#ccc"/>
            <rect x="5" y="5" width="40" height="15" rx="6" fill="#3a3a3a"/>
            <ellipse cx="18" cy="26" rx="3.5" ry="4" fill="#fff"/>
            <ellipse cx="32" cy="26" rx="3.5" ry="4" fill="#fff"/>
            <circle cx="19" cy="27" r="2" fill="#222"/>
            <circle cx="33" cy="27" r="2" fill="#222"/>
            <path d="M20 35 Q25 39 30 35" stroke="#555" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        </svg>`;

        const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 200">
            <ellipse cx="50" cy="195" rx="25" ry="5" fill="rgba(0,0,0,0.15)"/>
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
// GLOBAL INSTANCE — one renderer for all
// ============================================

const playerRenderer = new PlayerModelRenderer();

// ============================================
// Apply avatar to container
// ============================================

function applyAvatar(container, type) {
    if (!container || container.classList.contains('avatar-done')) return;
    container.classList.add('avatar-done');

    const src = type === 'full' ? playerRenderer.getFullImage() : playerRenderer.getBustImage();
    if (!src) return;

    // Remove placeholder
    const placeholder = container.querySelector('.avatar-placeholder');
    if (placeholder) placeholder.remove();

    const img = document.createElement('img');
    img.src = src;
    img.alt = 'Player';
    img.draggable = false;

    if (type === 'full') {
        img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;';
    } else {
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit;';
    }

    container.innerHTML = '';
    container.appendChild(img);

    // Frame placeholder too
    if (type === 'full') {
        const fp = container.closest('.profile-avatar-frame')?.querySelector('.avatar-placeholder');
        if (fp) fp.remove();
    }
}

// ============================================
// Profile Page
// ============================================

function initProfileModel() {
    const content = document.getElementById('profile-content');
    if (!content) return;

    const tryInit = () => {
        const avatar = content.querySelector('.profile-avatar:not(.avatar-done)');
        if (!avatar) return;
        applyAvatar(avatar, 'full');
    };

    // Load model then apply
    playerRenderer.load().then(() => {
        tryInit();

        const observer = new MutationObserver(() => tryInit());
        observer.observe(content, { childList: true, subtree: true });
    });
}

// ============================================
// Users Page
// ============================================

function initUsersModels() {
    const grid = document.getElementById('users-grid');
    if (!grid) return;

    const tryInit = () => {
        const avatars = grid.querySelectorAll('.user-avatar:not(.avatar-done)');
        avatars.forEach(a => applyAvatar(a, 'bust'));
    };

    playerRenderer.load().then(() => {
        tryInit();

        const observer = new MutationObserver(() => tryInit());
        observer.observe(grid, { childList: true, subtree: true });
    });
}

// ============================================
// Home Page
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