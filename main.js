
import * as THREE from 'three';
// Import des extensions pour bouger la caméra, et ajouter des effets visuels (Post-processing)
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'; // L'effet de lueur (Glow)
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js'; // L'effet de décalage des couleurs (aberration chromatique)
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js'; // L'effet "grain de film"

// --- CONFIGURATION DES COULEURS ---
// Une palette de base pour garder une cohérence visuelle
const palette = { void: 0x0d0414, magenta: 0xff00ff, cyan: 0x00ffff, lime: 0xbaff00 };
const tmpColorA = new THREE.Color();
const tmpColorB = new THREE.Color();
// Couleurs modifiables par l'utilisateur via l'interface
const userColors = {
  sphereA: palette.lime,
  sphereB: 0x80e0ff,
  cageA: palette.magenta,
  cageB: palette.cyan
};

// --- SHADERS (PROGRAMMES CARTE GRAPHIQUE) ---
// Le Vertex Shader gère la FORME. Il déplace les points (vertex) de la sphère.
const blobVertexShader = /* glsl */`
uniform float u_time;       // Le temps qui passe (pour animer)
uniform float u_bass;       // Puissance des basses
uniform float u_treble;     // Puissance des aigus
uniform float u_mid;        // Puissance des médiums
uniform float u_reactivity; // Sensibilité globale
uniform float u_speed;      // Vitesse de déformation
uniform vec3 u_color;       // Couleur calculée en JS
varying vec3 vColor;        // Variable pour passer la couleur au Fragment Shader

// Fonction mathématique pour générer du "bruit" (aléatoire fluide)
// C'est ce qui donne l'aspect organique/liquide et non géométrique.
vec3 hash3(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(vec3 p) {
  // Interpolation complexe pour lisser le bruit (créer des collines douces au lieu de pics chaotiques)
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(dot(hash3(i + vec3(0.0, 0.0, 0.0)), f - vec3(0.0, 0.0, 0.0)),
             dot(hash3(i + vec3(1.0, 0.0, 0.0)), f - vec3(1.0, 0.0, 0.0)), u.x),
        mix(dot(hash3(i + vec3(0.0, 1.0, 0.0)), f - vec3(0.0, 1.0, 0.0)),
             dot(hash3(i + vec3(1.0, 1.0, 0.0)), f - vec3(1.0, 1.0, 0.0)), u.x), u.y),
    mix(mix(dot(hash3(i + vec3(0.0, 0.0, 1.0)), f - vec3(0.0, 0.0, 1.0)),
             dot(hash3(i + vec3(1.0, 0.0, 1.0)), f - vec3(1.0, 0.0, 1.0)), u.x),
        mix(dot(hash3(i + vec3(0.0, 1.0, 1.0)), f - vec3(0.0, 1.0, 1.0)),
             dot(hash3(i + vec3(1.0, 1.0, 1.0)), f - vec3(1.0, 1.0, 1.0)), u.x), u.y), u.z);
}

void main() {
  vColor = u_color;
  
  // On accélère ou ralentit le temps selon la vitesse choisie
  float t = u_time * u_speed;
  
  // On récupère les fréquences audio
  float bass = u_bass * u_reactivity;
  float treble = u_treble * u_reactivity;
  float mid = u_mid * u_reactivity;

  // Calcul de l'amplitude (force de la déformation)
  float amp = 0.25 + bass * 0.9 + treble * 0.65; 
  // Calcul de la fréquence spatiale (densité des pics)
  float freq = 3.4 + treble * 2.0 + mid * 1.3;
  
  // "Warp" déforme l'espace lui-même avant d'appliquer le bruit pour un effet plus liquide
  vec3 warp = vec3(sin(t * 1.1) * 0.85, cos(t * 0.85) * 0.85, sin(t * 1.4) * 0.85);
  vec3 p = position * freq + warp;
  
  // Superposition de 3 couches de bruit qui bougent dans des directions opposées
  float n1 = noise(p + vec3(t * 0.9, t * 0.7, t * 0.8));
  float n2 = noise(p * 1.9 - vec3(t * 1.05, t * 0.6, t * 0.85));
  float n3 = noise(p * 3.6 + vec3(t * 0.5, -t * 0.75, t * 0.4));
  float n = (n1 * 0.5 + n2 * 0.35 + n3 * 0.15);
  
  // Déplacement final du point le long de sa "normale" (perpendiculaire à la surface)
  float displacement = amp * (0.3 + n);
  vec3 newPos = position + normal * displacement;
  
  // Projection classique 3D vers l'écran 2D
  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
}
`;

