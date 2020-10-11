// import * as THREE from "three";
import * as THREE from "./node_modules/three/src/Three.js";

(function () {
  // Constants
  // =========
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
  var controller, reticle;
  var LEVEL = [
    "# # # # # # # # # # # # # # # # # # # # # # # # # # # #",
    "# . . . . . . . . . . . . # # . . . . . . . . . . . . #",
    "# . # # # # . # # # # # . # # . # # # # # . # # # # . #",
    "# o # # # # . # # # # # . # # . # # # # # . # # # # o #",
    "# . # # # # . # # # # # . # # . # # # # # . # # # # . #",
    "# . . . . . . . . . . . . . . . . . . . . . . . . . . #",
    "# . # # # # . # # . # # # # # # # # . # # . # # # # . #",
    "# . # # # # . # # . # # # # # # # # . # # . # # # # . #",
    "# . . . . . . # # . . . . # # . . . . # # . . . . . . #",
    "# # # # # # . # # # # #   # #   # # # # # . # # # # # #",
    "          # . # # # # #   # #   # # # # # . #          ",
    "          # . # #         G           # # . #          ",
    "          # . # #   # # # # # # # #   # # . #          ",
    "# # # # # # . # #   #             #   # # . # # # # # #",
    "            .       #             #       .            ",
    "# # # # # # . # #   #             #   # # . # # # # # #",
    "          # . # #   # # # # # # # #   # # . #          ",
    "          # . # #                     # # . #          ",
    "          # . # #   # # # # # # # #   # # . #          ",
    "# # # # # # . # #   # # # # # # # #   # # . # # # # # #",
    "# . . . . . . . . . . . . # # . . . . . . . . . . . . #",
    "# . # # # # . # # # # # . # # . # # # # # . # # # # . #",
    "# . # # # # . # # # # # . # # . # # # # # . # # # # . #",
    "# o . . # # . . . . . . . P   . . . . . . . # # . . o #",
    "# # # . # # . # # . # # # # # # # # . # # . # # . # # #",
    "# # # . # # . # # . # # # # # # # # . # # . # # . # # #",
    "# . . . . . . # # . . . . # # . . . . # # . . . . . . #",
    "# . # # # # # # # # # # . # # . # # # # # # # # # # . #",
    "# . # # # # # # # # # # . # # . # # # # # # # # # # . #",
    "# . . . . . . . . . . . . . . . . . . . . . . . . . . #",
    "# # # # # # # # # # # # # # # # # # # # # # # # # # # #",
  ];

  // Game-specific functions
  // =======================
  var createMap = function (scene, levelDefinition) {
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
        } else if (cell === "G") {
          map.ghostSpawn = new THREE.Vector3(x, y, 0);
        }

        if (object !== null) {
          object.position.set(x, y, 0);

          map[y][x] = object;
          scene.add(object);
        }
      }
    }

    map.centerX = (map.left + map.right) / 2;
    map.centerY = (map.bottom + map.top) / 2;

    return map;
  };

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

  var createWall = (function () {
    var wallGeometry = new THREE.BoxGeometry(1, 1, 1);
    var wallMaterial = new THREE.MeshLambertMaterial({ color: "blue" });

    return function () {
      var wall = new THREE.Mesh(wallGeometry, wallMaterial);
      wall.isWall = true;

      return wall;
    };
  })();

  var createDot = (function () {
    var dotGeometry = new THREE.SphereGeometry(DOT_RADIUS);
    var dotMaterial = new THREE.MeshPhongMaterial({ color: 0xffdab9 }); // Paech color

    return function () {
      var dot = new THREE.Mesh(dotGeometry, dotMaterial);
      dot.isDot = true;

      return dot;
    };
  })();

  var createPowerPellet = (function () {
    var pelletGeometry = new THREE.SphereGeometry(PELLET_RADIUS, 12, 8);
    var pelletMaterial = new THREE.MeshPhongMaterial({ color: 0xffdab9 }); // Paech color

    return function () {
      var pellet = new THREE.Mesh(pelletGeometry, pelletMaterial);
      pellet.isPowerPellet = true;

      return pellet;
    };
  })();

  var createRenderer = function () {
    var renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setClearColor("black", 1.0);
    renderer.setSize(window.innerWidth, window.innerHeight);

    document.body.appendChild(renderer.domElement);

    return renderer;
  };

  var createScene = function () {
    var scene = new THREE.Scene();

    // Add lighting
    scene.add(new THREE.AmbientLight(0x888888));
    var light = new THREE.SpotLight("white", 0.5);
    light.position.set(0, 0, 50);
    scene.add(light);

    return scene;
  };

  var createHudCamera = function (map) {
    var halfWidth = (map.right - map.left) / 2,
      halfHeight = (map.top - map.bottom) / 2;

    var hudCamera = new THREE.OrthographicCamera(
      -halfWidth,
      halfWidth,
      halfHeight,
      -halfHeight,
      1,
      100
    );
    hudCamera.position.copy(new THREE.Vector3(map.centerX, map.centerY, 10));
    hudCamera.lookAt(new THREE.Vector3(map.centerX, map.centerY, 0));

    return hudCamera;
  };

  var renderHud = function (renderer, hudCamera, scene) {
    // Increase size of pacman and dots in HUD to make them easier to see.
    scene.children.forEach(function (object) {
      if (object.isWall !== true) object.scale.set(2.5, 2.5, 2.5);
    });

    // Only render in the bottom left 200x200 square of the screen.
    renderer.setScissorTest(true);
    renderer.setScissor(10, 10, 200, 200);
    renderer.setViewport(10, 10, 200, 200);
    renderer.render(scene, hudCamera);
    renderer.setScissorTest(false);

    // Reset scales after rendering HUD.
    scene.children.forEach(function (object) {
      object.scale.set(1, 1, 1);
    });
  };

  var createPacman = (function () {
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

    return function (scene, position) {
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

      scene.add(pacman);

      return pacman;
    };
  })();

  var createGhost = (function () {
    var ghostGeometry = new THREE.SphereGeometry(GHOST_RADIUS, 16, 16);

    return function (scene, position) {
      // Give each ghost it's own material so we can change the colors of individual ghosts.
      var ghostMaterial = new THREE.MeshPhongMaterial({ color: "red" });
      var ghost = new THREE.Mesh(ghostGeometry, ghostMaterial);
      ghost.isGhost = true;
      ghost.isWrapper = true;
      ghost.isAfraid = false;

      // Ghosts start moving left.
      ghost.position.copy(position);
      ghost.direction = new THREE.Vector3(-1, 0, 0);

      scene.add(ghost);
    };
  })();

  // Make object wrap to other side of map if it goes out of bounds.
  var wrapObject = function (object, map) {
    if (object.position.x < map.left) object.position.x = map.right;
    else if (object.position.x > map.right) object.position.x = map.left;

    if (object.position.y > map.top) object.position.y = map.bottom;
    else if (object.position.y < map.bottom) object.position.y = map.top;
  };

  // Generic functions
  // =================
  var distance = (function () {
    var difference = new THREE.Vector3();

    return function (object1, object2) {
      // Calculate difference between objects' positions.
      difference.copy(object1.position).sub(object2.position);

      return difference.length();
    };
  })();

  // Returns an object that contains the current state of keys being pressed.
  var createKeyState = function () {
    // Keep track of current keys being pressed.
    var keyState = {};

    document.body.addEventListener("keydown", function (event) {
      keyState[event.keyCode] = true;
      keyState[String.fromCharCode(event.keyCode)] = true;
    });
    document.body.addEventListener("keyup", function (event) {
      keyState[event.keyCode] = false;
      keyState[String.fromCharCode(event.keyCode)] = false;
    });
    document.body.addEventListener("blur", function (event) {
      // Make it so that all keys are unpressed when the browser loses focus.
      for (var key in keyState) {
        if (keyState.hasOwnProperty(key)) keyState[key] = false;
      }
    });

    return keyState;
  };

  var animationLoop = function (callback, requestFrameFunction) {
    requestFrameFunction = requestFrameFunction || requestAnimationFrame;

    var previousFrameTime = window.performance.now();

    // How many seconds the animation has progressed in total.
    var animationSeconds = 0;

    var render = function () {
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

      callback(animationDelta, animationSeconds);

      requestFrameFunction(render);
    };

    requestFrameFunction(render);
  };

  // Main function
  // =============
  var main = function () {
    // Game state variables
    var keys = createKeyState();

    var renderer = createRenderer();
    var scene = createScene();

    var map = createMap(scene, LEVEL);
    var numDotsEaten = 0;

    var camera = new THREE.PerspectiveCamera(
      65,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.up.copy(UP);
    camera.targetPosition = new THREE.Vector3();
    camera.targetLookAt = new THREE.Vector3();
    camera.lookAtPosition = new THREE.Vector3();

    var hudCamera = createHudCamera(map);

    var pacman = createPacman(scene, map.pacmanSpawn);

    var ghostSpawnTime = -8;
    var numGhosts = 0;

    var won = (lost = false);
    var lostTime, wonTime;

    var chompSound = new Audio("./pacman_chomp.mp3");
    chompSound.volume = 0.5;
    chompSound.loop = true;
    chompSound.preload = "auto";

    var levelStartSound = new Audio("./pacman_beginning.mp3");
    levelStartSound.preload = "auto";
    // Play the level start sound as soon as the game starts.
    levelStartSound.autoplay = true;

    var deathSound = new Audio("./pacman_death.mp3");
    deathSound.preload = "auto";

    var killSound = new Audio("./pacman_eatghost.mp3");
    killSound.preload = "auto";

    var remove = [];

    // Create life images
    var lives = 3;
    var livesContainer = document.getElementById("lives");
    for (var i = 0; i < lives; i++) {
      var life = document.createElement("img");
      life.src = "./pacman.png";
      life.className = "life";

      livesContainer.appendChild(life);
    }

    //controller
    // controller = renderer.xr.getController(0);
    // controller.addEventListener("select", onSelect);
    // scene.add(controller);

    // Main game logic
    var update = function (delta, now) {
      updatePacman(delta, now);

      updateCamera(delta, now);

      scene.children.forEach(function (object) {
        if (object.isGhost === true) updateGhost(object, delta, now);
        if (object.isWrapper === true) wrapObject(object, map);
        if (object.isTemporary === true && now > object.removeAfter)
          remove.push(object);
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
    };

    var _diff = new THREE.Vector3();
    var showText = function (message, size, now) {
      var textMaterial = new THREE.MeshPhongMaterial({ color: "red" });

      // Show 3D text banner.
      var textGeometry = new THREE.TextGeometry(message, {
        size: size,
        height: 0.05,
        font: "Helvetiker",
      });

      var text = new THREE.Mesh(textGeometry, textMaterial);

      // Position text just above pacman.
      text.position.copy(pacman.position).add(UP);

      // Rotate text so that it faces same direction as pacman.
      text.up.copy(pacman.direction);
      text.lookAt(text.position.clone().add(UP));

      // Remove after 3 seconds.
      text.isTemporary = true;
      text.removeAfter = now + 3;

      scene.add(text);

      return text;
    };

    var updatePacman = function (delta, now) {
      // Play chomp sound if player is moving.
      if (!won && !lost && (keys["W"] || keys["S"])) {
        chompSound.play();
      } else {
        chompSound.pause();
      }

      // Move if we haven't died or won.
      if (!won && !lost) {
        movePacman(delta);
      }

      // Check for win.
      if (!won && numDotsEaten === map.numDots) {
        won = true;
        wonTime = now;

        var text = showText("You won =D", 1, now);

        levelStartSound.play();
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
    };

    var _lookAt = new THREE.Vector3();
    var movePacman = function (delta) {
      // Update rotation based on direction so that mouth is always facing forward.
      // The "mouth" part is on the side of the sphere, make it "look" up but
      // set the up direction so that it points forward.
      pacman.up.copy(pacman.direction).applyAxisAngle(UP, -Math.PI / 2);
      pacman.lookAt(_lookAt.copy(pacman.position).add(UP));

      // Move based on current keys being pressed.
      if (keys["W"]) {
        // W - move forward
        //pacman.translateOnAxis(pacman.direction, PACMAN_SPEED * delta);
        // Because we are rotating the object above using lookAt, "forward" is to the left.
        pacman.translateOnAxis(LEFT, PACMAN_SPEED * delta);
        pacman.distanceMoved += PACMAN_SPEED * delta;
      }
      if (keys["A"]) {
        // A - rotate left
        pacman.direction.applyAxisAngle(UP, (Math.PI / 2) * delta);
      }
      if (keys["D"]) {
        // D - rotate right
        pacman.direction.applyAxisAngle(UP, (-Math.PI / 2) * delta);
      }
      if (keys["S"]) {
        // S - move backward
        //pacman.translateOnAxis(pacman.direction, -PACMAN_SPEED * delta);
        pacman.translateOnAxis(LEFT, -PACMAN_SPEED * delta);
        pacman.distanceMoved += PACMAN_SPEED * delta;
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
    };

    var updateCamera = function (delta, now) {
      if (won) {
        // After winning, pan camera out to show whole level.
        camera.targetPosition.set(map.centerX, map.centerY, 30);
        camera.targetLookAt.set(map.centerX, map.centerY, 0);
      } else if (lost) {
        // After losing, move camera to look down at pacman's body from above.
        camera.targetPosition = pacman.position.clone().addScaledVector(UP, 4);
        camera.targetLookAt = pacman.position
          .clone()
          .addScaledVector(pacman.direction, 0.01);
      } else {
        // Place camera above and behind pacman, looking towards direction of pacman.
        camera.targetPosition
          .copy(pacman.position)
          .addScaledVector(UP, 1.5)
          .addScaledVector(pacman.direction, -1);
        camera.targetLookAt.copy(pacman.position).add(pacman.direction);
      }

      // Move camera slowly during win/lose animations.
      var cameraSpeed = lost || won ? 1 : 10;
      camera.position.lerp(camera.targetPosition, delta * cameraSpeed);
      camera.lookAtPosition.lerp(camera.targetLookAt, delta * cameraSpeed);
      camera.lookAt(camera.lookAtPosition);
    };

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
      if (
        !lost &&
        !won &&
        distance(pacman, ghost) < PACMAN_RADIUS + GHOST_RADIUS
      ) {
        if (ghost.isAfraid === true) {
          remove.push(ghost);
          numGhosts -= 1;

          killSound.play();
        } else {
          lives -= 1;
          // Unshow life
          document.getElementsByClassName("life")[lives].style.display = "none";

          if (lives > 0) showText("You died =(", 0.1, now);
          else showText("Game over =(", 0.1, now);

          lost = true;
          lostTime = now;

          deathSound.play();
        }
      }
    };

    var moveGhost = (function () {
      var previousPosition = new THREE.Vector3();
      var currentPosition = new THREE.Vector3();
      var leftTurn = new THREE.Vector3();
      var rightTurn = new THREE.Vector3();

      return function (ghost, delta) {
        previousPosition
          .copy(ghost.position)
          .addScaledVector(ghost.direction, 0.5)
          .round();
        ghost.translateOnAxis(ghost.direction, delta * GHOST_SPEED);
        currentPosition
          .copy(ghost.position)
          .addScaledVector(ghost.direction, 0.5)
          .round();

        // If the ghost is transitioning from one cell to the next, see if they can turn.
        if (!currentPosition.equals(previousPosition)) {
          leftTurn.copy(ghost.direction).applyAxisAngle(UP, Math.PI / 2);
          rightTurn.copy(ghost.direction).applyAxisAngle(UP, -Math.PI / 2);

          var forwardWall = isWall(map, currentPosition);
          var leftWall = isWall(
            map,
            currentPosition.copy(ghost.position).add(leftTurn)
          );
          var rightWall = isWall(
            map,
            currentPosition.copy(ghost.position).add(rightTurn)
          );

          if (!leftWall || !rightWall) {
            // If the ghsot can turn, randomly choose one of the possible turns.
            var possibleTurns = [];
            if (!forwardWall) possibleTurns.push(ghost.direction);
            if (!leftWall) possibleTurns.push(leftTurn);
            if (!rightWall) possibleTurns.push(rightTurn);

            if (possibleTurns.length === 0)
              throw new Error("A ghost got stuck!");

            var newDirection =
              possibleTurns[Math.floor(Math.random() * possibleTurns.length)];
            ghost.direction.copy(newDirection);

            // Snap ghost to center of current cell and start moving in new direction.
            ghost.position.round().addScaledVector(ghost.direction, delta);
          }
        }
      };
    })();

    // Main game loop
    animationLoop(function (delta, now) {
      update(delta, now);

      // Render main view
      renderer.setViewport(
        0,
        0,
        renderer.domElement.width,
        renderer.domElement.height
      );
      renderer.render(scene, camera);

      // Render HUD
      renderHud(renderer, hudCamera, scene);
    });
  };

  main();
})();
