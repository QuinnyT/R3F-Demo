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


interface Camera {
  position: {x: number, y: number, z: number};
  target : {x: number, y: number, z: number};
}

const mockData = {
  state1: [
  {
    playerId: 10001,
    position: {
      x: 1,
      y: 0,
      z: 4
    },
    moveState: MoveState.STOP,
    yaw: -90,
    bubble_text: "Hello",
    animate_state: 0,
    nearby_playerIds: []
  },
  {
    playerId: 2,
    position: {
      x: -1,
      y: 0,
      z: 4
    },
    moveState: MoveState.STOP,
    yaw: 90,
    bubble_text: "",
    animate_state: 0,
    nearby_playerIds: []
  },
  {
    playerId: 2,
    position: {
      x: 2,
      y: 0,
      z: 5
    },
    moveState: MoveState.STOP,
    yaw: 90,
    bubble_text: "Test",
    animate_state: 0,
    nearby_playerIds: []
  },
  ],
  state2: [
  {
    playerId: 1,
    position: {
      x: 1,
      y: 0,
      z: 4
    },
    moveState: MoveState.STOP,
    yaw: -90,
    bubble_text: "",
    animate_state: 0,
    nearby_playerIds: []
  },
  {
    playerId: 2,
    position: {
      x: -1,
      y: 0,
      z: 4
    },
    moveState: MoveState.STOP,
    yaw: 90,
    bubble_text: "Hi",
    animate_state: 0,
    nearby_playerIds: []
  },
  {
    playerId: 2,
    position: {
      x: 2,
      y: 0,
      z: 5
    },
    moveState: MoveState.WALK,
    yaw: 90,
    bubble_text: "State2",
    animate_state: 0,
    nearby_playerIds: []
  },
  ],
  state3: [
  {
    playerId: 1,
    position: {
      x: 1,
      y: 0,
      z: 4
    },
    moveState: MoveState.STOP,
    yaw: -90,
    bubble_text: "State3",
    animate_state: 0,
    nearby_playerIds: []
  },
  {
    playerId: 2,
    position: {
      x: -1,
      y: 0,
      z: 4
    },
    moveState: MoveState.STOP,
    yaw: 90,
    bubble_text: "Hi",
    animate_state: 0,
    nearby_playerIds: []
  },
  {
    playerId: 2,
    position: {
      x: 1,
      y: 0,
      z: 3
    },
    moveState: MoveState.STOP,
    yaw: 90,
    bubble_text: "",
    animate_state: 0,
    nearby_playerIds: []
  },
  ],
}
const nameIdMap: { [key: number]: string } = {
  10001: "WuNvSimple",
  10002: "CoolBoyWithAnima",
  10003: "GirlWithAnima",
}