// Le Fragment Shader gère la COULEUR et la TRANSPARENCE de chaque pixel
const blobFragmentShader = /* glsl */`
uniform vec3 u_color;
varying vec3 vColor;
void main() {
  // On applique simplement la couleur calculée avec une opacité de 0.32
  gl_FragColor = vec4(vColor, 0.32);
}
`;

// --- DOM & INTERFACE ---
// Récupération de tous les boutons et inputs HTML
const canvas = document.getElementById('bg');
const statusEl = document.getElementById('status');
const playBtn = document.getElementById('playPause');
const micBtn = document.getElementById('mic');
const stopBtn = document.getElementById('stop');
const fileInput = document.getElementById('fileInput');
const fftInput = document.getElementById('fft');
const gainInput = document.getElementById('gain');
const reactivityInput = document.getElementById('reactivity');
const audioUrlInput = document.getElementById('audioUrl');
const playUrlBtn = document.getElementById('playUrl');
const deformSpeedInput = document.getElementById('deformSpeed');
const bloomStrengthInput = document.getElementById('bloomStrength');
const bloomRadiusInput = document.getElementById('bloomRadius');
const sphereColorAInput = document.getElementById('sphereColorA');
const sphereColorBInput = document.getElementById('sphereColorB');
const cageColorAInput = document.getElementById('cageColorA');
const cageColorBInput = document.getElementById('cageColorB');
const toggleUiBtn = document.getElementById('toggleUi');
const uiRoot = document.querySelector('.ui');

// --- UI responsive: auto-hide on small screens ---
let userUiOverride = false;
function isSmallScreen() { return window.innerWidth <= 640; }
function applyAutoUiVisibility() {
  if (!uiRoot || !toggleUiBtn) return;
  if (!userUiOverride) {
    const hide = isSmallScreen();
    uiRoot.classList.toggle('hidden', hide);
    toggleUiBtn.textContent = hide ? 'Show UI' : 'Hide UI';
  }
}
// Initial state
applyAutoUiVisibility();

// --- MOTEUR AUDIO (Web Audio API) ---
let audioCtx; 
let analyser; // L'outil qui découpe le son en fréquences
let sourceNode; 
let outputGain; 
let mediaStream; 
let mediaElementSource; 
let dataArray; // Le tableau où on stockera les données audio (0 à 255)
let gainFactor = parseFloat(gainInput?.value || '1');
let reactivityMultiplier = parseFloat(reactivityInput?.value || '1');
let isPlaying = false; let usingMic = false;

// Création d'un élément audio HTML invisible pour jouer les fichiers
const audioEl = new Audio();
audioEl.crossOrigin = 'anonymous'; audioEl.loop = true; audioEl.preload = 'auto';

// Gestionnaires d'événements audio (Play/Pause/Fin)
audioEl.addEventListener('ended', () => { isPlaying = false; updateStatus('Arrêté'); if (playBtn) playBtn.textContent = '▶︎ Play'; });
audioEl.addEventListener('play', () => { isPlaying = true; updateStatus(usingMic ? 'Mic en cours' : 'Lecture fichier'); if (playBtn) playBtn.textContent = '❚❚ Pause'; });
audioEl.addEventListener('pause', () => { isPlaying = false; updateStatus('Pause'); if (playBtn) playBtn.textContent = '▶︎ Play'; });

// Initialisation du contexte audio (nécessaire après un clic utilisateur)
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (!analyser) {
    analyser = audioCtx.createAnalyser();
    // FFT Size détermine la précision de l'analyse (plus haut = plus précis mais plus lourd)
    analyser.fftSize = parseInt(fftInput?.value || '1024', 10);
    analyser.smoothingTimeConstant = 0.6; // Lissage pour que ça ne clignote pas trop vite
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    outputGain = audioCtx.createGain();
    // Connexion: Source -> Analyseur -> Gain -> Haut-parleurs
    analyser.connect(outputGain); outputGain.connect(audioCtx.destination);
  }
}

