import { useEffect, useRef, useState, Suspense } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { OrbitControls as ThreeOrbitControls } from 'three-stdlib';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// import { GameEntity, EntityManager, SteeringBehavior, ObstacleAvoidanceBehavior, FollowPathBehavior, Path, Vector3, SteeringManager } from 'yuka';
 import * as YUKA from 'yuka'

import { usePlayers, useTeleports, useMoveTo, PlayerState, TeleportAction, MoveToAction, MoveState } from '@/hooks/useWebSocket'

interface Camera {
  position: {x: number, y: number, z: number};
  target : {x: number, y: number, z: number};
}

const mockData = {
  state1: [
  {
    player_id: 0,
    position: {
      x: 1,
      y: 0,
      z: 4
    },
    move_state: MoveState.STOP,
    yaw: -90,
    bubble_text: "Hello",
    animate_state: 0,
    nearby_player_ids: []
  },
  {
    player_id: 2,
    position: {
      x: -1,
      y: 0,
      z: 4
    },
    move_state: MoveState.STOP,
    yaw: 90,
    bubble_text: "",
    animate_state: 0,
    nearby_player_ids: []
  },
  {
    player_id: 2,
    position: {
      x: 2,
      y: 0,
      z: 5
    },
    move_state: MoveState.STOP,
    yaw: 90,
    bubble_text: "Test",
    animate_state: 0,
    nearby_player_ids: []
  },
  ],
  state2: [
  {
    player_id: 1,
    position: {
      x: 1,
      y: 0,
      z: 4
    },
    move_state: MoveState.STOP,
    yaw: -90,
    bubble_text: "",
    animate_state: 0,
    nearby_player_ids: []
  },
  {
    player_id: 2,
    position: {
      x: -1,
      y: 0,
      z: 4
    },
    move_state: MoveState.STOP,
    yaw: 90,
    bubble_text: "Hi",
    animate_state: 0,
    nearby_player_ids: []
  },
  {
    player_id: 2,
    position: {
      x: 2,
      y: 0,
      z: 5
    },
    move_state: MoveState.WALK,
    yaw: 90,
    bubble_text: "State2",
    animate_state: 0,
    nearby_player_ids: []
  },
  ],
  state3: [
  {
    player_id: 1,
    position: {
      x: 1,
      y: 0,
      z: 4
    },
    move_state: MoveState.STOP,
    yaw: -90,
    bubble_text: "State3",
    animate_state: 0,
    nearby_player_ids: []
  },
  {
    player_id: 2,
    position: {
      x: -1,
      y: 0,
      z: 4
    },
    move_state: MoveState.STOP,
    yaw: 90,
    bubble_text: "Hi",
    animate_state: 0,
    nearby_player_ids: []
  },
  {
    player_id: 2,
    position: {
      x: 1,
      y: 0,
      z: 3
    },
    move_state: MoveState.STOP,
    yaw: 90,
    bubble_text: "",
    animate_state: 0,
    nearby_player_ids: []
  },
  ],
}

const players = mockData.state1;


const entityManager = new YUKA.EntityManager();

const targetPositions = [
  new YUKA.Vector3(0, 0, 1),
  new YUKA.Vector3(-4, 0, -3),
  new YUKA.Vector3(2, 0, 5),
]
 

