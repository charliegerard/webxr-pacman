import * as THREE from "./three.module.js";
import { ARButton } from "./ARButton.js";
import { LEVEL } from "./utils/level.js";
var container;
var camera, scene, renderer;
var controller;
var reticle;
var hitTestSource = null;
var hitTestSourceRequested = false;
var lost;
var PACMAN_SPEED = 2,
  PACMAN_RADIUS = 0.25;
var GHOST_SPEED = 1.5,
  GHOST_RADIUS = PACMAN_RADIUS * 1.25;
var DOT_RADIUS = 0.05,
  PELLET_RADIUS = DOT_RADIUS * 2;
var UP = new THREE.Vector3(0, 0, 1);
var LEFT = new THREE.Vector3(-1, 0, 0);
var TOP = new THREE.Vector3(0, 1, 0);
var RIGHT = new THREE.Vector3(1, 0, 0);
var BOTTOM = new THREE.Vector3(0, -1, 0);
var numDotsEaten = 0;

var group = new THREE.Group();
var won = false;
var lost = false;
var lostTime, wonTime;
var chompSound;
var levelStartSound;
let pacman;
let map;
let gameStarted = false;

var raycaster = new THREE.Raycaster();
var deathSound;
var tempMatrix = new THREE.Matrix4();
var killSound;
var lives = 3;
let moveLeft = false;
let moveRight = false;
let moveFront = false;
let moveBack = false;
var remove = [];
var numGhosts = 0;
var ghostSpawnTime = -8;

init();
animate();

function init() {
  container = document.getElementsByClassName("game")[0];
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.01,
    20
  );

  var light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  light.position.set(0.5, 1, 0.25);
  scene.add(light);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  container.appendChild(renderer.domElement);

  document.body.appendChild(
    ARButton.createButton(renderer, { requiredFeatures: ["hit-test"] })
  );

  chompSound = new Audio("./pacman_chomp.mp3");
  chompSound.volume = 0.5;
  chompSound.loop = true;
  chompSound.preload = "auto";

  levelStartSound = new Audio("./pacman_beginning.mp3");
  levelStartSound.preload = "auto";
  // Play the level start sound as soon as the game starts.
  levelStartSound.autoplay = true;

  deathSound = new Audio("./pacman_death.mp3");
  deathSound.preload = "auto";

  killSound = new Audio("./pacman_eatghost.mp3");
  killSound.preload = "auto";

  function onSelectStart(event) {
    const touchX = event.data.gamepad.axes[0];
    const touchY = event.data.gamepad.axes[1];

    if (touchY > 0) {
      // on the right of the screen
      if (touchY > 0.9) {
        moveRight = true;
      } else if (touchY < 0.9) {
        moveLeft = true;
      }
    } else if (touchY < 0) {
      if (touchX > 0) {
        moveFront = true;
      } else if (touchX < 0) {
        moveBack = true;
      }
    }
    // // }
    // var orientation =
    //   (screen.orientation || {}).type ||
    //   screen.mozOrientation ||
    //   screen.msOrientation;

    // if (orientation === "landscape-primary") {
    //   console.log("That looks good.");
    // } else if (orientation === "landscape-secondary") {
    //   console.log("Mmmh... the screen is upside down!");
    // } else if (
    //   orientation === "portrait-secondary" ||
    //   orientation === "portrait-primary"
    // ) {
    //   console.log("Mmmh... you should rotate your device to landscape");
    // } else if (orientation === undefined) {
    //   console.log("The orientation API isn't supported in this browser :(");
    // }

    if (!gameStarted) {
      map = createMap(scene, LEVEL);
      gameStarted = true;
      levelStartSound.play();
    }
  }

  function onSelectEnd() {
    moveLeft = false;
    moveRight = false;
    moveFront = false;
    moveBack = false;
  }

  function getIntersections(controller) {
    tempMatrix.identity().extractRotation(controller.matrixWorld);

    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    return raycaster.intersectObjects(group.children);
  }

  controller = renderer.xr.getController(0);
  controller.addEventListener("selectstart", onSelectStart);
  controller.addEventListener("selectend", onSelectEnd);
  scene.add(controller);

  reticle = new THREE.Mesh(
    new THREE.RingBufferGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial()
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);
}