// Changement dynamique de la précision FFT
function setFft(size) { if (!analyser) return; analyser.fftSize = size; dataArray = new Uint8Array(analyser.frequencyBinCount); }

// Fonction utilitaire pour connecter une nouvelle source (fichier, micro, url)
function connectSource(node) { if (sourceNode) { try { sourceNode.disconnect(); } catch { } } sourceNode = node; sourceNode.connect(analyser); }

// --- GESTION DES SOURCES AUDIO ---
// 1. Fichier local (Drag & Drop ou Input)
async function useFile(file) {
  usingMic = false; ensureAudio(); outputGain.gain.value = 1; await audioCtx.resume();
  audioEl.src = URL.createObjectURL(file);
  if (!mediaElementSource) mediaElementSource = audioCtx.createMediaElementSource(audioEl);
  connectSource(mediaElementSource);
  try { await audioEl.play(); } catch { updateStatus('Lecture bloquée : clique Play'); }
}

// 2. URL distante (Radio ou MP3 en ligne)
async function useUrl(url) {
  if (!url) { updateStatus('URL manquante'); return; }
  usingMic = false; ensureAudio(); outputGain.gain.value = 1; await audioCtx.resume();
  audioEl.src = url;
  if (!mediaElementSource) mediaElementSource = audioCtx.createMediaElementSource(audioEl);
  connectSource(mediaElementSource);
  try { await audioEl.play(); updateStatus('Lecture URL'); }
  catch { updateStatus('Lecture bloquée ou CORS'); }
}

// 3. Microphone
async function useMic() {
  usingMic = true; ensureAudio(); outputGain.gain.value = 0; // On coupe le retour son pour éviter le Larsen
  try {
    await audioCtx.resume();
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const micNode = audioCtx.createMediaStreamSource(mediaStream);
    connectSource(micNode);
    updateStatus('Mic en cours'); isPlaying = true; if (playBtn) playBtn.textContent = '❚❚ Pause';
  } catch { updateStatus('Mic refusé'); }
}

// Arrêt total
function stopAll() {
  if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
  if (audioEl && !audioEl.paused) audioEl.pause();
  isPlaying = false; usingMic = false; updateStatus('Arrêté'); if (playBtn) playBtn.textContent = '▶︎ Play';
}
function updateStatus(text) { if (statusEl) statusEl.textContent = text; }

