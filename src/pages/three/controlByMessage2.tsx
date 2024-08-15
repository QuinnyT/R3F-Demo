// 添加: navmesh / position更新 / 动态避障 / 添加ControllableModel
// 修复：teleport后moveto动作的bug

import { useEffect, useRef, useState, Suspense } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { OrbitControls as ThreeOrbitControls } from 'three-stdlib';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// import { GameEntity, EntityManager, SteeringBehavior, ObstacleAvoidanceBehavior, FollowPathBehavior, Path, Vector3, SteeringManager } from 'yuka';
 import * as YUKA from 'yuka'

import useWebSocket, { usePlayers, useTeleports, useMoveTo, useBubbles, PlayerState, TeleportAction, MoveToAction, MoveState, IntVector, BubbleAction, ChatAction, useMove, MoveAction, useAnimates, AnimateAction } from '@/hooks/useWebSocket'
import { func, positionView } from 'three/examples/jsm/nodes/Nodes.js';
import { Color } from 'three';


const nameIdMap: { [key: number]: string } = {
  10001: "CheFu",
  10002: "WenRen",
  10003: "WuNvSimple",
}

// const animationMap: { [key: number]: string } = {
//   1: "Angry",
//   // 2: "Happy",
//   // 3: "Victory"
// }

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
  playerId: number
  playerYaw: number
  playerPosition: IntVector
  otherPlayersPostion: Position[] | undefined
  userPosition: IntVector
  moveToAction?: MoveToAction | undefined
  moveAction?: MoveAction | undefined
  bubbleAction?: BubbleAction | undefined
  teleportAction?: TeleportAction | undefined
  animateAction?: AnimateAction | undefined
  chatAction?: ChatAction | undefined
}

