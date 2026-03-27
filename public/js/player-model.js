// ============================================
// PLAYER MODEL RENDERER
// Renders FBX → screenshot → static image
// Bust for users list, Full body for profile
// ============================================

class PlayerModelRenderer {
    constructor(options = {}) {
        this.modelPath = options.modelPath || '/assets/models/player.fbx';
        this.cache = { bust: null, full: null };
        this.isLoading = false;
        this.loadCallbacks = [];
        this.fbx = null;
    }

    load() {
        if (this.cache.bust && this.cache.full) return Promise.resolve();
        if (this.isLoading) {
            return new Promise(r => this.loadCallbacks.push(r));
        }
        this.isLoading = true;

        return new Promise((resolve) => {
            if (typeof THREE === 'undefined' || typeof THREE.FBXLoader === 'undefined') {
                console.warn('[PlayerModel] THREE/FBXLoader not loaded, using SVG fallback');
                this.generateFallback();
                this.done(resolve);
                return;
            }

            new THREE.FBXLoader().load(
                this.modelPath,
                (fbx) => {
                    this.fbx = fbx;
                    this.fixMaterials(fbx);

                    // Measure model once
                    var box = new THREE.Box3().setFromObject(fbx);
                    var size = box.getSize(new THREE.Vector3());
                    var center = box.getCenter(new THREE.Vector3());
                    var minY = box.min.y;

                    console.log('[PlayerModel] Model size:', size.x.toFixed(2), size.y.toFixed(2), size.z.toFixed(2));

                    // Render both shots
                    this.cache.full = this.renderFullBody(fbx, size, center, minY);
                    this.cache.bust = this.renderBust(fbx, size, center, minY);

                    console.log('[PlayerModel] ✓ Both shots done');
                    this.done(resolve);
                },
                undefined,
                (err) => {
                    console.error('[PlayerModel] ✗ Load error:', err);
                    this.generateFallback();
                    this.done(resolve);
                }
            );
        });
    }

    done(resolve) {
        this.isLoading = false;
        resolve();
        this.loadCallbacks.forEach(cb => cb());
        this.loadCallbacks = [];
    }

    fixMaterials(fbx) {
        fbx.traverse(child => {
            if (!child.isMesh || !child.material) return;
            var mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(m => {
                m.metalness = 0;
                m.roughness = 1;
                if (m.emissive) {
                    m.emissive.set(0x000000);
                    m.emissiveIntensity = 0;
                }
            });
        });
    }

    createScene() {
        var scene = new THREE.Scene();
        // No background — transparent

        // Strong ambient
        scene.add(new THREE.AmbientLight(0xffffff, 1.3));

        // Front light — main
        var front = new THREE.DirectionalLight(0xffffff, 1.0);
        front.position.set(0, 2, 4);
        scene.add(front);

        // Top light
        var top = new THREE.DirectionalLight(0xffffff, 0.5);
        top.position.set(0, 6, 0);
        scene.add(top);

        // Left fill
        var left = new THREE.DirectionalLight(0xffffff, 0.35);
        left.position.set(-4, 2, 2);
        scene.add(left);

        // Right fill
        var right = new THREE.DirectionalLight(0xffffff, 0.35);
        right.position.set(4, 2, 2);
        scene.add(right);

        // Rim/back
        var back = new THREE.DirectionalLight(0xffffff, 0.2);
        back.position.set(0, 2, -3);
        scene.add(back);

        return scene;
    }

