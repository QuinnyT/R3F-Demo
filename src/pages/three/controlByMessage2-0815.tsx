// 添加: navmesh / position更新 / 动态避障 / 添加ControllableModel
// 修复：teleport后moveto动作的bug

import { useEffect, useRef, useState, Suspense } from 'react';

import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Color } from 'three';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
 import * as YUKA from 'yuka'

import useWebSocket, { usePlayers, useTeleports, useMoveTo, useBubbles, useMove, useAnimates } from '@/hooks/useWebSocket'
import { PlayerState, TeleportAction, MoveToAction, MoveState, IntVector, BubbleAction, ChatAction, MoveAction, AnimateAction } from '@/lib/proto-types'


const nameIdMap: { [key: number]: string } = {
  10001: "CheFu",
  10002: "WenRen",
  10003: "WuNvSimple",
}

type AnimationMap = {
  [key: string]: {
    [key: number]: string
  } 
}
const animationMap: AnimationMap = {
  "CheFu": {
    1: "Angry"
  },
  "WenRen": {
    1: "Happy",
    2: "Talk"
  },
  "WuNvSimple": {
    1: "Watch"
  }
}


// const players = mockData.state1;
declare module 'yuka' {
  interface Vehicle {
    playerId?: number;
  }
  interface GameEntity {
    playerId?: number;
  }
}

interface Position {
  playerId: number,
  position: IntVector
}

interface MovingModelProps {
  player: PlayerState
  otherPlayersPostion: Position[] | undefined
  userPosition: IntVector
  moveToAction?: MoveToAction | undefined
  moveAction?: MoveAction | undefined
  bubbleAction?: BubbleAction | undefined
  teleportAction?: TeleportAction | undefined
  animateAction?: AnimateAction | undefined
  chatAction?: ChatAction | undefined
}

