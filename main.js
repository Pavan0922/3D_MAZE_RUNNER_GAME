import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { RGBELoader } from "three/examples/jsm/Addons.js";

let model = null;

let audioContext;
let audioSource;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 5.9, 120);

const canvas = document.querySelector("canvas");
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(window.innerWidth, window.innerHeight);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 7.5);
scene.add(light);

// HDR Environment setup
const Rgbloader = new RGBELoader();
Rgbloader.load(
  "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/rogland_clear_night_2k.hdr",
  (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;
    scene.background = texture;
  }
);

function initializeAudio() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();

  const audioLoader = new THREE.AudioLoader();

  audioLoader.load(
    "/Audio/backgroundsound.mp3",
    (buffer) => {
      audioSource = audioContext.createBufferSource();
      audioSource.buffer = buffer;
      audioSource.loop = true;

      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0.5;

      audioSource.connect(gainNode);
      gainNode.connect(audioContext.destination);
    },
    (xhr) => {
      console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
    },
    (error) => {
      console.error("Error loading audio:", error);
    }
  );
}

document.addEventListener(
  "click",
  () => {
    if (!audioContext) {
      initializeAudio();
    }

    if (audioSource) {
      audioSource.start(0);
    }
  },
  { once: true }
);

const powerUpTypes = [
  {
    type: "speed",
    duration: 5000,
    effect: 0.3,
    color: 0xff0000,
  },
  {
    type: "jump",
    duration: 5000,
    effect: 0.2,
    color: 0x00ff00,
  },
];

let powerUp = null;

function createPowerUp() {
  if (powerUp) return;

  const geometry = new THREE.SphereGeometry(8, 32, 32);
  const currentPowerUp =
    powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
  const material = new THREE.MeshStandardMaterial({
    color: currentPowerUp.color,
    emissive: currentPowerUp.color,
    emissiveIntensity: 0.5,
  });

  powerUp = new THREE.Mesh(geometry, material);

  powerUp.position.set(Math.random() * 50 - 25, 1, Math.random() * 50 - 25);

  powerUp.userData.type = currentPowerUp;
  scene.add(powerUp);
}

let timerStarted = false;
let startTime;
const timerElement = document.querySelector(".container p");

function startTimer() {
  if (!timerStarted) {
    timerStarted = true;
    startTime = Date.now();
    updateTimer();
  }
}

function updateTimer() {
  if (!timerStarted) return;
  const elapsedTime = (Date.now() - startTime) / 1000;
  const remainingTime = Math.max(180 - elapsedTime, 0);
  const minutes = Math.floor(remainingTime / 60);
  const seconds = Math.floor(remainingTime % 60);
  timerElement.textContent = `${minutes}:${seconds
    .toString()
    .padStart(2, "0")}`;

  if (remainingTime <= 0) {
    timerStarted = false;
    alert("Time's up! Game Over.");
  } else {
    requestAnimationFrame(updateTimer);
  }
}

let keys = { forward: false, backward: false, left: false, right: false };
let isJumping = false;
let velocityY = 0;
let speed = 0.2;

const raycaster = new THREE.Raycaster();
const playerDirection = new THREE.Vector3();

const winningCoordinates = { x: -0.35, y: 6.0, z: -89.98 };
const tolerance = 1.0;

let controls;

document.addEventListener("keydown", (event) => {
  switch (event.code) {
    case "ArrowUp":
    case "KeyW":
      keys.forward = true;
      break;
    case "ArrowDown":
    case "KeyS":
      keys.backward = true;
      break;
    case "ArrowLeft":
    case "KeyA":
      keys.left = true;
      break;
    case "ArrowRight":
    case "KeyD":
      keys.right = true;
      break;
    case "Space":
      if (!isJumping) {
        //JUMP
        velocityY = 0.2;
        isJumping = true;
      }
      break;
  }
});