const MovingModel: React.FC<{player: PlayerState, teleport: TeleportAction | undefined, moveTo: MoveToAction | undefined}> = (({player, teleport, moveTo}) => {
  const gltf = useLoader(GLTFLoader, '/CoolGirlWithAnima.glb');
  // console.log(player.name , gltf.animations)
  const characterModel = gltf.scene;
  const mixer = useRef<THREE.AnimationMixer>();
  
  const actions = useRef<THREE.AnimationAction[]>([]);
  const waitingActionRef = useRef<THREE.AnimationAction>();

  const [moveToPosition, setMoveToPosition] = useState<THREE.Vector3>();
  const [isMovingTo, setIsMovingTo] = useState(false);

  const [yukaTarget, setYukaTarget] = useState(new YUKA.Vector3(3, 0, -2));


  // useEffect(() => {
  //   if (moveTo) {
  //     const targetPosition = moveTo.position;
  //     setMoveToPosition(new THREE.Vector3(targetPosition.x, targetPosition.y, targetPosition.z));

  //     // 使用yuka.js规划路线？

  //     setIsMovingTo(true);
      
  //   }
  // }, [moveTo])

  

  // useEffect(() => {
  //   const timer = setInterval(() => {
  //     entityManager.update(0.016); // 更新实体管理器，假设每帧时间为16ms
  //     if (characterModel) {
  //       characterModel.position.copy(vehicle.position as any);
  //     }
  //   }, 16);
  //   return () => clearInterval(timer);
  // }, []);


  if (!mixer.current) {
    mixer.current = new THREE.AnimationMixer(characterModel);

    gltf.animations.forEach((clip, index) => {
      const action = mixer.current!.clipAction(clip);
      if ( index === 0 ) waitingActionRef.current = action;
      actions.current.push(action);
    });
    // if (waitingActionRef.current) {
    //   waitingActionRef.current.play();
    // }
  }



  // Yuka

  characterModel.matrixAutoUpdate = false;

  const vehicle = new YUKA.Vehicle();
  
  vehicle.maxSpeed = 1.5;
  vehicle.maxForce = 10;

  vehicle.setRenderComponent(characterModel, sync);
  function sync(entity, renderComponent) {
      renderComponent.matrix.copy(entity.worldMatrix);
  }


  const followPathBehavior = new YUKA.FollowPathBehavior();
  followPathBehavior.active = false;
  vehicle.steering.add(followPathBehavior);
  
  // const onPathBehavior = new YUKA.OnPathBehavior(path);
  // onPathBehavior.radius = 0.5;
  // vehicle.steering.add(onPathBehavior);

  findPathTo(new YUKA.Vector3(3, 0, -2));
  setTimeout(() => {
    findPathTo(targetPositions[0]);
    setTimeout(() => {
      findPathTo(targetPositions[1]);
      setTimeout(() => {
        findPathTo(targetPositions[2]);
      }, 3000);
    }, 3000);
  }, 3000);

  // useEffect(() => {
  //   const firtTimeout = setTimeout(() => {
  //     findPathTo(targetPositions[0]);
  //   }, 3000);
  //   const secondTimeout = setTimeout(() => {
  //     findPathTo(targetPositions[1]);
  //   }, 6000);
  //   const thirdTimeout = setTimeout(() => {
  //     findPathTo(targetPositions[2]);
  //   }, 9000);

  //   return(() => {
  //     clearTimeout(firtTimeout);
  //     clearTimeout(secondTimeout);
  //     clearTimeout(thirdTimeout);
  //   })
  // }, [])

  // useEffect(() => {
  //   findPathTo(yukaTarget);
  // }, [yukaTarget])

  entityManager.add(vehicle);
  const time = new YUKA.Time();

  useFrame((state, delta) => {
    
    // if (mixer.current) {
    //   mixer.current.update(delta);
    // }

    const yukaDelta = time.update().getDelta();
    entityManager.update(yukaDelta);
  
    // 根据状态直接显示
    // animate_state?

    // 根据指令执行相应动作
    if (teleport) {
      const teleportPosition = teleport.position;
      characterModel.position.copy(new THREE.Vector3(teleportPosition.x, teleportPosition.y, teleportPosition.z));
      characterModel.rotation.set(teleportPosition.x, teleportPosition.y, teleportPosition.z);
    }

    if (isMovingTo) {
      // 使用yuka.js避障？

      // 当走到指定位置时，发送finish_move_to指令
      if (characterModel.position == moveToPosition) setIsMovingTo(false)
    }

    // 更新状态

  });


  function findPathTo( target: YUKA.Vector3 ) {
    const from = vehicle.position;
    const to = target;   

    // const followPathBehavior = vehicle.steering.behaviors[ 0 ];
    // followPathBehavior.active = true;
    // followPathBehavior.path.clear();
    
		const followPathBehavior = vehicle.steering.behaviors[ 0 ];
		followPathBehavior.active = true;
		followPathBehavior.path.clear();

    followPathBehavior.path.add( from );
    followPathBehavior.path.add( to );

    console.log("change target")
  }


  return (
    <>
      <primitive object={characterModel} position={[player.position.x, player.position.y, player.position.z]} rotation={[0, Math.PI * player.yaw / 180, 0]}/>
    </>
  );
});

const Background = () => {
  const gltf = useLoader(GLTFLoader, '/factory.glb');
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


// const RayIntersect : React.FC<RayIntersectProps> = ({ children, onIntersect }) => {

//   const raycaster = useRef(new THREE.Raycaster());
//   const mouse = useRef(new THREE.Vector2(0, 0));

//   useEffect(() => {
// 		window.addEventListener( 'mousedown', onMouseDown, false );
//   }, []);

//   useFrame(() => {
//     // 更新raycaster的射线方向
//     raycaster.current.setFromCamera(mouse.current, useThree().camera);
//     const intersects = raycaster.current.intersectObjects(children);
//     if (intersects.length > 0) {
//       onIntersect(intersects[0].object);
//       console.log("intersects[0].object", intersects[0].object)
//     } else {
//       onIntersect(null);
//     }
//   });


//   const onMouseDown = (event: MouseEvent) => {
//     mouse.current.x = ( event.clientX / window.innerWidth ) * 2 - 1;
//     mouse.current.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
//   }


// }




const Scene: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);

  // const { players } = usePlayers();
  const { teleports } = useTeleports();
  const { moves } = useMoveTo();
  
  useEffect(() => {

    const ws = new WebSocket('ws://localhost:8080');
    ws.onmessage = function(event) {
      const data = JSON.parse(event.data);
      console.log("data", data);
    };

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


  return (
    <>
    <div ref={canvasRef}>
      <Canvas style={{ width: '100%', height: '100%' }} camera={{ fov: 75, position: [1, 2, 9] }} >
        <OrbitControls/>
        {/* <RayIntersect> */}
          <Suspense fallback={null}>
            {/* {players.map((player, index) => 
              (index > 0 && <MovingModel
                              key={player.player_id}
                              player={player}
                              teleport={teleports.find(item => item.player_id === player.player_id)}
                              moveTo={moves.find(item => item.player_id === player.player_id)}
                            />)
            )} */}
            <MovingModel player={players[0]}
                         teleport={teleports.find(item => item.player_id === players[0].player_id)}
                         moveTo={moves.find(item => item.player_id === players[0].player_id)}
                            />
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