const MovingModel: React.FC<MovingModelProps> = (({player, playerId, playerYaw, playerPosition, otherPlayersPostion, userPosition, moveToAction, moveAction, bubbleAction, teleportAction, animateAction }) => {
 

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
      // if ( index === 0 ) waitingActionRef.current = action;
      // actions.current.push(action);
      if (clip.name === "Idle" ) {
        idleActionRef.current = action;
      }
      
      actions.current.push(action);
    });

    console.log("actions", actions);

    if (idleActionRef.current) {
      idleActionRef.current.play();
      // setCurrentAction(idleActionRef.current);
      currentActionRef.current = idleActionRef.current;
    }

    
  // if (mixer.current) {
    const handleFinished = (event: {action: THREE.AnimationAction; direction: number}) => {
      console.log("event", event)
      event.action.fadeOut(0.5);
      // const finishedActionName = event.action.getClip().name;
      // const finishingAction = actions.current.find(item => item.getClip().name == finishedActionName);

      if (idleActionRef.current) {
        idleActionRef.current.reset().fadeIn(0.5).play();
        // setCurrentAction(idleActionRef.current);
        currentActionRef.current = idleActionRef.current;
        // changeAnimationState(idleActionRef.current);
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
    // console.log("threeQuaternion", threeQuaternion)
    vehicle.rotation.copy(new YUKA.Quaternion(threeQuaternion.x, threeQuaternion.y, threeQuaternion.z, threeQuaternion.w));
   
    characterModel.matrixAutoUpdate = false;
  
    // if (moveState && Number(moveState) > 0) vehicle.maxSpeed = Number(moveState);
    // else vehicle.maxSpeed = 1;
    vehicle.maxForce = 10;
    // vehicle.smoother = new YUKA.Smoother(30);
  
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
  const [moveState, setMoveState] = useState<MoveState>();
  const movingAnimationRef = useRef<THREE.AnimationAction>();
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


  // useEffect(() => {
  //   if (moveState) {
  //     movingAnimationRef.current = actions.current.find((item) => item.getClip().name == MoveState[moveState]);
  //     // if (currentActionRef.current?.getClip().name === 'Idle')
  //     //   startWalkingAction();
  //     // else
  //     //   changeMovingState();
      
  //     // changeMovingState();
      
  //     setMovement({playerId: playerId, moveState: moveState});   // 更新player moveState
  //   }
  // }, [moveState])


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

  // useEffect(() => {
  //   if (bubbleText !== "" && bubbleAction)
  //     setBubble({
  //       playerId: playerId,
  //       text: bubbleText,
  //       duration: bubbleAction.duration
  //     });
  //   else clearBubble(playerId);
  // }, [bubbleText])
  // const time = new YUKA.Time();

  useFrame(() => {
    
    const yukaDelta = yukaTime.current.update().getDelta();

    if (mixer.current) {
      mixer.current.update(yukaDelta);
    }

    // const vehicle = entityManagerRef.current.entities.find(item => item.playerId == playerId) as YUKA.Vehicle;
    const vehicle = vehicleRef.current as YUKA.Vehicle;

    // const threeQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, - Math.PI * 45 / 180, 0, 'XYZ'));
    // vehicle.rotation.copy(new YUKA.Quaternion(threeQuaternion.x, threeQuaternion.y, threeQuaternion.z, threeQuaternion.w));
    
    // if( vehicle && targetPositionRef.current && isMovingTo ) {
    if ( vehicle && targetPosition && isMovingTo ) {
      if (targetPosition) {
        const distance = vehicle.position.distanceTo(targetPosition);
        if (distance < 0.1) {
          // setIsMovingTo(false);
          // stopWalkingAction();
          // setMoveToInProgress({playerId: playerId, state: false});
          stopMovingTo();
          
          // setTimeout(() => {
            // const followPathBehavior = vehicle.steering.behaviors[ 0 ];
            // followPathBehavior.active = false;
            // vehicle.rotateTo(new YUKA.Vector3(2, 0, 2), delta)
          // }, 5000);
        }
      }
      
    }


    if (isTeleporting && teleportPosition && teleportYaw) {
      vehicle.position.copy(new YUKA.Vector3(teleportPosition.x, teleportPosition.y, teleportPosition.z));
      const threeQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, - Math.PI * teleportYaw / 180, 0, 'XYZ'));
      vehicle.rotation.copy(new YUKA.Quaternion(threeQuaternion.x, threeQuaternion.y, threeQuaternion.z, threeQuaternion.w));

      const teleportedYaw = calculateRotationAngle(vehicle);
      console.log("teleportedYaw", teleportedYaw);
      setIsTeleporting(false);
    }


    const nearbyIds: number[] = [];
    otherPlayersPostion?.forEach((player: Position) => {
      const playerPosition = new YUKA.Vector3(player.position.x, player.position.y, player.position.z);
      const distanceToOtherPlayer = vehicleRef.current?.position.distanceTo(playerPosition);
      if (distanceToOtherPlayer && distanceToOtherPlayer < 5) {
        nearbyIds.push(player.playerId);
      }
    });
    setNearbyPlayerIds({playerId: playerId, nearbyPlayerIds: nearbyIds})
    
    bubbleSpriteRef.current?.position.copy(new THREE.Vector3(vehicle.position.x, vehicle.position.y + 2.2, vehicle.position.z));
    
    updatePositionSprite(vehicle.position);
    
    
    
    const currentYaw = calculateRotationAngle(vehicle);
    // console.log(playerId, "currentYaw", currentYaw);

    // 更新当前player位置和旋转角度
    setPosAndYaw({
      playerId: playerId,
      position: {x: Math.round(vehicle.position.x) , y: Math.round(vehicle.position.y), z: Math.round(vehicle.position.z)},
      yaw: currentYaw
    })
    
    // console.log("calculated", calculateRotationAngle(vehicle))

    entityManagerRef.current.update(yukaDelta);
    
    
    // if ( !isMovingTo ) {
      // characterModel.rotation.set(0, - Math.PI * 90 / 180, 0);
      // const threeQuaternion = new THREE.Quaternion().setFromEuler(characterModel.rotation);
      // vehicle.rotation.copy(new YUKA.Quaternion(threeQuaternion.x, threeQuaternion.y, threeQuaternion.z, threeQuaternion.w));
    // }
    // console.log("vehicle.position", vehicle.position);
    // 根据状态直接显示
    // animate_state?

    // 根据指令执行相应动作
    // if (teleport) {
    //   const teleportPosition = teleport.position;
    //   characterModel.position.copy(new THREE.Vector3(teleportPosition.x, teleportPosition.y, teleportPosition.z));
    //   characterModel.rotation.set(teleportPosition.x, teleportPosition.y, teleportPosition.z);
    // }

    // if (isMovingTo) {
    //   // 使用yuka.js避障？

    //   // 当走到指定位置时，发送finish_move_to指令
    //   if (characterModel.position == moveToPosition) setIsMovingTo(false)
    // }

    // 更新状态

  });



  function findPathTo( target: YUKA.Vector3 ) {

    // const vehicle = entityManagerRef.current.entities.find(item => item.playerId == playerId) as YUKA.Vehicle;
    const vehicle = vehicleRef.current as YUKA.Vehicle;

    if (vehicle && navmeshRef.current) {
      const from = vehicle.position;
      const to = target;
      const path = navmeshRef.current.findPath(from, to);
      // console.log("from", from)
      // console.log("to", to)
      // const followPathBehavior = vehicle.steering.behaviors[ 0 ] as YUKA.FollowPathBehavior;
  
    //   followPathBehavior.path.add( from.clone() );
    //   followPathBehavior.path.add( to.clone() )
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

    // const vehicle = entityManagerRef.current.entities.find(item => item.playerId == playerId) as YUKA.Vehicle;
    const vehicle = vehicleRef.current as YUKA.Vehicle;

    setIsMovingTo(false);
    stopWalkingAction();
    setMoveToInProgress({playerId: playerId, state: false});
    setMovement({playerId: playerId, moveState: MoveState.STOP})
    // setTimeout(() => {
    if (vehicle) {
      
      // const followPathBehavior = vehicle.steering.behaviors[ 0 ];
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
      // vehicle.rotateTo(new YUKA.Vector3(2, 0, 2), delta)
    // }, 500);
  }

  
  function startWalkingAction(moveState: MoveState) {
    const movingAction = actions.current.find((item) => item.getClip().name == MoveState[moveState]);
    // console.log("startWalking - moveAction", movingAnimationRef.current)
    if (movingAction)
      changeAnimationState(movingAction);
  }

  function stopWalkingAction() {
    if (idleActionRef.current)
      changeAnimationState(idleActionRef.current);
  }

  function changeMovingState(moveState: MoveState) {
    // const vehicle = entityManagerRef.current.entities.find(item => item.playerId == playerId) as YUKA.Vehicle;
    const vehicle = vehicleRef.current as YUKA.Vehicle;
    vehicle.maxSpeed = Number(moveState);
    vehicle.velocity.copy(vehicle.velocity).normalize().multiplyScalar(Number(moveState));
    
    const movingAction = actions.current.find((item) => item.getClip().name == MoveState[moveState]);
    // console.log("changeMovingState - movingAction", movingAnimationRef.current)
    // movingAction?.setLoop(THREE.LoopPingPong, Infinity);
    if (movingAction)
      changeAnimationState(movingAction);
  }

  function changeAnimationState(action: THREE.AnimationAction) {
    if (action && !action.isRunning()) {
      // walkingActionRef.current?.fadeOut(0.1);
      
      currentActionRef.current?.fadeOut(0.1);
      action.reset().fadeIn(0.5).play();
      // setCurrentAction(action);
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

  // Position Sprite
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
      // if ( index === 0 ) waitingActionRef.current = action;
      // actions.current.push(action);
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

    // if (isControllable) {
      // console.log("reachedTarget", reachedTarget)
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
    // }

    // const vehicle = vehicleRef.current as YUKA.Vehicle;
  
    // const forwardVector = new YUKA.Vector3(0, 0, -1);
    // const backwardVector = new YUKA.Vector3(0, 0, 1);
    // const leftVector = new YUKA.Vector3(-1, 0, 0);
    // const rightVector = new YUKA.Vector3(1, 0, 0);
  
    // // const direction = new YUKA.Vector3();
    // const direction = vehicle.velocity.normalize()
  
    // if (keysPressed['w']) direction.multiplyScalar(2);
    // if (keysPressed['s']) direction.multiplyScalar(-2);
    // // if (keysPressed['a']) direction.add(leftVector);
    // // if (keysPressed['d']) direction.add(rightVector);
  
    // if (direction.length() > 0) {
    //   direction.normalize();
    //   vehicle.velocity.copy(direction).multiplyScalar(3);
    // } else {
    //   vehicle.velocity.set(0, 0, 0);
    // }
    
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
      // setCurrentAction(walkingActionRef.current);
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
  
  const cameraOffset = new THREE.Vector3(0, 2, 5);
  useFrame(( state, delta ) => {
    
    
    const yukaDelta = yukaTime.current.update().getDelta();

    updateMovement(delta);
    updateAnimation();

    // state.camera.position.copy(characterModelRef.current.position).add(cameraOffset);
    // controlsRef.current?.target.copy(new THREE.Vector3(characterModelRef.current.position.x, characterModelRef.current.position.y + 1, characterModelRef.current.position.z));
    // controlsRef.current?.update();

    if (mixer.current) {
      mixer.current.update(yukaDelta);
    }
    // entityManagerRef.current.update(delta);
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
const NavMeshGround = () => {
  const gltf = useLoader(GLTFLoader, '/jiulou-navmesh.glb');
  const model = gltf.scene;

  return <primitive object={model} />;
};


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


const Scene: React.FC = () => {
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
        canvasRef.current.style.width = window.innerWidth + 'px';
        canvasRef.current.style.height = window.innerHeight + 'px';
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // useEffect(() => {
  //   console.log("players", players)
  // }, [players])
  return (
    <>
    <div ref={canvasRef}>
      <Canvas style={{ width: '100%', height: '100%' }} camera={{ fov: 75, position: [1, 2, 9] }}>
        {/* <color attach="background" args={[bgColor.r, bgColor.g, bgColor.b]} /> */}
        <OrbitControls/>
        {/* <RayIntersect> */}
          <Suspense fallback={null}>
            {/* {players.map((player, index) => 
              (index > 0 && <MovingModel
                              key={player.playerId}
                              player={player}
                              teleport={teleports.find(item => item.playerId === player.playerId)}
                              moveTo={moves.find(item => item.playerId === player.playerId)}
                            />)
            )} */}
            {/* <MovingModel player={players[0]}
                         teleport={teleports.find(item => item.playerId === players[0].playerId)}
                         moveToAction={moveToActions.length > 0 ? moveToActions.find(item => item.playerId === players[0].playerId) : undefined}
                            /> */}

            {players.map((player, index) => 
              (<MovingModel key={player.playerId}
                            player={player}
                            playerId={player.playerId}
                            playerPosition={player.position}
                            playerYaw={player.yaw}
                            otherPlayersPostion={players.filter(item => item.playerId !==  player.playerId)}
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
        {/* </RayIntersect> */}
        <ambientLight intensity={2} color={0xffffff} />
        <pointLight position={[10, 10, 10]} />
      </Canvas>
    </div>
    </>
  );
};

export default Scene;