// const MovingModel: React.FC<MovingModelProps> = (({player, playerId, playerYaw, playerPosition, otherPlayersPostion, userPosition, moveToAction, moveAction, bubbleAction, teleportAction, animateAction }) => {
const MovingModel: React.FC<MovingModelProps> = (({player, otherPlayersPostion, userPosition, moveToAction, moveAction, bubbleAction, teleportAction, animateAction }) => {

  const playerId = player.playerId;
  const playerPosition = player.position;
  const playerYaw = player.yaw;

  const entityManagerRef = useRef(new YUKA.EntityManager());
  
  const { setMovement, setPosAndYaw, setMoveToInProgress, setBubble, clearBubble, setNearbyPlayerIds } = usePlayers();
  const name = nameIdMap[playerId];
  const gltf = useLoader(GLTFLoader, '/' + name + '.glb');
  const characterModelRef = useRef<THREE.Object3D>(gltf.scene);
  
  const mixer = useRef<THREE.AnimationMixer>();
  
  const actions = useRef<THREE.AnimationAction[]>([]);
  
  const currentActionRef = useRef<THREE.AnimationAction>();

  const idleActionRef = useRef<THREE.AnimationAction>();

  const [isMovingTo, setIsMovingTo] = useState(false);

  const yukaTime = useRef(new YUKA.Time());
  const vehicleRef = useRef<YUKA.Vehicle>();
  const followPathBehaviorRef = useRef<YUKA.FollowPathBehavior>();

  // Load NavMesh
  const navmeshRef = useRef<YUKA.NavMesh>();
  useEffect(() => {
    const navmeshLoader = new YUKA.NavMeshLoader();
    navmeshLoader.load('/jiulou-navmesh.glb').then((navmesh) => {
      navmeshRef.current = navmesh;
    })

    if (positionSpriteRef.current)
      positionSpriteRef.current.renderOrder = 999; 
  }, []);

  const obstaclesRef = useRef<YUKA.GameEntity[]>([]);
  useEffect(() => {
    // console.log("otherPlayersPostion", otherPlayersPostion);
    
    // 获取其他player位置
    // const obstacles: YUKA.GameEntity[] = [];
    otherPlayersPostion?.forEach((pos: Position) => {
      const obstaclePosition = new YUKA.Vector3(pos.position.x, pos.position.y, pos.position.z);
      const distanceToObstacle = vehicleRef.current?.position.distanceTo(obstaclePosition);
      // console.log("distance", )
      const obstacle = new YUKA.GameEntity();
      if (distanceToObstacle && distanceToObstacle < 1) {
        obstacle.position.copy(obstaclePosition);
        obstacle.boundingRadius = 0.6;
        obstaclesRef.current.push(obstacle);
        entityManagerRef.current.add(obstacle);
      }
    });

    // console.log("userPosition", userPosition)
    const userObstaclePosition = new YUKA.Vector3(userPosition.x, userPosition.y, userPosition.z);
    const distanceToUser = vehicleRef.current?.position.distanceTo(userObstaclePosition);
    const userObstacle = new YUKA.GameEntity();
    if (distanceToUser && distanceToUser < 1) {
      userObstacle.position.copy(userObstaclePosition);
      userObstacle.boundingRadius = 0.6;
      obstaclesRef.current.push(userObstacle);
      entityManagerRef.current.add(userObstacle);
    }

    const vehicle = vehicleRef.current;
    const obstacleAvoidanceBehavior = new YUKA.ObstacleAvoidanceBehavior(obstaclesRef.current);
    if (vehicle)  vehicle.steering.add(obstacleAvoidanceBehavior);


    const removeObstaclesTimeout = setTimeout(() => {
      obstaclesRef.current.forEach(obstacle => entityManagerRef.current.remove(obstacle));
      obstaclesRef.current = [];
      if (vehicle)  vehicle.steering.remove(obstacleAvoidanceBehavior);
    }, 1000);

    return(() => {
      clearTimeout(removeObstaclesTimeout);

    })

  }, [otherPlayersPostion, userPosition]);

  useEffect(() => {
    if (!gltf) return;

    // 修复车夫模型全黑问题
    if ( name === "CheFu" ) {
      gltf.scene.traverse( function ( child ) {
        if ( (child as THREE.Mesh).isMesh ) {
          const mesh = child as THREE.Mesh;
          mesh.frustumCulled = false;
          //模型阴影
          mesh.castShadow = true;
          //模型自发光
          const material = mesh.material as THREE.MeshStandardMaterial
          material.emissive =  material.color;
          material.emissiveMap = material.map;
      }})
    }

    
    const characterModel = characterModelRef.current;
    // 动画
    mixer.current = new THREE.AnimationMixer(characterModel);
  
    gltf.animations.forEach((clip) => {
      const action = mixer.current!.clipAction(clip);
      if (clip.name === "Idle" ) {
        idleActionRef.current = action;
      }
      
      actions.current.push(action);
    });

    console.log("actions", actions);

    if (idleActionRef.current) {
      idleActionRef.current.play();
      currentActionRef.current = idleActionRef.current;
    }

    
  // if (mixer.current) {
    const handleFinished = (event: {action: THREE.AnimationAction; direction: number}) => {
      console.log("event", event)
      event.action.fadeOut(0.5);

      if (idleActionRef.current) {
        idleActionRef.current.reset().fadeIn(0.5).play();
        currentActionRef.current = idleActionRef.current;
      }
    };
  // }
    if (mixer.current) mixer.current.addEventListener('finished', (event) => handleFinished(event));


    // YUKA 
    const vehicle = new YUKA.Vehicle();
    vehicleRef.current = vehicle;
  
    // 初始化vehicle的位置和朝向
    vehicle.playerId = playerId;
    vehicle.position = new YUKA.Vector3(playerPosition.x, playerPosition.y, playerPosition.z); 
    
    const threeQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, - Math.PI * playerYaw / 180, 0, 'XYZ'));
  
    vehicle.rotation.copy(new YUKA.Quaternion(threeQuaternion.x, threeQuaternion.y, threeQuaternion.z, threeQuaternion.w));
   
    characterModel.matrixAutoUpdate = false;
  
    vehicle.maxForce = 10;
  
    vehicle.setRenderComponent(characterModel, sync);
    function sync(entity, renderComponent) {
        renderComponent.matrix.copy(entity.worldMatrix);
    }
  
    const followPathBehavior = new YUKA.FollowPathBehavior();
    followPathBehaviorRef.current = followPathBehavior;
    followPathBehavior.active = false;
    vehicle.steering.add(followPathBehavior);

    entityManagerRef.current.add(vehicle);

    return (() => {
      actions.current = [];
      if (mixer.current) mixer.current.removeEventListener('finished', handleFinished);
    })
  }, [gltf]);



  // const targetPositionRef = useRef<YUKA.Vector3>()
  const [targetPosition, setTargetPosition] = useState<YUKA.Vector3>();
  const [targetYaw, setTargetYaw] = useState<number>();
  
  useEffect(() => {
    if (moveToAction) {
      const position = moveToAction.position;
      const targetPosition = new YUKA.Vector3(position.x, position.y, position.z);
      // targetPositionRef.current = targetPosition;
      setTargetPosition(targetPosition);
      setTargetYaw(moveToAction.yaw);
      // setMoveState(moveToAction.moveState);
    //   // setMoveToPosition(new THREE.Vector3(targetPosition.x, targetPosition.y, targetPosition.z));
      
    //   // 使用yuka.js
      if (findPathTo(targetPosition)) {
        setIsMovingTo(true);
        startWalkingAction(moveToAction.moveState);
        // changeMovingState();
  
        setMoveToInProgress({playerId: playerId, state: true});
      }
    }
  }, [moveToAction]);

  useEffect(() => {
    if (!characterModelRef.current) return;
    if (moveAction) {
      // setMoveState(moveAction.moveState);
      const moveState = moveAction.moveState;
      if (isMovingTo) changeMovingState(moveState);
      setMovement({playerId: playerId, moveState: moveState});
    }
  }, [moveAction])


  const [bubbleText, setBubbleText] = useState("")
  const bubbleSpriteRef = useRef<THREE.Sprite>(null);
  useEffect(() => {
    if (!characterModelRef.current) return;
    if (bubbleAction) {
      console.log("bubbleAction changed", bubbleAction.text)
      setBubbleText(bubbleAction.text);
      setBubble({playerId: playerId, text: bubbleAction.text});

      setTimeout(() => {
        setBubbleText("");
        clearBubble(playerId);
      }, bubbleAction.duration);
    }
  }, [bubbleAction])


  const [teleportPosition, setTeleportPosition] = useState<IntVector>()
  const [teleportYaw, setTeleportYaw] = useState<number>()
  const [isTeleporting, setIsTeleporting] = useState(false);
  useEffect(() => {
    if (!characterModelRef.current) return;
    if (teleportAction) {
      stopMovingTo();
      setTeleportPosition(teleportAction.position);
      setTeleportYaw(teleportAction.yaw);
      setIsTeleporting(true);
    }
  }, [teleportAction])


  useEffect(() => {
    if (!characterModelRef.current) return;
    if (animateAction && !isMovingTo) {
      console.log("animateAction",  animationMap[name][animateAction.animateState])
      const animationName = animationMap[name][animateAction.animateState];
      const animation = actions.current.find((item) => item.getClip().name == animationName) as THREE.AnimationAction;
      if (animateAction.isRepeat) animation.setLoop(THREE.LoopRepeat, Infinity);
      else {
        animation.setLoop(THREE.LoopOnce, 1);
        animation.clampWhenFinished = true; 
      }
      
      changeAnimationState(animation);
    }
  }, [animateAction])


  useFrame(() => {
    
    const yukaDelta = yukaTime.current.update().getDelta();

    if (mixer.current) {
      mixer.current.update(yukaDelta);
    }

    const vehicle = vehicleRef.current as YUKA.Vehicle;

    // moveToAction相关 - 判断是否到达目的地
    if ( vehicle && targetPosition && isMovingTo ) {
      if (targetPosition) {
        const distance = vehicle.position.distanceTo(targetPosition);
        if (distance < 0.1) {
          stopMovingTo();
        }
      }
    }

    // teleportAction相关 - 设置转送后的旋转角度
    if (isTeleporting && teleportPosition && teleportYaw) {
      vehicle.position.copy(new YUKA.Vector3(teleportPosition.x, teleportPosition.y, teleportPosition.z));
      const threeQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, - Math.PI * teleportYaw / 180, 0, 'XYZ'));
      vehicle.rotation.copy(new YUKA.Quaternion(threeQuaternion.x, threeQuaternion.y, threeQuaternion.z, threeQuaternion.w));
      setIsTeleporting(false);
    }


    // 获取周围的 player
    const nearbyIds: number[] = [];
    otherPlayersPostion?.forEach((anotherPlayer: Position) => {
      const playerPosition = new YUKA.Vector3(anotherPlayer.position.x, anotherPlayer.position.y, anotherPlayer.position.z);
      const distanceToOtherPlayer = vehicleRef.current?.position.distanceTo(playerPosition);
      if (distanceToOtherPlayer && distanceToOtherPlayer < 5) {
        nearbyIds.push(anotherPlayer.playerId);
      }
    });
    setNearbyPlayerIds({playerId: playerId, nearbyPlayerIds: nearbyIds})
    

    // bubbleAction相关 - 同步[对话]气泡框位置
    bubbleSpriteRef.current?.position.copy(new THREE.Vector3(vehicle.position.x, vehicle.position.y + 2.2, vehicle.position.z));
    

    // 同步[位置]气泡框位置
    updatePositionSprite(vehicle.position);
    

    // 获取当前旋转角度
    const currentYaw = calculateRotationAngle(vehicle);


    // 向后台发送当前 player 的位置和旋转角度
    setPosAndYaw({
      playerId: playerId,
      position: {x: Math.round(vehicle.position.x) , y: Math.round(vehicle.position.y), z: Math.round(vehicle.position.z)},
      yaw: currentYaw
    })
    

    entityManagerRef.current.update(yukaDelta);

  });



  function findPathTo( target: YUKA.Vector3 ) {

    const vehicle = vehicleRef.current as YUKA.Vehicle;

    if (vehicle && navmeshRef.current) {
      const from = vehicle.position;
      const to = target;
      const path = navmeshRef.current.findPath(from, to);
      
      if (path) {
        vehicle.smoother = new YUKA.Smoother(30);

        const followPathBehavior = followPathBehaviorRef.current as YUKA.FollowPathBehavior;
        followPathBehavior.active = true;
        followPathBehavior.path.clear();

        for ( const point of path )
          followPathBehavior.path.add( point );
        return true;
      }
      else return false;
    }

  }

  function stopMovingTo() {

    const vehicle = vehicleRef.current as YUKA.Vehicle;

    setIsMovingTo(false);
    stopWalkingAction();
    setMoveToInProgress({playerId: playerId, state: false});
    setMovement({playerId: playerId, moveState: MoveState.STOP})
    if (vehicle) {
      
      const followPathBehavior = followPathBehaviorRef.current as YUKA.FollowPathBehavior;
      
      if ( followPathBehavior ) {
        followPathBehavior.active = false;
      }
      vehicle.velocity.set(0, 0, 0); // 重置速度向量以停止移动
      vehicle.smoother = null;

      if (targetYaw) {
        const threeQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, - Math.PI * targetYaw / 180, 0, 'XYZ'));
        vehicle.rotation.copy(new YUKA.Quaternion(threeQuaternion.x, threeQuaternion.y, threeQuaternion.z, threeQuaternion.w));
      }
    }
  }

  function startWalkingAction(moveState: MoveState) {
    const movingAction = actions.current.find((item) => item.getClip().name == MoveState[moveState]);
    if (movingAction)
      changeAnimationState(movingAction);
  }

  function stopWalkingAction() {
    if (idleActionRef.current)
      changeAnimationState(idleActionRef.current);
  }

  function changeMovingState(moveState: MoveState) {
    const vehicle = vehicleRef.current as YUKA.Vehicle;
    vehicle.maxSpeed = Number(moveState);
    vehicle.velocity.copy(vehicle.velocity).normalize().multiplyScalar(Number(moveState));
    
    const movingAction = actions.current.find((item) => item.getClip().name == MoveState[moveState]);

    // movingAction?.setLoop(THREE.LoopPingPong, Infinity);
    if (movingAction)
      changeAnimationState(movingAction);
  }

  function changeAnimationState(action: THREE.AnimationAction) {
    if (action && !action.isRunning()) {
      currentActionRef.current?.fadeOut(0.1);
      action.reset().fadeIn(0.5).play();
      currentActionRef.current = action;
    }
  }

  function calculateRotationAngle(vehicle: YUKA.Vehicle): number {
    const worldMatrix = vehicle.worldMatrix.elements;
    const rotationMatrix = new THREE.Matrix4();
    rotationMatrix.set(
        worldMatrix[0], worldMatrix[1], worldMatrix[2],  0,
        worldMatrix[4], worldMatrix[5], worldMatrix[6],  0,
        worldMatrix[8], worldMatrix[9], worldMatrix[10], 0,
        0,             0,              0,             1
    );
    
    const quaternion = new THREE.Quaternion();
    rotationMatrix.decompose(new THREE.Vector3(), quaternion, new THREE.Vector3());
    
    const euler = new THREE.Euler().setFromQuaternion(quaternion);

    const angleInDegree = euler.y * (180 / Math.PI);

    return angleInDegree;
  }

  // Position Sprite - 用于显示当前坐标
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  context.font = '48px Arial';

  context.fillStyle = 'rgba(255, 255, 255, 0.6)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'white';
  context.fillText(bubbleText, 100, 100);

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 1 });
 
  const positionSpriteRef = useRef<THREE.Sprite>(null);
  const positionCanvasRef = useRef(document.createElement('canvas'));
  const positionContextRef = useRef(positionCanvasRef.current.getContext('2d'));
  const positionTextureRef = useRef(new THREE.CanvasTexture(positionCanvasRef.current));
  const positionMaterialRef = useRef(new THREE.SpriteMaterial({ map: positionTextureRef.current, transparent: true, opacity: 1 }))
  positionTextureRef.current.needsUpdate = true;

  function updatePositionSprite(vehiclePosition: IntVector) {
    
    const positionX = vehiclePosition.x;
    const positionY = vehiclePosition.y;
    const positionZ = vehiclePosition.z;

    const positionContext = positionContextRef.current!;
    const positionCanvas = positionCanvasRef.current;
    const positionTexture = positionTextureRef.current;
    positionContext.clearRect(0, 0, positionCanvas.width, positionCanvas.height);
    positionContext.font = '42px Arial';
    positionContext.fillStyle = 'rgba(255, 255, 255, 0)';
    positionContext.fillRect(positionCanvas.width/2, 0, positionCanvas.width, positionCanvas.height);
    positionContext.fillStyle = 'white';
    positionContext.fillText(`[ ${positionX.toFixed(1)}, ${positionY.toFixed(1)}, ${positionZ.toFixed(1)} ]`, 0, 100);
    positionTexture.needsUpdate = true;
  
    positionSpriteRef.current?.position.copy(new THREE.Vector3(positionX + 1, positionY + 0.1, positionZ));
  }
  
  return (
    <>
      {bubbleText && bubbleText !== "" ? <sprite ref={bubbleSpriteRef} position={[playerPosition.x, playerPosition.y + 2.2, playerPosition.z]} material={spriteMaterial} scale={[1, 0.5, 1]}/> : null}
      <sprite ref={positionSpriteRef} position={[playerPosition.x, playerPosition.y - 0.2, playerPosition.z]} material={positionMaterialRef.current} scale={[1, 0.5, 1]}/>
      <primitive object={characterModelRef.current} position={[playerPosition.x, playerPosition.y, playerPosition.z]}/>
    </>
  );
});



