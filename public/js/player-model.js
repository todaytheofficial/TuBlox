// ============================================
// Player 3D Model Viewer (Roblox Style - Face Only)
// ============================================

class PlayerModelViewer {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            width: options.width || container.clientWidth || 200,
            height: options.height || container.clientHeight || 280,
            modelPath: options.modelPath || '/assets/models/player.fbx',
            autoRotate: options.autoRotate || false,
            backgroundColor: options.backgroundColor || 0x2a2a3e
        };
        
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.model = null;
        this.mixer = null;
        this.isDestroyed = false;
        this.clock = new THREE.Clock();
        
        this.init();
    }
    
    init() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.options.backgroundColor);
        
        this.camera = new THREE.PerspectiveCamera(
            35,
            this.options.width / this.options.height,
            0.01,
            1000
        );
        
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true 
        });
        this.renderer.setSize(this.options.width, this.options.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        
        // Убираем тональную коррекцию (убирает неон)
        this.renderer.toneMapping = THREE.NoToneMapping;
        
        this.container.innerHTML = '';
        this.container.appendChild(this.renderer.domElement);
        
        this.setupLights();
        this.loadModel();
        this.animate();
    }
    
    setupLights() {
        // Нейтральное белое освещение без цветных оттенков
        const ambient = new THREE.AmbientLight(0xffffff, 0.9);
        this.scene.add(ambient);
        
        const frontLight = new THREE.DirectionalLight(0xffffff, 0.5);
        frontLight.position.set(0, 0, 1);
        this.scene.add(frontLight);
        
        const topLight = new THREE.DirectionalLight(0xffffff, 0.3);
        topLight.position.set(0, 1, 0);
        this.scene.add(topLight);
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
                
                // Центрируем и сдвигаем влево ещё больше
                this.model.position.set(
                    -center.x - 2.2,
                    -center.y,
                    -center.z
                );
                
                // Голова
                const headY = size.y * 0.35;
                
                // Камера
                const cameraZ = size.y * 0.8;
                
                this.camera.position.set(0, headY, cameraZ);
                this.camera.lookAt(0, headY, 0);
                
                // Поворот - лицом к камере + небольшой угол
                this.model.rotation.y = Math.PI + 0.3;
                
                // Ищем Idle анимацию
                if (fbx.animations && fbx.animations.length > 0) {
                    this.mixer = new THREE.AnimationMixer(this.model);
                    
                    let idleClip = null;
                    
                    for (const clip of fbx.animations) {
                        const name = clip.name.toLowerCase();
                        if (name.includes('idle')) {
                            idleClip = clip;
                            break;
                        }
                    }
                    
                    if (idleClip) {
                        const action = this.mixer.clipAction(idleClip);
                        action.play();
                    }
                }
                
                // Материалы - убираем блеск и неон
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
                console.log('[PlayerModel] ✓ Loaded');
            },
            null,
            (error) => {
                console.error('[PlayerModel] ✗ Error:', error);
                this.showError();
            }
        );
    }
    
    showError() {
        this.container.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ff4444;font-size:12px;text-align:center;padding:10px;">
                Failed to load
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
    
    const observer = new MutationObserver(() => {
        const avatar = content.querySelector('.profile-avatar:not(.model-init)');
        if (avatar) {
            avatar.classList.add('model-init');
            
            new PlayerModelViewer(avatar, {
                width: avatar.clientWidth || 200,
                height: avatar.clientHeight || 200,
                autoRotate: false
            });
        }
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
    
    const observer = new MutationObserver(() => {
        const avatars = grid.querySelectorAll('.user-avatar:not(.model-init)');
        
        avatars.forEach((avatar) => {
            avatar.classList.add('model-init');
            
            const viewer = new PlayerModelViewer(avatar, {
                width: avatar.clientWidth || 80,
                height: avatar.clientHeight || 80,
                autoRotate: false
            });
            
            viewers.push(viewer);
        });
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