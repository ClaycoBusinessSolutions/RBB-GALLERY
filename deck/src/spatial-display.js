import * as THREE from '../vendor/three/build/three.module.js?v=a172b369e672e17d83cb';

// An illustrative inset display, using photographs already in this presentation.
// Its clock belongs to the spatial viewer so hidden/paused studies do no work.
const SOURCES = [
  new URL('../assets/projects/industrial-rivian.webp', import.meta.url).href,
  new URL('../assets/projects/workcare-zurich-north-america-headquarters-1.webp', import.meta.url).href,
  new URL('../assets/projects/civic-scad-indian-street-1.webp', import.meta.url).href,
];
const WIDTH = 2.1, HEIGHT = 1.18, INTERVAL = 8, FADE = 1.2;
const smoothstep = value => value * value * (3 - 2 * value);

export function createSpatialDisplay({ onLoad = () => {} } = {}) {
  const group = new THREE.Group();
  group.name = 'timeline-project-display';
  // The timeline wall faces toward negative Z; the parent sets world position.
  group.rotation.y = Math.PI;

  const frameGeometry = new THREE.BoxGeometry(WIDTH + .1, HEIGHT + .1, .045);
  const frameMaterial = new THREE.MeshBasicMaterial({ color: '#161616' });
  const frame = new THREE.Mesh(frameGeometry, frameMaterial);
  group.add(frame);

  const planeGeometry = new THREE.PlaneGeometry(WIDTH, HEIGHT);
  const materials = [0, 1].map(() => new THREE.MeshBasicMaterial({
    color: '#ffffff', transparent: true, opacity: 0,
    toneMapped: false, depthWrite: false,
  }));
  materials.forEach((material, index) => {
    const plane = new THREE.Mesh(planeGeometry, material);
    plane.position.z = .026 + index * .002;
    plane.renderOrder = 10 + index;
    group.add(plane);
  });

  const textures = [], loaded = [], disposedTextures = new Set();
  let disposed = false, currentSeconds = 0;

  function setLayer(material, texture, opacity) {
    if (material.map !== texture) {
      material.map = texture;
      material.needsUpdate = true;
    }
    material.opacity = opacity;
  }

  function update(seconds = 0) {
    if (disposed) return;
    currentSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const index = Math.floor(currentSeconds / INTERVAL) % SOURCES.length;
    const firstReady = loaded.findIndex(Boolean);
    if (firstReady < 0) return;
    const current = loaded[index] ? index : firstReady;
    const next = (index + 1) % SOURCES.length;
    const elapsed = currentSeconds % INTERVAL;
    const blend = loaded[next] && current !== next
      ? smoothstep(THREE.MathUtils.clamp((elapsed - INTERVAL + FADE) / FADE, 0, 1))
      : 0;
    setLayer(materials[0], textures[current], 1);
    setLayer(materials[1], loaded[next] ? textures[next] : textures[current], blend);
  }

  function disposeTexture(texture) {
    if (!texture || disposedTextures.has(texture)) return;
    disposedTextures.add(texture);
    texture.dispose();
  }

  const loader = new THREE.TextureLoader();
  SOURCES.forEach((source, index) => {
    const texture = loader.load(source, ready => {
      if (disposed) { disposeTexture(ready); return; }
      // Center-crop to the screen without stretching the architecture.
      const imageAspect = ready.image.width / ready.image.height;
      const displayAspect = WIDTH / HEIGHT;
      if (imageAspect > displayAspect) {
        ready.repeat.x = displayAspect / imageAspect;
        ready.offset.x = (1 - ready.repeat.x) / 2;
      } else {
        ready.repeat.y = imageAspect / displayAspect;
        ready.offset.y = (1 - ready.repeat.y) / 2;
      }
      loaded[index] = true;
      update(currentSeconds);
      onLoad();
    });
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 2;
    textures[index] = texture;
  });

  function dispose() {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    textures.forEach(disposeTexture);
    materials.forEach(material => material.dispose());
    frameMaterial.dispose();
    planeGeometry.dispose();
    frameGeometry.dispose();
    group.clear();
  }

  return { group, update, dispose };
}