function createMap(scene, levelDefinition) {
  var map = {};
  map.bottom = -(levelDefinition.length - 1);
  map.top = 0;
  map.left = 0;
  map.right = 0;
  map.numDots = 0;
  map.pacmanSpawn = null;
  map.ghostSpawn = null;

  var x, y;
  for (var row = 0; row < levelDefinition.length; row++) {
    // Set the coordinates of the map so that they match the
    // coordinate system for objects.
    y = -row;

    map[y] = {};

    // Get the length of the longest row in the level definition.
    var length = Math.floor(levelDefinition[row].length / 2);
    //map.right = Math.max(map.right, length - 1);
    map.right = Math.max(map.right, length);

    // Skip every second element, which is just a space for readability.
    for (var column = 0; column < levelDefinition[row].length; column += 2) {
      x = Math.floor(column / 2);

      var cell = levelDefinition[row][column];
      var object = null;

      if (cell === "#") {
        object = createWall();
      } else if (cell === ".") {
        object = createDot();
        map.numDots += 1;
      } else if (cell === "o") {
        object = createPowerPellet();
      } else if (cell === "P") {
        map.pacmanSpawn = new THREE.Vector3(x, y, 0);
        object = createPacMan(scene, map.pacmanSpawn);
        pacman = object;
      } else if (cell === "G") {
        map.ghostSpawn = new THREE.Vector3(x, y, 0);
        object = createGhost(scene, map.ghostSpawn);
      }

      if (object !== null) {
        object.position.set(x, y, 0);

        map[y][x] = object;
        object.name = "game";
        group.add(object);
      }
    }
  }

  group.position.setFromMatrixPosition(reticle.matrix);
  // test
  group.position.x = -0.5;
  //
  group.rotation.set(-Math.PI / 2, 0, 0);
  group.scale.set(
    reticle.scale.x * 0.03,
    reticle.scale.y * 0.03,
    reticle.scale.z * 0.03
  );

  map.centerX = (map.left + map.right) / 2;
  map.centerY = (map.bottom + map.top) / 2;

  scene.add(group);

  if (group) {
    scene.remove(reticle);
  }
  return map;
}

function createWall() {
  var wallGeometry = new THREE.BoxGeometry(1, 1, 1);
  var wallMaterial = new THREE.MeshLambertMaterial({ color: "blue" });

  var wall = new THREE.Mesh(wallGeometry, wallMaterial);
  wall.isWall = true;

  return wall;
}

function createDot() {
  var dotGeometry = new THREE.SphereGeometry(DOT_RADIUS);
  var dotMaterial = new THREE.MeshPhongMaterial({ color: 0xffdab9 }); // Paech color

  var dot = new THREE.Mesh(dotGeometry, dotMaterial);
  dot.isDot = true;

  return dot;
}

function createPowerPellet() {
  var pelletGeometry = new THREE.SphereGeometry(PELLET_RADIUS, 12, 8);
  var pelletMaterial = new THREE.MeshPhongMaterial({ color: 0xffdab9 }); // Paech color

  var pellet = new THREE.Mesh(pelletGeometry, pelletMaterial);
  pellet.isPowerPellet = true;

  return pellet;
}

function createPacMan(scene, position) {
  // Create spheres with decreasingly small horizontal sweeps, in order
  // to create pacman "death" animation.
  var pacmanGeometries = [];
  var numFrames = 40;
  var offset;
  for (var i = 0; i < numFrames; i++) {
    offset = (i / (numFrames - 1)) * Math.PI;
    pacmanGeometries.push(
      new THREE.SphereGeometry(
        PACMAN_RADIUS,
        16,
        16,
        offset,
        Math.PI * 2 - offset * 2
      )
    );
    pacmanGeometries[i].rotateX(Math.PI / 2);
  }

  var pacmanMaterial = new THREE.MeshPhongMaterial({
    color: "yellow",
    side: THREE.DoubleSide,
  });

  var pacman = new THREE.Mesh(pacmanGeometries[0], pacmanMaterial);
  pacman.frames = pacmanGeometries;
  pacman.currentFrame = 0;

  pacman.isPacman = true;
  pacman.isWrapper = true;
  pacman.atePellet = false;
  pacman.distanceMoved = 0;

  // Initialize pacman facing to the left.
  pacman.position.copy(position);
  pacman.direction = new THREE.Vector3(-1, 0, 0);

  return pacman;
}