    createRenderer(w, h) {
        var renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true
        });
        renderer.setSize(w, h);
        renderer.setPixelRatio(2);
        renderer.toneMapping = THREE.NoToneMapping;
        return renderer;
    }

    cleanup(renderer, scene) {
        var dataUrl = renderer.domElement.toDataURL('image/png');
        renderer.dispose();
        try { renderer.forceContextLoss(); } catch (e) {}
        scene.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
        });
        return dataUrl;
    }

    // ── FULL BODY SHOT (for profile page) ──
    renderFullBody(fbx, size, center, minY) {
        var w = 512, h = 640;

        var scene = this.createScene();
        var camera = new THREE.PerspectiveCamera(28, w / h, 0.01, 1000);
        var renderer = this.createRenderer(w, h);

        var clone = fbx.clone();

        // Position: center X/Z, feet at y=0
        clone.position.set(-center.x, -minY, -center.z);

        // Slight angle like Roblox profile
        clone.rotation.y = Math.PI + 0.4;

        scene.add(clone);

        // Camera: fit full height with padding
        var bodyH = size.y;
        var fovRad = camera.fov * (Math.PI / 180);
        var dist = (bodyH * 1.2) / (2 * Math.tan(fovRad / 2));
        var lookY = bodyH * 0.45;

        camera.position.set(0, lookY, dist);
        camera.lookAt(0, lookY, 0);

        renderer.render(scene, camera);
        return this.cleanup(renderer, scene);
    }

    // ── BUST SHOT (for users list — head + shoulders) ──
    renderBust(fbx, size, center, minY) {
        var w = 200, h = 200;

        var scene = this.createScene();
        var camera = new THREE.PerspectiveCamera(25, w / h, 0.01, 1000);
        var renderer = this.createRenderer(w, h);

        var clone = fbx.clone();

        // Position: center X/Z, feet at y=0
        clone.position.set(-center.x, -minY, -center.z);

        // Slight angle
        clone.rotation.y = Math.PI + 0.25;

        scene.add(clone);

        // Camera: focus on upper 35% of body (head + shoulders)
        var bodyH = size.y;
        var headCenter = bodyH * 0.82;  // ~82% up from feet = head area
        var frameHeight = bodyH * 0.35; // show only top 35%

        var fovRad = camera.fov * (Math.PI / 180);
        var dist = (frameHeight * 1.1) / (2 * Math.tan(fovRad / 2));

        camera.position.set(0, headCenter, dist);
        camera.lookAt(0, headCenter, 0);

        renderer.render(scene, camera);
        return this.cleanup(renderer, scene);
    }

    // ── SVG FALLBACK ──
    generateFallback() {
        var bustSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">' +
            '<rect width="200" height="200" rx="20" fill="#1a1a2e"/>' +
            '<rect x="55" y="40" width="90" height="95" rx="18" fill="#d4d4d4"/>' +
            '<rect x="55" y="33" width="90" height="35" rx="14" fill="#555"/>' +
            '<ellipse cx="82" cy="82" rx="8" ry="10" fill="#fff"/>' +
            '<ellipse cx="118" cy="82" rx="8" ry="10" fill="#fff"/>' +
            '<circle cx="84" cy="84" r="5" fill="#333"/>' +
            '<circle cx="120" cy="84" r="5" fill="#333"/>' +
            '<circle cx="86" cy="82" r="2" fill="#fff"/>' +
            '<circle cx="122" cy="82" r="2" fill="#fff"/>' +
            '<path d="M88 108 Q100 118 112 108" stroke="#888" stroke-width="3" fill="none" stroke-linecap="round"/>' +
            '<rect x="55" y="140" width="90" height="60" rx="8" fill="#4a7c5f"/>' +
            '<rect x="25" y="142" width="25" height="50" rx="8" fill="#4a7c5f"/>' +
            '<rect x="150" y="142" width="25" height="50" rx="8" fill="#4a7c5f"/>' +
            '</svg>';

        var fullSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 320">' +
            '<ellipse cx="100" cy="310" rx="35" ry="6" fill="rgba(255,255,255,0.04)"/>' +
            '<rect x="72" y="195" width="22" height="85" rx="6" fill="#3a3a55"/>' +
            '<rect x="106" y="195" width="22" height="85" rx="6" fill="#3a3a55"/>' +
            '<rect x="68" y="272" width="28" height="16" rx="5" fill="#333"/>' +
            '<rect x="104" y="272" width="28" height="16" rx="5" fill="#333"/>' +
            '<rect x="62" y="105" width="76" height="94" rx="10" fill="#4a7c5f"/>' +
            '<rect x="30" y="110" width="24" height="70" rx="8" fill="#4a7c5f"/>' +
            '<rect x="146" y="110" width="24" height="70" rx="8" fill="#4a7c5f"/>' +
            '<rect x="34" y="175" width="16" height="18" rx="6" fill="#d4d4d4"/>' +
            '<rect x="150" y="175" width="16" height="18" rx="6" fill="#d4d4d4"/>' +
            '<rect x="84" y="88" width="32" height="22" rx="5" fill="#d4d4d4"/>' +
            '<rect x="60" y="25" width="80" height="70" rx="14" fill="#d4d4d4"/>' +
            '<rect x="60" y="18" width="80" height="30" rx="10" fill="#555"/>' +
            '<ellipse cx="85" cy="58" rx="7" ry="8" fill="#fff"/>' +
            '<ellipse cx="115" cy="58" rx="7" ry="8" fill="#fff"/>' +
            '<circle cx="87" cy="60" r="4" fill="#333"/>' +
            '<circle cx="117" cy="60" r="4" fill="#333"/>' +
            '<circle cx="89" cy="58" r="1.5" fill="#fff"/>' +
            '<circle cx="119" cy="58" r="1.5" fill="#fff"/>' +
            '<path d="M90 75 Q100 83 110 75" stroke="#888" stroke-width="2.5" fill="none" stroke-linecap="round"/>' +
            '</svg>';

        this.cache.bust = 'data:image/svg+xml;base64,' + btoa(bustSvg);
        this.cache.full = 'data:image/svg+xml;base64,' + btoa(fullSvg);
    }

    getBustImage() { return this.cache.bust; }
    getFullImage() { return this.cache.full; }
}