// --- ÉCOUTEURS D'ÉVÉNEMENTS UI (Boutons) ---
// Branchement de tous les boutons de l'interface aux fonctions JS ci-dessus
playBtn?.addEventListener('click', async () => {
  ensureAudio(); await audioCtx.resume();
  if (usingMic) { isPlaying = !isPlaying; updateStatus(isPlaying ? 'Mic en cours' : 'Pause mic'); if (playBtn) playBtn.textContent = isPlaying ? '❚❚ Pause' : '▶︎ Play'; return; }
  if (!audioEl.src) { updateStatus('Charge un fichier ou active le micro'); return; }
  if (audioEl.paused) { await audioEl.play(); } else { audioEl.pause(); }
});
micBtn?.addEventListener('click', () => { stopAll(); useMic(); });
stopBtn?.addEventListener('click', () => { stopAll(); });
fileInput?.addEventListener('change', async (e) => { const file = e.target.files?.[0]; if (!file) return; stopAll(); await useFile(file); });
fftInput?.addEventListener('input', (e) => { const size = parseInt(e.target.value, 10); setFft(size); });
gainInput?.addEventListener('input', (e) => { gainFactor = parseFloat(e.target.value); });
reactivityInput?.addEventListener('input', (e) => {
  reactivityMultiplier = parseFloat(e.target.value);
  if (artifactUniforms?.u_reactivity) artifactUniforms.u_reactivity.value = reactivityMultiplier;
});
playUrlBtn?.addEventListener('click', async () => {
  const url = audioUrlInput?.value?.trim();
  if (!url) { updateStatus('Entrez une URL audio'); return; }
  stopAll(); await useUrl(url);
});
toggleUiBtn?.addEventListener('click', () => {
  if (!uiRoot) return;
  userUiOverride = true;
  const hidden = uiRoot.classList.toggle('hidden');
  toggleUiBtn.textContent = hidden ? 'Show UI' : 'Hide UI';
});
// Mise à jour des variables graphiques en temps réel quand on touche aux sliders
deformSpeedInput?.addEventListener('input', (e) => {
  const v = parseFloat(e.target.value);
  if (artifactUniforms?.u_speed) artifactUniforms.u_speed.value = v;
});
bloomStrengthInput?.addEventListener('input', (e) => {
  bloomPass.strength = parseFloat(e.target.value);
});
bloomRadiusInput?.addEventListener('input', (e) => {
  bloomPass.radius = parseFloat(e.target.value);
});
sphereColorAInput?.addEventListener('input', (e) => { userColors.sphereA = new THREE.Color(e.target.value).getHex(); });
sphereColorBInput?.addEventListener('input', (e) => { userColors.sphereB = new THREE.Color(e.target.value).getHex(); });
cageColorAInput?.addEventListener('input', (e) => { userColors.cageA = new THREE.Color(e.target.value).getHex(); });
cageColorBInput?.addEventListener('input', (e) => { userColors.cageB = new THREE.Color(e.target.value).getHex(); });

// --- SCÈNE 3D (THREE.JS) ---
const scene = new THREE.Scene(); scene.background = new THREE.Color(palette.void); 
// Brouillard pour donner de la profondeur
scene.fog = new THREE.FogExp2(palette.void, 0.045); 

// Caméra (l'œil)
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100); camera.position.set(0, 1.2, 4.2);
// Le Renderer (le peintre qui dessine sur le canvas)
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); renderer.setSize(window.innerWidth, window.innerHeight); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// Contrôles pour tourner autour de l'objet
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 2; controls.maxDistance = 8;

// --- POST-PROCESSING (EFFETS VISUELS) ---
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
// 1. Bloom : effet de néon / lueur
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.45, 0.6, 0.3);
// 2. RGB Shift : sépare le rouge, vert, bleu sur les bords (effet glitch)
const rgbShiftPass = new ShaderPass(RGBShiftShader); rgbShiftPass.uniforms.amount.value = 0.0012;
// 3. FilmGrain : ajoute du bruit pour faire "cinéma"
const filmPass = new FilmPass(0.5, 0.15, 1024, false);

composer.addPass(renderPass); composer.addPass(bloomPass); composer.addPass(rgbShiftPass); composer.addPass(filmPass);

// --- OBJETS 3D ---

// 1. L'ARTIFACT (La boule déformable au centre)
// Géométrie : Icosaèdre avec beaucoup de subdivisions (5) pour être lisse
const artifactGeo = new THREE.IcosahedronGeometry(0.7, 5);
// Les données envoyées au Shader
const artifactUniforms = {
  u_time: { value: 0 },
  u_bass: { value: 0 },
  u_treble: { value: 0 },
  u_mid: { value: 0 },
  u_reactivity: { value: reactivityMultiplier },
  u_speed: { value: 1 },
  u_color: { value: new THREE.Color(palette.cyan) }
};
const artifactMat = new THREE.ShaderMaterial({
  uniforms: artifactUniforms,
  vertexShader: blobVertexShader, // Notre code GLSL de forme
  fragmentShader: blobFragmentShader, // Notre code GLSL de couleur
  wireframe: true, // Affiche les lignes (fil de fer)
  transparent: true,
  depthWrite: false // Pour bien gérer la transparence superposée
});
const artifact = new THREE.Mesh(artifactGeo, artifactMat);
scene.add(artifact);