function createGhost(scene, position) {
  var ghostGeometry = new THREE.SphereGeometry(GHOST_RADIUS, 16, 16);

  // Give each ghost it's own material so we can change the colors of individual ghosts.
  var ghostMaterial = new THREE.MeshPhongMaterial({ color: "red" });
  var ghost = new THREE.Mesh(ghostGeometry, ghostMaterial);

  ghost.isGhost = true;
  ghost.isWrapper = true;
  ghost.isAfraid = false;

  // Ghosts start moving left.
  ghost.position.copy(position);
  ghost.direction = new THREE.Vector3(-1, 0, 0);
  return ghost;
}

function animate() {
  let animationSeconds = 0;
  var previousFrameTime = window.performance.now();
  renderer.setAnimationLoop(render);

  var now = window.performance.now();
  var animationDelta = (now - previousFrameTime) / 1000;
  previousFrameTime = now;

  // requestAnimationFrame will not call the callback if the browser
  // isn't visible, so if the browser has lost focus for a while the
  // time since the last frame might be very large. This could cause
  // strange behavior (such as objects teleporting through walls in
  // one frame when they would normally move slowly toward the wall
  // over several frames), so make sure that the delta is never too
  // large.
  animationDelta = Math.min(animationDelta, 1 / 30);

  // Keep track of how many seconds of animation has passed.
  animationSeconds += animationDelta;

  if (gameStarted) {
    update(animationDelta, now);
  }
  requestAnimationFrame(animate);
}

function render(timestamp, frame) {
  if (frame) {
    var referenceSpace = renderer.xr.getReferenceSpace();
    var session = renderer.xr.getSession();

    if (hitTestSourceRequested === false) {
      session.requestReferenceSpace("viewer").then(function (referenceSpace) {
        session
          .requestHitTestSource({ space: referenceSpace })
          .then(function (source) {
            hitTestSource = source;
          });
      });

      session.addEventListener("end", function () {
        hitTestSourceRequested = false;
        hitTestSource = null;
      });

      hitTestSourceRequested = true;
    }

    if (hitTestSource) {
      var hitTestResults = frame.getHitTestResults(hitTestSource);

      if (hitTestResults.length) {
        var hit = hitTestResults[0];

        reticle.visible = true;
        reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
      } else {
        reticle.visible = false;
      }
    }
  }

  renderer.render(scene, camera);
}

function movePacman(delta) {
  // Update rotation based on direction so that mouth is always facing forward.
  // The "mouth" part is on the side of the sphere, make it "look" up but
  // set the up direction so that it points forward.
  pacman.up.copy(pacman.direction).applyAxisAngle(UP, -Math.PI / 2);

  if (moveLeft) {
    pacman.position.x -= 0.1;
  }
  if (moveRight) {
    pacman.position.x += 0.1;
  }
  if (moveFront) {
    pacman.position.y += 0.1;
  }
  if (moveBack) {
    pacman.position.y -= 0.1;
  }

  // Check for collision with walls.
  var leftSide = pacman.position
    .clone()
    .addScaledVector(LEFT, PACMAN_RADIUS)
    .round();
  var topSide = pacman.position
    .clone()
    .addScaledVector(TOP, PACMAN_RADIUS)
    .round();
  var rightSide = pacman.position
    .clone()
    .addScaledVector(RIGHT, PACMAN_RADIUS)
    .round();
  var bottomSide = pacman.position
    .clone()
    .addScaledVector(BOTTOM, PACMAN_RADIUS)
    .round();
  if (isWall(map, leftSide)) {
    pacman.position.x = leftSide.x + 0.5 + PACMAN_RADIUS;
  }
  if (isWall(map, rightSide)) {
    pacman.position.x = rightSide.x - 0.5 - PACMAN_RADIUS;
  }
  if (isWall(map, topSide)) {
    pacman.position.y = topSide.y - 0.5 - PACMAN_RADIUS;
  }
  if (isWall(map, bottomSide)) {
    pacman.position.y = bottomSide.y + 0.5 + PACMAN_RADIUS;
  }

  var cell = getAt(map, pacman.position);

  // Make pacman eat dots.
  if (cell && cell.isDot === true && cell.visible === true) {
    removeAt(map, scene, pacman.position);
    numDotsEaten += 1;
  }

  // Make pacman eat power pellets.
  pacman.atePellet = false;
  if (cell && cell.isPowerPellet === true && cell.visible === true) {
    removeAt(map, scene, pacman.position);
    pacman.atePellet = true;

    killSound.play();
  }
}