// ============================================
// GLOBAL INSTANCE
// ============================================

var playerRenderer = new PlayerModelRenderer();

// ============================================
// Apply avatar
// ============================================

function applyAvatar(container, type) {
    if (!container || container.classList.contains('avatar-done')) return;
    container.classList.add('avatar-done');

    var src = type === 'full' ? playerRenderer.getFullImage() : playerRenderer.getBustImage();
    if (!src) return;

    // Save status dot
    var dot = container.querySelector('.user-status-dot');

    // Remove placeholder
    var placeholder = container.querySelector('.avatar-placeholder');
    if (placeholder) placeholder.remove();

    // Create image
    var img = document.createElement('img');
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

    // Restore status dot
    if (dot) container.appendChild(dot);

    // Profile frame placeholder
    if (type === 'full') {
        var fp = container.closest('.profile-avatar-frame');
        if (fp) {
            var fpp = fp.querySelector('.avatar-placeholder');
            if (fpp) fpp.remove();
        }
    }
}

// ============================================
// Profile Page
// ============================================

function initProfileModel() {
    var content = document.getElementById('profile-content');
    if (!content) return;

    var tryInit = function () {
        var avatar = content.querySelector('.profile-avatar:not(.avatar-done)');
        if (avatar) applyAvatar(avatar, 'full');
    };

    playerRenderer.load().then(function () {
        tryInit();
        new MutationObserver(function () { tryInit(); })
            .observe(content, { childList: true, subtree: true });
    });
}

// ============================================
// Users Page
// ============================================

function initUsersModels() {
    var grid = document.getElementById('users-grid');
    if (!grid) return;

    var tryInit = function () {
        var avatars = grid.querySelectorAll('.user-avatar:not(.avatar-done)');
        avatars.forEach(function (a) { applyAvatar(a, 'bust'); });
    };

    playerRenderer.load().then(function () {
        tryInit();
        new MutationObserver(function () { tryInit(); })
            .observe(grid, { childList: true, subtree: true });
    });
}

// ============================================
// Home Page
// ============================================

function initHomeAvatar() {
    var avatar = document.getElementById('home-avatar');
    if (!avatar) return;
    playerRenderer.load().then(function () { applyAvatar(avatar, 'bust'); });
}

// ============================================
// Init
// ============================================

document.addEventListener('DOMContentLoaded', function () {
    if (document.querySelector('.profile-page')) initProfileModel();
    if (document.querySelector('.users-page')) initUsersModels();
    if (document.querySelector('.home-page')) initHomeAvatar();
});