type KeysPressed = {
  [key: string]: boolean;
};
const keysPressed: KeysPressed = {};

document.addEventListener('keydown', (event: KeyboardEvent) => {
  keysPressed[event.key.toLowerCase()] = true;
});

document.addEventListener('keyup', (event: KeyboardEvent) => {
  keysPressed[event.key.toLowerCase()] = false;
});

const ControllableModel: React.FC<{commitPosition: (position: THREE.Vector3) => void}> = ({commitPosition}) => {

  const gltf = useLoader(GLTFLoader, '/GirlWithAnima.glb');
  const characterModelRef = useRef<THREE.Object3D>(gltf.scene);

  const mixer = useRef<THREE.AnimationMixer>();
  const idleActionRef = useRef<THREE.AnimationAction>();
  const walkingActionRef = useRef<THREE.AnimationAction>();
  const currentActionRef = useRef<THREE.AnimationAction>();

  const actions = useRef<THREE.AnimationAction[]>([]);
  const yukaTime = useRef(new YUKA.Time());

  useEffect(() => {
    if (!gltf) return;
    const characterModel = characterModelRef.current;
    // 动画
    mixer.current = new THREE.AnimationMixer(characterModel);
  
    gltf.animations.forEach((clip) => {
      const action = mixer.current!.clipAction(clip);
      if (clip.name === "Idle" ) idleActionRef.current = action;
      if (clip.name === "WALK" ) walkingActionRef.current = action;
      
      actions.current.push(action);
    });

    console.log("actions", actions);

    if (idleActionRef.current) {
      idleActionRef.current.play();
      currentActionRef.current = idleActionRef.current;
    }


    return (() => {
      actions.current = [];
    })
  }, [gltf]);

  if (!mixer.current) {
    mixer.current = new THREE.AnimationMixer(characterModelRef.current);
  }

  function updateMovement(delta: number) {
    const model = characterModelRef.current;
    const speed = 1; // 调整速度
    const distance = speed * delta;

      if (keysPressed['w']) { // 前进
        model.translateZ(distance);
      }
      if (keysPressed['s']) { // 后退
          model.translateZ(-distance);
      }
      if (keysPressed['a']) { // 左转
          model.rotation.y += distance;
      }
      if (keysPressed['d']) { // 右转
          model.rotation.y -= distance;
      }
  }


  function updateAnimation() {
    if ( keysPressed['w'] || keysPressed['s'] || keysPressed['a'] || keysPressed['d']) {
      startWalkingAction();
    }
    else {
      stopWalkingAction();
    }
    
  }

  
  function startWalkingAction() {
    if (walkingActionRef.current && !walkingActionRef.current.isRunning()) {
      idleActionRef.current?.fadeOut(0.1);
      walkingActionRef.current.reset().fadeIn(0.5).play();
      currentActionRef.current = walkingActionRef.current;
    }
  }

  function stopWalkingAction() {
    if (idleActionRef.current && !idleActionRef.current.isRunning()) {
      walkingActionRef.current?.fadeOut(0.1);
      idleActionRef.current.reset().fadeIn(0.5).play();
      currentActionRef.current = idleActionRef.current;
    }
  }
  
  // 设置相机位置
  const cameraOffset = new THREE.Vector3(0, 2, 5);
  useFrame(( state, delta ) => {
    const yukaDelta = yukaTime.current.update().getDelta();

    updateMovement(delta);
    updateAnimation();

    if (mixer.current) {
      mixer.current.update(yukaDelta);
    }
    
    commitPosition(characterModelRef.current.position);

  });
  
  return (
    <>
      {/* <OrbitControls ref={controlsRef} position={[characterModelRef.current.position.x, characterModelRef.current.position.y + 1, characterModelRef.current.position.z - 1]}/> */}
      <primitive object={characterModelRef.current} position={[characterModelRef.current.position.x, characterModelRef.current.position.y, characterModelRef.current.position.z]} rotation={[0, Math.PI / 2, 0]}/>
    </>
  );
};