var getAt = function (map, position) {
  var x = Math.round(position.x),
    y = Math.round(position.y);
  return map[y] && map[y][x];
};

var isWall = function (map, position) {
  var cell = getAt(map, position);
  return cell && cell.isWall === true;
};

var removeAt = function (map, scene, position) {
  var x = Math.round(position.x),
    y = Math.round(position.y);
  if (map[y] && map[y][x]) {
    /*scene.remove(map[y][x]);
            delete map[y][x];*/

    // Don't actually remove, just make invisible.
    map[y][x].visible = false;
  }
};

function updatePacman(delta, now) {
  // Play chomp sound if player is moving.
  if (!won && !lost && (moveFront || moveBack || moveLeft || moveRight)) {
    chompSound.play();
  } else {
    chompSound.pause();
  }

  // Move if we haven't died or won.
  if (!won && !lost) {
    if (pacman) {
      movePacman(delta);
    }
  }

  // Check for win.
  if (!won && numDotsEaten === map.numDots) {
    won = true;
    wonTime = now;
  }

  // Go to next level 4 seconds after winning.
  if (won && now - wonTime > 3) {
    // Reset pacman position and direction.
    pacman.position.copy(map.pacmanSpawn);
    pacman.direction.copy(LEFT);
    pacman.distanceMoved = 0;

    // Reset dots, power pellets, and ghosts.
    scene.children.forEach(function (object) {
      if (object.isDot === true || object.isPowerPellet === true)
        object.visible = true;
      if (object.isGhost === true) remove.push(object);
    });

    // Increase speed.
    PACMAN_SPEED += 1;
    GHOST_SPEED += 1;

    won = false;
    numDotsEaten = 0;
    numGhosts = 0;
  }

  // Reset pacman 4 seconds after dying.
  if (lives > 0 && lost && now - lostTime > 4) {
    lost = false;
    pacman.position.copy(map.pacmanSpawn);
    pacman.direction.copy(LEFT);
    pacman.distanceMoved = 0;
  }

  // Animate model
  if (lost) {
    // If pacman got eaten, show dying animation.
    var angle = ((now - lostTime) * Math.PI) / 2;
    var frame = Math.min(
      pacman.frames.length - 1,
      Math.floor((angle / Math.PI) * pacman.frames.length)
    );

    pacman.geometry = pacman.frames[frame];
  } else {
    // Otherwise, show eating animation based on how much pacman has moved.
    var maxAngle = Math.PI / 4;
    var angle = (pacman.distanceMoved * 2) % (maxAngle * 2);
    if (angle > maxAngle) angle = maxAngle * 2 - angle;
    var frame = Math.floor((angle / Math.PI) * pacman.frames.length);

    pacman.geometry = pacman.frames[frame];
  }
}

function update(delta, now) {
  updatePacman(delta, now);

  scene.children.forEach(function (object) {
    if (object.type === "Group") {
      object.children.forEach((child) => {
        if (child.isGhost === true) updateGhost(child, delta, now);
        if (child.isWrapper === true) wrapObject(child, map);
        if (child.isTemporary === true && now > child.removeAfter)
          remove.push(child);
      });
    }
  });

  // Cannot remove items from scene.children while iterating
  // through it, so remove them after the forEach loop.
  remove.forEach(scene.remove, scene);
  for (item in remove) {
    if (remove.hasOwnProperty(item)) {
      scene.remove(remove[item]);
      delete remove[item];
    }
  }

  // Spawn a ghost every 8 seconds, up to 4 ghosts.
  if (numGhosts < 4 && now - ghostSpawnTime > 8) {
    createGhost(scene, map.ghostSpawn);
    numGhosts += 1;
    ghostSpawnTime = now;
  }
}