// 2. LA CAGE (La structure autour)
const cageGeo = new THREE.IcosahedronGeometry(1.05, 2); // Moins de détails que la boule
const cageMat = new THREE.MeshBasicMaterial({ color: palette.magenta, wireframe: true, transparent: true, opacity: 0.4 });
const cage = new THREE.Mesh(cageGeo, cageMat); 
// On stocke les positions initiales pour pouvoir déformer et revenir à la normale
const cageBasePositions = cage.geometry.attributes.position.array.slice();
scene.add(cage);

// 3. LES PARTICULES (Nuage de points)
const particleCount = 800;
const positions = new Float32Array(particleCount * 3);
const colors = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount; i++) {
  // Calcul mathématique pour placer les points en sphère aléatoire
  const r = 3 + Math.random() * 2.5; const theta = Math.random() * Math.PI * 2; const phi = Math.acos((Math.random() * 2) - 1);
  const x = r * Math.sin(phi) * Math.cos(theta); const y = r * Math.cos(phi) * 0.5; const z = r * Math.sin(phi) * Math.sin(theta);
  positions.set([x, y, z], i * 3); const c = Math.random() > 0.5 ? palette.lime : palette.magenta;
  colors.set([((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255], i * 3);
}
const particleGeo = new THREE.BufferGeometry(); particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3)); particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
const particleMat = new THREE.PointsMaterial({ size: 0.04, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false });
const particles = new THREE.Points(particleGeo, particleMat); scene.add(particles);

// 4. LE SOL (Grille en bas)
const planeGeo = new THREE.PlaneGeometry(40, 40, 10, 10);
const planeMat = new THREE.MeshBasicMaterial({ color: palette.void, wireframe: true, transparent: true, opacity: 0.15 });
const plane = new THREE.Mesh(planeGeo, planeMat); plane.rotation.x = -Math.PI / 2; plane.position.y = -3; scene.add(plane);

// --- BOUCLE D'ANIMATION (Le cœur du script) ---
const clock = new THREE.Clock();
let elapsedTime = 0;

