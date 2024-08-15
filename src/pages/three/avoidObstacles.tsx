import { useEffect, useRef, useState, Suspense } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { OrbitControls as ThreeOrbitControls } from 'three-stdlib';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// import { GameEntity, EntityManager, SteeringBehavior, ObstacleAvoidanceBehavior, FollowPathBehavior, Path, Vector3, SteeringManager } from 'yuka';
 import * as YUKA from 'yuka'

import { usePlayers, useTeleports, useMoveTo, PlayerState, TeleportAction, MoveToAction, MoveState } from '@/hooks/useWebSocket'

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
 
const obstaclePositions = [
  new YUKA.Vector3(0, 0, -1.5),
  new YUKA.Vector3(0, 0, 0),
  new YUKA.Vector3(0, 0, 2),
];

const obstacles: YUKA.GameEntity[] = [];

obstaclePositions.forEach(pos => {
  const obstacle = new YUKA.GameEntity();
  obstacle.position.copy(pos);
  obstacle.boundingRadius = 0.6; // 设置障碍物的边界半径，用于碰撞检测
  obstacles.push(obstacle);
  entityManager.add(obstacle);
});


const MovingModel: React.FC<{player: PlayerState}> = (({player}) => {
  const gltf = useLoader(GLTFLoader, '/CoolGirlWithAnima.glb');
  // console.log(player.name , gltf.animations)
  const characterModel = gltf.scene;


  // Yuka

  characterModel.matrixAutoUpdate = false;

  const vehicle = new YUKA.Vehicle();
  
  vehicle.smoother = new YUKA.Smoother(30);

  vehicle.setRenderComponent(characterModel, sync);
  function sync(entity, renderComponent) {
      renderComponent.matrix.copy(entity.worldMatrix);
  }

  const path = new YUKA.Path();
  path.add( new YUKA.Vector3(-3, 0, -1));
  path.add( new YUKA.Vector3(3, 0, -2));
  path.add( new YUKA.Vector3(-4, 0, 4));
  path.add( new YUKA.Vector3(3, 0, 1));
  
  path.loop = true;

  vehicle.position.copy(path.current());

  const followPathBehavior = new YUKA.FollowPathBehavior(path, 0.5);
  vehicle.steering.add(followPathBehavior);
  
  // const onPathBehavior = new YUKA.OnPathBehavior(path);
  // onPathBehavior.radius = 0.5;
  // vehicle.steering.add(onPathBehavior);
  
  const obstacleAvoidanceBehavior = new YUKA.ObstacleAvoidanceBehavior(obstacles);
  vehicle.steering.add(obstacleAvoidanceBehavior);


  entityManager.add(vehicle);
  const time = new YUKA.Time();

  useFrame((state, delta) => {
    const yukaDelta = time.update().getDelta();
    entityManager.update(yukaDelta);
  });


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
  


const Scene: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.style.width = window.innerWidth + 'px';
        canvasRef.current.style.height = window.innerHeight + 'px';
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    // setupScene();

    return () => window.removeEventListener('resize', handleResize);
  }, []);



  return (
    <>
    <div ref={canvasRef}>
      <Canvas style={{ width: '100%', height: '100%' }} camera={{ fov: 75, position: [1, 2, 9] }} >
        <OrbitControls/>
        <Suspense fallback={null}>
          <MovingModel player={players[0]}
                          />
          {obstacles.map((obs, idx) => (
            <Obstacle key={idx} position={obs.position} />
          ))}
          <Background />
        </Suspense>
        <ambientLight intensity={2} color={0xffffff} />
        <pointLight position={[10, 10, 10]} />
      </Canvas>
    </div>
    </>
  );
};

export default Scene;