var updateGhost = function (ghost, delta, now) {
  // Make all ghosts afraid if Pacman just ate a pellet.
  if (pacman.atePellet === true) {
    ghost.isAfraid = true;
    ghost.becameAfraidTime = now;

    ghost.material.color.setStyle("white");
  }

  // Make ghosts not afraid anymore after 10 seconds.
  if (ghost.isAfraid && now - ghost.becameAfraidTime > 10) {
    ghost.isAfraid = false;

    ghost.material.color.setStyle("red");
  }

  moveGhost(ghost, delta);

  // Check for collision between Pacman and ghost.
  if (!lost && !won && distance(pacman, ghost) < PACMAN_RADIUS + GHOST_RADIUS) {
    if (ghost.isAfraid === true) {
      remove.push(ghost);
      numGhosts -= 1;
      killSound.play();
    } else {
      // lives -= 1;
      lost = true;
      lostTime = now;
      deathSound.play();
    }
  }
};

var currentDirection = "right";
var moveGhost = function (ghost, delta) {
  var previousPosition = new THREE.Vector3();
  var currentPosition = new THREE.Vector3();
  previousPosition
    .copy(ghost.position)
    .addScaledVector(ghost.direction, 0.5)
    .round();
  currentPosition
    .copy(ghost.position)
    .addScaledVector(ghost.direction, 0.5)
    .round();

  var ghostLeftSide = ghost.position
    .clone()
    .addScaledVector(LEFT, PACMAN_RADIUS)
    .round();
  var ghostFrontSide = ghost.position
    .clone()
    .addScaledVector(TOP, PACMAN_RADIUS)
    .round();
  var ghostRightSide = ghost.position
    .clone()
    .addScaledVector(RIGHT, PACMAN_RADIUS)
    .round();
  var ghostBackSide = ghost.position
    .clone()
    .addScaledVector(BOTTOM, PACMAN_RADIUS)
    .round();

  if (currentDirection === "right" && isWall(map, ghostRightSide)) {
    let possibleTurns = ["left", "front", "back"];
    var newDirection =
      possibleTurns[Math.floor(Math.random() * possibleTurns.length)];
    currentDirection = newDirection;
  }
  if (currentDirection === "left" && isWall(map, ghostLeftSide)) {
    let possibleTurns = ["right", "front", "back"];
    var newDirection =
      possibleTurns[Math.floor(Math.random() * possibleTurns.length)];
    currentDirection = newDirection;
  }
  if (currentDirection === "front" && isWall(map, ghostFrontSide)) {
    let possibleTurns = ["right", "left", "back"];
    var newDirection =
      possibleTurns[Math.floor(Math.random() * possibleTurns.length)];
    currentDirection = newDirection;
  }
  if (currentDirection === "back" && isWall(map, ghostBackSide)) {
    let possibleTurns = ["right", "left", "front"];
    var newDirection =
      possibleTurns[Math.floor(Math.random() * possibleTurns.length)];
    currentDirection = newDirection;
  }

  switch (currentDirection) {
    case "right":
      ghost.position.x += 0.1;
      break;
    case "left":
      ghost.position.x -= 0.1;
      break;
    case "front":
      ghost.position.y += 0.1;
      break;
    case "back":
      ghost.position.y -= 0.1;
      break;
    default:
      break;
  }
};

var distance = function (object1, object2) {
  var difference = new THREE.Vector3();

  // Calculate difference between objects' positions.
  difference.copy(object1.position).sub(object2.position);

  return difference.length();
};

// Make object wrap to other side of map if it goes out of bounds.
var wrapObject = function (object, map) {
  if (object.position.x < map.left) object.position.x = map.right;
  else if (object.position.x > map.right) object.position.x = map.left;

  if (object.position.y > map.top) object.position.y = map.bottom;
  else if (object.position.y < map.bottom) object.position.y = map.top;
};