const Background = () => {
  const gltf = useLoader(GLTFLoader, '/jiulou.glb');
  const model = gltf.scene;

  return <primitive object={model} />;
};

// 显示 NavMesh
const NavMeshGround = () => {
  const gltf = useLoader(GLTFLoader, '/jiulou-navmesh.glb');
  const model = gltf.scene;

  return <primitive object={model} />;
};

// 增加障碍物
const Obstacle = ({ position }: { position: YUKA.Vector3 }) => {

  const geometryRef = useRef(null);
  const meshRef = useRef(null);

  useEffect(() => {
    console.log("geometryRef.current", geometryRef.current)
  }, [])


  return (
    <mesh position={[position.x, position.y, position.z]}>
      <sphereGeometry ref={geometryRef} args={[0.6, 16, 16]} />
      <meshStandardMaterial ref={meshRef} color="blue" />
    </mesh>
  );
};


const Scene: React.FC<{width: number, height: number}> = ({width, height}) => {
  useWebSocket('ws://localhost:8080');
  const canvasRef = useRef<HTMLDivElement>(null);

  const { players } = usePlayers();
  const { moveToActions } = useMoveTo();
  const { moveActions } = useMove();
  const { bubbleActions } = useBubbles();
  const { teleportActions } = useTeleports();
  const { animateActions } = useAnimates();

  const [userPosition, setUserPosition] = useState<IntVector>({x: 0, y: 0, z: 0})
  const commitPosition = (position: THREE.Vector3) => {
    setUserPosition({x: position.x, y: position.y, z: position.z});
  };

  const bgColor = new Color(0xffffff);

  
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.style.width = width + 'px';
        canvasRef.current.style.height = height + 'px';
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
    <div ref={canvasRef}>
      <Canvas style={{ width: width + 'px', height: height + 'px' }} camera={{ fov: 75, position: [1, 2, 9] }}>
        {/* <color attach="background" args={[bgColor.r, bgColor.g, bgColor.b]} /> */}
        <OrbitControls/>
          <Suspense fallback={null}>

            {players.map((player) => 
              (<MovingModel key={player.playerId}
                            player={player}
                            otherPlayersPostion={players.filter(item => item.playerId !== player.playerId)}
                            userPosition={userPosition}
                            moveToAction={moveToActions.length > 0 ? moveToActions.find(item => item.playerId === player.playerId) : undefined}
                            moveAction={moveActions.length > 0 ? moveActions.find(item => item.playerId === player.playerId) : undefined}
                            bubbleAction={bubbleActions.length > 0 ? bubbleActions.find(item => item.playerId === player.playerId) : undefined}
                            teleportAction={teleportActions.find(item => item.playerId === player.playerId)}
                            animateAction={animateActions.find(item => item.playerId === player.playerId)}
                   />)
            )}
            <ControllableModel commitPosition={commitPosition}/>

            <Background />
            {/* <NavMeshGround /> */}
          </Suspense>
        <ambientLight intensity={2} color={0xffffff} />
        <pointLight position={[10, 10, 10]} />
      </Canvas>
    </div>
    </>
  );
};

export default Scene;