const animationMap: { [key: number]: string } = {
  1: "Angry",
  2: "Dance",
  3: "Victory"
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

const entityManager = new YUKA.EntityManager();

interface MovingModelProps {
  player: PlayerState
  playerId: number
  playerPosition: IntVector
  moveToAction?: MoveToAction | undefined
  moveAction?: MoveAction | undefined
  bubbleAction?: BubbleAction | undefined
  teleportAction?: TeleportAction | undefined
  animateAction?: AnimateAction | undefined
  chatAction?: ChatAction | undefined
}

const MovingModel: React.FC<MovingModelProps> = (({player, playerId, playerPosition, moveToAction, moveAction, bubbleAction, teleportAction, animateAction }) => {

  const { setMovement, setMoveToInProgress, setBubble, clearBubble } = usePlayers();
  const name = nameIdMap[playerId];
  const gltf = useLoader(GLTFLoader, '/' + name + '.glb');
  const characterModel = gltf.scene;
  // console.log(name, characterModel);
  
  const mixer = useRef<THREE.AnimationMixer>();
  
  const actions = useRef<THREE.AnimationAction[]>([]);
  const [currentAction, setCurrentAction] = useState<THREE.AnimationAction>();

  const waitingActionRef = useRef<THREE.AnimationAction>();
  const idleActionRef = useRef<THREE.AnimationAction>();
  const walkingActionRef = useRef<THREE.AnimationAction>();


  const [moveToPosition, setMoveToPosition] = useState<THREE.Vector3>();
  const [isMovingTo, setIsMovingTo] = useState(false);

  const [yukaTarget, setYukaTarget] = useState(new YUKA.Vector3(3, 0, -2));


  // useEffect(() => {
  //   const timer = setInterval(() => {
  //     entityManager.update(0.016); // 更新实体管理器，假设每帧时间为16ms
  //     if (characterModel) {
  //       characterModel.position.copy(vehicle.position as any);
  //     }
  //   }, 16);
  //   return () => clearInterval(timer);
  // }, []);


  useEffect(() => {
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
      setCurrentAction(idleActionRef.current);
    }

    
  // if (mixer.current) {
    const handleFinished = (event: {action: THREE.AnimationAction; direction: number}) => {
      console.log("event", event)
      event.action.fadeOut(0.5);
      // const finishedActionName = event.action.getClip().name;
      // const finishingAction = actions.current.find(item => item.getClip().name == finishedActionName);

      if (idleActionRef.current) {
        idleActionRef.current.reset().fadeIn(0.5).play();
        setCurrentAction(idleActionRef.current);
        // changeAnimationState(idleActionRef.current);
      }
    };
  // }
    if (mixer.current) mixer.current.addEventListener('finished', (event) => handleFinished(event));

    return (() => {
      actions.current = [];
      if (mixer.current) mixer.current.removeEventListener('finished', handleFinished);
    })
  }, [gltf]);

  // Yuka
  
  const vehicle = new YUKA.Vehicle();
  vehicle.position = new YUKA.Vector3(playerPosition.x, playerPosition.y, playerPosition.z); 
  vehicle.playerId = playerId;
  const time = new YUKA.Time();
  const axis = new YUKA.Vector3(0, 1, 0);

  useEffect(() => {

    characterModel.matrixAutoUpdate = false;
  
    // if (moveState && Number(moveState) > 0) vehicle.maxSpeed = Number(moveState);
    // else vehicle.maxSpeed = 1;
    vehicle.maxForce = 10;
  
    vehicle.setRenderComponent(characterModel, sync);
    function sync(entity, renderComponent) {
        renderComponent.matrix.copy(entity.worldMatrix);
    }
  
    const followPathBehavior = new YUKA.FollowPathBehavior();
    followPathBehavior.active = false;
    vehicle.steering.add(followPathBehavior);
  
    entityManager.add(vehicle);
  }, [])

  // const targetPositionRef = useRef<YUKA.Vector3>()
  const [targetPosition, setTargetPosition] = useState<YUKA.Vector3>();
  const [targetYaw, setTargetYaw] = useState<number>();
  const [moveState, setMoveState] = useState<MoveState>();
  useEffect(() => {
    if (moveToAction) {
      const position = moveToAction.position;
      const targetPosition = new YUKA.Vector3(position.x, position.y, position.z);
      // targetPositionRef.current = targetPosition;
      setTargetPosition(targetPosition);
      setTargetYaw(moveToAction.yaw);
      setMoveState(moveToAction.moveState);
    //   // setMoveToPosition(new THREE.Vector3(targetPosition.x, targetPosition.y, targetPosition.z));
      
    //   // 使用yuka.js
      findPathTo(targetPosition);
      setIsMovingTo(true);
      // changeMovingState();

      setMoveToInProgress({playerId: playerId, state: true});
    }
  }, [moveToAction]);

  useEffect(() => {
    if (moveAction) {
      setMoveState(moveAction.moveState);
      // changeMovingState();
    }
  }, [moveAction])


  useEffect(() => {
    if (moveState) {

      changeMovingState();
      
      setMovement({playerId: playerId, moveState: moveState});   // 更新player moveState
    }
  }, [moveState])


  const [bubbleText, setBubbleText] = useState("")
  const bubbleSpriteRef = useRef<THREE.Sprite>(null);
  useEffect(() => {
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
    if (teleportAction) {
      stopMovingTo();
      setTeleportPosition(teleportAction.position);
      setTeleportYaw(teleportAction.yaw);
      setIsTeleporting(true);
    }
  }, [teleportAction])


  useEffect(() => {
    if (animateAction && !isMovingTo) {
      // console.log("animateAction",  animationMap[animateAction.animateState])
      const animationName = animationMap[animateAction.animateState];
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

  useFrame((state, delta) => {
    
    if (mixer.current) {
      mixer.current.update(delta);
    }

    // const yukaDelta = time.update().getDelta();

    const vehicle = entityManager.entities.find(item => item.playerId == playerId) as YUKA.Vehicle;


    const threeQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, - Math.PI * 90 / 180, 0, 'XYZ'));
    vehicle.rotation.copy(new YUKA.Quaternion(threeQuaternion.x, threeQuaternion.y, threeQuaternion.z, threeQuaternion.w));
    
    // if( vehicle && targetPositionRef.current && isMovingTo ) {
    if( vehicle && targetPosition && isMovingTo ) {
      const currentYaw = calculateRotationAngle(vehicle);
      // console.log('Rotation Angle (degrees):', currentYaw);

      const distance = vehicle.position.distanceTo(targetPosition);
      // console.log("distance", distance)
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

    if (isTeleporting && teleportPosition && teleportYaw) {
      vehicle.position.copy(new YUKA.Vector3(teleportPosition.x, teleportPosition.y, teleportPosition.z));
      const threeQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI * teleportYaw / 180, 0, 'XYZ'));
      vehicle.rotation.copy(new YUKA.Quaternion(threeQuaternion.x, threeQuaternion.y, threeQuaternion.z, threeQuaternion.w));
      setIsTeleporting(false);
    }

    entityManager.update(delta);

    bubbleSpriteRef.current?.position.copy(new THREE.Vector3(vehicle.position.x, vehicle.position.y + 2.2, vehicle.position.z));
    
    const positionContext = positionContextRef.current!;
    const positionCanvas = positionCanvasRef.current;
    const positionTexture = positionTextureRef.current;
    positionContext.clearRect(0, 0, positionCanvas.width, positionCanvas.height);
    positionContext.font = '42px Arial';
    positionContext.fillStyle = 'rgba(255, 255, 255, 0)';
    positionContext.fillRect(positionCanvas.width/2, 0, positionCanvas.width, positionCanvas.height);
    positionContext.fillStyle = 'white';
    positionContext.fillText(`[ ${vehicle.position.x.toFixed(1)}, ${vehicle.position.y.toFixed(1)}, ${vehicle.position.z.toFixed(1)} ]`, 0, 100);
    positionTexture.needsUpdate = true;
  
    positionSpriteRef.current?.position.copy(new THREE.Vector3(vehicle.position.x, vehicle.position.y - 0.2, vehicle.position.z));
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

    const vehicle = entityManager.entities.find(item => item.playerId == playerId) as YUKA.Vehicle;
    if (vehicle) {
      const from = vehicle.position;
      const to = target;   
      
      const followPathBehavior = vehicle.steering.behaviors[ 0 ] as YUKA.FollowPathBehavior;
      followPathBehavior.active = true;
      followPathBehavior.path.clear();
  
      followPathBehavior.path.add( from.clone() );
      followPathBehavior.path.add( to.clone() );

    }

  }

  function stopMovingTo() {

    const vehicle = entityManager.entities.find(item => item.playerId == playerId) as YUKA.Vehicle;

    setIsMovingTo(false);
    stopWalkingAction();
    setMoveToInProgress({playerId: playerId, state: false});
    setMovement({playerId: playerId, moveState: MoveState.STOP})
    // setTimeout(() => {
    if (vehicle) {
      
      const followPathBehavior = vehicle.steering.behaviors[ 0 ];
      console.log("followPathBehavior", followPathBehavior)
      if ( followPathBehavior ) {
        followPathBehavior.active = false;
      }
      vehicle.velocity.set(0, 0, 0); // 重置速度向量以停止移动

      if (targetYaw) {
        const threeQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI * targetYaw / 180, 0, 'XYZ'));
        vehicle.rotation.copy(new YUKA.Quaternion(threeQuaternion.x, threeQuaternion.y, threeQuaternion.z, threeQuaternion.w));
      }
    }
      // vehicle.rotateTo(new YUKA.Vector3(2, 0, 2), delta)
    // }, 500);
  }

  
  // function startWalkingAction() {
  //   const movingAction = actions.current.find((item) => item.getClip().name == moveState);
  //   if (movingAction) changeAnimationState(movingAction);
  // }

  function stopWalkingAction() {
    if (idleActionRef.current) changeAnimationState(idleActionRef.current);
  }

  function changeMovingState() {
    const vehicle = entityManager.entities.find(item => item.playerId == playerId) as YUKA.Vehicle;
    vehicle.maxSpeed = Number(moveState);
    vehicle.velocity.copy(vehicle.velocity).normalize().multiplyScalar(Number(moveState));
    
    const movingAction = actions.current.find((item) => item.getClip().name == MoveState[moveState]);
    movingAction?.setLoop(THREE.LoopRepeat, Infinity);
    if (movingAction)
      changeAnimationState(movingAction);
  }

  function changeAnimationState(action: THREE.AnimationAction) {
    if (action && !action.isRunning()) {
      // walkingActionRef.current?.fadeOut(0.1);
      currentAction?.fadeOut(0.1);
      action.reset().fadeIn(0.5).play();
      setCurrentAction(action);
    }
  }

  function calculateRotationAngle(vehicle: YUKA.Vehicle): number {
    // 获取车辆的速度向量
    
    const velocity = vehicle.velocity;
  
    // 确保车辆有速度
    if (velocity.length() === 0) {
      return 0;
    }
  
    // 计算与参考向量 (x 轴) 的夹角
    const referenceVector = new YUKA.Vector3(1, 0, 0);
    const angle = Math.atan2(velocity.x, velocity.z);
  
    // 将弧度转换为角度
    const angleInDegrees = angle * (180 / Math.PI);
  
    return angleInDegrees;
  }

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

  //  const positionContext = positionContextRef.current!;
  //  const positionCanvas = positionCanvasRef.current;
  //  positionContext.font = '48px Arial';
  //  positionContext.fillStyle = 'rgba(255, 255, 255, 0)';
  //  positionContext.fillRect(0, 0, positionCanvas.width, positionCanvas.height);
  //  positionContext.fillStyle = 'white';
  //  positionContext.fillText(`[${playerPosition.x}, ${playerPosition.y}, ${playerPosition.z}]`, 100, 100);
  return (
    <>
      {bubbleText && bubbleText !== "" ? <sprite ref={bubbleSpriteRef} position={[playerPosition.x, playerPosition.y + 2.2, playerPosition.z]} material={spriteMaterial} scale={[1, 0.5, 1]}/> : null}
      <sprite ref={positionSpriteRef} position={[playerPosition.x, playerPosition.y - 0.2, playerPosition.z]} material={positionMaterialRef.current} scale={[1, 0.5, 1]}/>
      <primitive object={characterModel} position={[playerPosition.x, playerPosition.y, playerPosition.z]}/>
    </>
  );
});

const Background = () => {
  const gltf = useLoader(GLTFLoader, '/jiulou.glb');
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
      <Canvas style={{ width: '100%', height: '100%' }} camera={{ fov: 75, position: [1, 2, 9] }} >
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
                            moveToAction={moveToActions.length > 0 ? moveToActions.find(item => item.playerId === player.playerId) : undefined}
                            moveAction={moveActions.length > 0 ? moveActions.find(item => item.playerId === player.playerId) : undefined}
                            bubbleAction={bubbleActions.length > 0 ? bubbleActions.find(item => item.playerId === player.playerId) : undefined}
                            teleportAction={teleportActions.find(item => item.playerId === player.playerId)}
                            animateAction={animateActions.find(item => item.playerId === player.playerId)}
                   />)
            )}
            <Background />
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