function tick() {
  requestAnimationFrame(tick); // Rappelle cette fonction au prochain rafraîchissement d'écran
  const dt = clock.getDelta();
  elapsedTime += dt;
  controls.update();

  // Rotation constante des objets
  artifact.rotation.x += 0.0025; artifact.rotation.y += 0.0035; cage.rotation.x -= 0.0015; cage.rotation.y -= 0.0012; particles.rotation.y += 0.0008;

  // --- ANALYSE AUDIO ---
  let bass = 0, treble = 0, mid = 0, peakAmp = 0, peakIndex = 0;
  const reactivityBoost = 1.35;
  if (analyser && dataArray) {
    analyser.getByteFrequencyData(dataArray); // Remplit le tableau avec le son actuel
    
    // On découpe le spectre audio en zones
    const bassBins = dataArray.slice(0, 10); // Les basses sont au début du tableau
    const midBins = dataArray.slice(10, Math.floor(dataArray.length * 0.5));
    const trebleBins = dataArray.slice(Math.floor(dataArray.length * 0.75));
    
    // Calcul de la moyenne pour chaque zone (0 à 1)
    bass = (bassBins.reduce((a,b)=>a+b,0)/bassBins.length/255)*gainFactor*reactivityMultiplier*reactivityBoost;
    mid = (midBins.reduce((a,b)=>a+b,0)/midBins.length/255)*gainFactor*reactivityMultiplier*reactivityBoost;
    treble = (trebleBins.reduce((a,b)=>a+b,0)/trebleBins.length/255)*gainFactor*reactivityMultiplier*reactivityBoost;
  }

  // --- RÉACTION DES OBJETS ---
  
  // 1. Artifact (Boule) : Grossit avec les basses
  const baseScale = 1;
  const pulse = Math.min(bass * 1.4, 1.8);
  const scale = baseScale + pulse;
  artifact.scale.setScalar(scale);

  // Changement de couleur dynamique (mélange basé sur le temps et l'audio)
  const chaos = (Math.sin(elapsedTime * 2.4) + 1) * 0.5;
  const mixA = THREE.MathUtils.clamp(chaos * 0.5 + treble * 0.35 + bass * 0.15, 0, 1);
  const mixB = THREE.MathUtils.clamp((1 - chaos) * 0.4 + mid * 0.4 + treble * 0.2, 0, 1);
  const swing = (Math.sin(elapsedTime * 1.3 + treble * 3.0) + 1) * 0.5;
  
  // Interpolation (mélange) entre les couleurs utilisateur
  tmpColorA.setHex(userColors.sphereA).lerp(tmpColorB.setHex(userColors.sphereB), mixA);
  tmpColorB.setHex(0xffffff).lerp(tmpColorA, mixB * 0.7 + 0.3);
  const finalColor = tmpColorA.clone().lerp(tmpColorB, swing);
  
  // Envoi des nouvelles valeurs au Shader
  artifactUniforms.u_color.value.copy(finalColor);
  artifactUniforms.u_time.value = elapsedTime;
  artifactUniforms.u_bass.value = bass;
  artifactUniforms.u_treble.value = treble;
  artifactUniforms.u_mid.value = mid;
  
  // 2. La Cage : Réagit aux aigus (Treble)
  cage.rotation.z += treble * 0.02; // Tourne plus vite avec les aigus
  // On s'assure que la cage est toujours un peu plus grande que la boule
  const targetCage = Math.max(scale * 1.08, 1.04 + treble * 0.12);
  const currentCage = cage.scale.x;
  // Lerp = lissage du mouvement (pour ne pas que ça saccade)
  const nextCage = THREE.MathUtils.lerp(currentCage, targetCage, 0.22 + treble * 0.25);
  cage.scale.setScalar(nextCage);
  
  // Couleur de la cage (pilotée par l'UI)
  // On utilise le même mélange que pour l'artifact afin de garder une cohérence visuelle
  tmpColorA.setHex(userColors.cageA).lerp(tmpColorB.setHex(userColors.cageB), mixA);
  const cageColorMix = tmpColorA.clone().lerp(tmpColorB, swing);
  cage.material.color.copy(cageColorMix);
  
  // 3. Déformation manuelle des points de la Cage (CPU)
  // Contrairement à la boule (déformée par Shader GPU), ici on boucle en JS sur les points
  const cagePos = cage.geometry.attributes?.position;
  if (cagePos && cageBasePositions) {
    const overlapBoost = Math.max(0, scale - nextCage);
    const deform = 0.025 * bass + 0.012 * mid + overlapBoost * 0.15;
    const t = elapsedTime * 1.05;
    const keepShape = 0.86; // Force de rappel vers la forme originale
    
    for (let i = 0; i < cagePos.count; i++) {
      const ix = i * 3;
      // Calcul d'une ondulation sinusoïdale
      const n = Math.sin(i * 0.93 + t * 1.2) + Math.cos(i * 1.11 + t * 0.95);
      const offset = n * deform;
      // Application de la déformation
      cagePos.array[ix] = (cageBasePositions[ix] + offset) * (1 - keepShape) + cageBasePositions[ix] * keepShape;
      cagePos.array[ix + 1] = (cageBasePositions[ix + 1] + offset) * (1 - keepShape) + cageBasePositions[ix + 1] * keepShape;
      cagePos.array[ix + 2] = (cageBasePositions[ix + 2] + offset) * (1 - keepShape) + cageBasePositions[ix + 2] * keepShape;
    }
    cagePos.needsUpdate = true; // Dit à Three.js de redessiner la géométrie
  }
  
  // 4. Intensité des effets post-processing selon la musique
  rgbShiftPass.uniforms.amount.value = 0.0012 + bass * 0.003; // L'image se "déchire" sur les basses
  bloomPass.strength = 0.45 + bass * 0.65; // L'image brille plus fort sur les basses
  particles.rotation.x += mid * 0.007;

  // Rendu final
  composer.render();
}

// Gestion du redimensionnement de la fenêtre
window.addEventListener('resize', () => { 
    const w = window.innerWidth, h = window.innerHeight; 
    camera.aspect = w / h; 
    camera.updateProjectionMatrix(); 
    renderer.setSize(w, h); 
    composer.setSize(w, h); 
  applyAutoUiVisibility();
});

updateStatus('Prêt • charge un MP3 ou active le mic');
tick(); // Lancement de la boucle