document.addEventListener("keyup", (event) => {
  switch (event.code) {
    case "ArrowUp":
    case "KeyW":
      keys.forward = false;
      break;
    case "ArrowDown":
    case "KeyS":
      keys.backward = false;
      break;
    case "ArrowLeft":
    case "KeyA":
      keys.left = false;
      break;
    case "ArrowRight":
    case "KeyD":
      keys.right = false;
      break;
  }
});

function checkPowerUpCollection() {
  if (!powerUp) return;

  if (camera.position.distanceTo(powerUp.position) < 1) {
    const currentPowerUp = powerUp.userData.type;

    const powerUpDisplay = document.querySelector(".powerup-display");
    if (powerUpDisplay) {
      powerUpDisplay.textContent = `Power-up: ${currentPowerUp.type.toUpperCase()}`;
      powerUpDisplay.style.display = "block";
    }

    if (currentPowerUp.type === "speed") {
      speed *= 1 + currentPowerUp.effect;
    }

    scene.remove(powerUp);
    powerUp = null;

    setTimeout(() => {
      speed = 1;

      if (powerUpDisplay) {
        powerUpDisplay.style.display = "none";
      }

      createPowerUp();
    }, currentPowerUp.duration);
  }
}

function moveCharacter() {
  if (!model || !controls) return;

  const collisionDistance = 0.5;
  const gravity = 0.01;
  const playerHeight = 5;

  if (!timerStarted && camera.position.z < 100) {
    startTimer();
  }

  if (keys.forward || keys.backward) {
    controls.getDirection(playerDirection);
    if (keys.backward) playerDirection.negate();

    raycaster.set(camera.position, playerDirection);
    const intersects = raycaster.intersectObject(model, true);

    if (intersects.length === 0 || intersects[0].distance > collisionDistance) {
      controls.moveForward(speed * (keys.forward ? 1 : -1));
    }
  }

  if (keys.left || keys.right) {
    controls.getDirection(playerDirection);
    playerDirection.applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      (Math.PI / 2) * (keys.left ? 1 : -1)
    );

    raycaster.set(camera.position, playerDirection);
    const intersects = raycaster.intersectObject(model, true);

    if (intersects.length === 0 || intersects[0].distance > collisionDistance) {
      controls.moveRight(speed * (keys.left ? -1 : 1));
    }
  }

  velocityY -= gravity;
  camera.position.y += velocityY;

  raycaster.set(camera.position, new THREE.Vector3(0, -1, 0));
  const groundIntersects = raycaster.intersectObjects(
    [...scene.children],
    true
  );

  if (groundIntersects.length > 0) {
    const distanceToGround = groundIntersects[0].distance;
    if (distanceToGround <= playerHeight) {
      camera.position.y = groundIntersects[0].point.y + playerHeight;
      isJumping = false;
      velocityY = 0;
    }
  }

  if (
    Math.abs(camera.position.x - winningCoordinates.x) <= tolerance &&
    Math.abs(camera.position.y - winningCoordinates.y) <= tolerance &&
    Math.abs(camera.position.z - winningCoordinates.z) <= tolerance
  ) {
    timerStarted = false;
    alert("Congratulations! You completed the maze!");
    window.location.href = "win.html";
  }
}

const loader = new GLTFLoader();
loader.load(
  "/3D_models/Final_Maze.glb",
  function (gltf) {
    model = gltf.scene;
    model.scale.set(2, 2, 2);
    model.position.set(0, 0, 0);
    model.rotation.y = 4.72;
    scene.add(gltf.scene);

    model.traverse((child) => {
      if (child.isMesh) {
        child.material.side = THREE.FrontSide;
      }
    });

    controls = new PointerLockControls(camera, document.body);
    document.body.addEventListener("click", () => {
      controls.lock();
    });

    createPowerUp();
  },
  undefined,
  function (error) {
    console.error("Error loading maze model:", error);
  }
);

function animate() {
  moveCharacter();
  checkPowerUpCollection();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
