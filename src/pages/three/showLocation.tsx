import { useEffect, useRef, useState, Suspense } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { OrbitControls as ThreeOrbitControls } from 'three-stdlib';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface Character {
  name: string;
  animation: string;
  // position: {x: number, y: number, z: number};
  position: THREE.Vector3;
  angle: number;
}
interface Camera {
  position: {x: number, y: number, z: number};
  target : {x: number, y: number, z: number};
}

interface ScenePlacement {
  sceneName: string;
  cameraPlacement: Camera;
  characters: Character[];
}
const scenePlacement: ScenePlacement = {
  sceneName: "factory",
  cameraPlacement: {
    position: { x: 0, y: 2, z: 0 },
    target: { x: 0, y: 1, z: 4 }
  },
  characters: [
    {
      name: "CoolGirlWithAnima",
      animation: "Idle",
      // position: { x: 1, y: 0, z: 4 },
      position: new THREE.Vector3(0, 0, 0),
      angle: -90
    },
    {
      name: "CoolBoyWithAnima",
      animation: "Idle",
      // position: { x: -1, y: 0, z: 4 },
      position: new THREE.Vector3(-1, 0, 4),
      angle: 90
    },
    {
      name: "BoyWithAnima",
      animation: "Idle",
      // position: { x: 2, y: 0, z: 5 },
      position: new THREE.Vector3(2, 0, 5),
      angle: 90
    },
    {
      name: "GirlWithAnima",
      animation: "Idle",
      // position: { x: 2, y: 0, z: -4 },
      position: new THREE.Vector3(2, 0, -1),
      angle: 90
    },
    {
      name: "StudentGirlWithAnima",
      animation: "Idle",
      // position: { x: -4, y: 0, z: -3 },
      position: new THREE.Vector3(-4, 0, -3),
      angle: 90
    },
    {
      name: "StudentBoyWithAnima",
      animation: "Idle",
      // position: { x: -2, y: 0, z: 0 },
      position: new THREE.Vector3(-2, 0, 0),
      angle: 90
    },
  ]
};

const characters = scenePlacement.characters;



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


const ControllableModel: React.FC<{isAutoMoving: boolean, setIsAutoMoving: (arg: boolean) => void, character: Character, commitPosition: (position: THREE.Vector3) => void}> =({isAutoMoving, setIsAutoMoving, character, commitPosition}) => {
  const controlsRef = useRef<ThreeOrbitControls>(null);

  const gltf = useLoader(GLTFLoader, '/' + character.name + '.glb');
  const characterModel = gltf.scene;


  const mixer = useRef<THREE.AnimationMixer>();
  const idleActionRef = useRef<THREE.AnimationAction>();
  const walkingActionRef = useRef<THREE.AnimationAction>();
  
  const [currentAction, setCurrentAction] = useState<THREE.AnimationAction | null>(null);
  // const isAutoMovingRef = useRef(false);
  const autoPathRef = useRef<THREE.CatmullRomCurve3 | THREE.LineCurve3>();



  const actions = useRef<THREE.AnimationAction[]>([]);

  useEffect(() => {
    console.log("autoMoving changed", isAutoMoving)
    if(isAutoMoving) {
      getToTargetPoint() 
    }
    else {
      stopMoving()
    }
  }, [isAutoMoving]);


  useEffect(() => {
    mixer.current = new THREE.AnimationMixer(characterModel);
    // const idleClip = gltf.animations.find(animation => animation.name === "Idle");
    // const walkingClip = gltf.animations.find(animation => animation.name === "Walking");
    // const idleAction = mixer.current.clipAction(idleClip as THREE.AnimationClip);
    // const walkingAction = mixer.current.clipAction(walkingClip as THREE.AnimationClip);
    // idleAction.play();

    // idleActionRef.current = idleAction;
    // walkingActionRef.current = walkingAction;

    gltf.animations.forEach((clip) => {
      const action = mixer.current!.clipAction(clip);
      if (clip.name === "Idle" ) idleActionRef.current = action;
      if (clip.name === "Walk" ) walkingActionRef.current = action;
      actions.current.push(action);
    });
    if (idleActionRef.current) {
      idleActionRef.current.play();
      setCurrentAction(idleActionRef.current);
    }
    

    return () => {
      actions.current = [];
    }
  }, [gltf]);

  if (!mixer.current) {
    mixer.current = new THREE.AnimationMixer(characterModel);
  }

  function updateMovement(delta: number) {
    const model = characterModel;
    const speed = 1; // 调整速度
    const distance = speed * delta;

    if (keysPressed['w'] ) { // 前进
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
    if ( !isAutoMoving ) {  // 自动
      if ( keysPressed['w'] || keysPressed['s'] ) {
        startWalkingAction();
      }
      else {
        stopWalkingAction();
      }
    }
    
  }

  
  function startWalkingAction() {
    // if (walkingActionRef.current && !walkingActionRef.current.isRunning() && !actingInterAction) {
    if (walkingActionRef.current && !walkingActionRef.current.isRunning()) {
      // idleActionRef.current?.fadeOut(0.1);
      currentAction?.fadeOut(0.1);
      walkingActionRef.current.reset().fadeIn(0.5).play();
      setCurrentAction(walkingActionRef.current);
    }
  }

  function stopWalkingAction() {
    if (idleActionRef.current && !idleActionRef.current.isRunning()) {
      // walkingActionRef.current?.fadeOut(0.1);
      currentAction?.fadeOut(0.1);
      idleActionRef.current.reset().fadeIn(0.5).play();
      setCurrentAction(idleActionRef.current);
    }
  }

  let t = 0;
  const delta = 0.0001;
  function animateAutoMoving() {
    const model = characterModel!;
    if (autoPathRef.current) {
      const point = autoPathRef.current.getPoint(t);
      model.position.copy(point); // 更新模型位置

      const nextPoint = autoPathRef.current.getPoint(t + delta);
      model.lookAt(nextPoint);

      t += delta;
      if (model.position.distanceTo(new THREE.Vector3(-6, 0, 8)) < 0.1) {
        t = 0;
        stopWalkingAction();
        // isAutoMovingRef.current = false;
        setIsAutoMoving(false);
      }
    }
  }

  function getToTargetPoint() {
    if (characterModel) {
      const currentPoint = characterModel.position;
      const targetPoint = new THREE.Vector3(-6, 0, 8);
      const linePath = new THREE.LineCurve3(currentPoint, targetPoint);
      startWalkingAction();
      autoPathRef.current = linePath;
      // isAutoMovingRef.current = true;
      setIsAutoMoving(true);
    }
  }

  function stopMoving() {
    stopWalkingAction();
    // isAutoMovingRef.current = false;
    setIsAutoMoving(false);
  }


  const spriteRef = useRef<THREE.Sprite>(null);
  const cameraOffset = new THREE.Vector3(0, 2, 5);

  useFrame(( state, delta ) => {
    if (mixer.current) {
      mixer.current.update(delta);
    }

    updateMovement(delta);
    updateAnimation();
    
    if (isAutoMoving) animateAutoMoving();

    
    if (spriteRef.current) {
      spriteRef.current.position.x = characterModel.position.x;
      spriteRef.current.position.z = characterModel.position.z;
    }

    
    // 调整相机位置
    if (controlsRef.current && walkingActionRef.current && walkingActionRef.current.isRunning()) {
      state.camera.position.copy(characterModel.position).add(cameraOffset);

      controlsRef.current.target.copy(new THREE.Vector3(characterModel.position.x, characterModel.position.y + 1, characterModel.position.z));
      controlsRef.current.update();
    }
    
    // 显示人物所在位置
    commitPosition(characterModel.position);
  });
  

  return (
    <>
     <OrbitControls ref={controlsRef} position={[character.position.x, character.position.y + 1, character.position.z - 1]}/>
     <primitive object={characterModel} position={[character.position.x, character.position.y, character.position.z]} rotation={[0, Math.PI / 2, 0]}/>
    </>
  );
};

const Background = () => {
  const gltf = useLoader(GLTFLoader, '/factory.glb');
  const model = gltf.scene;

  return <primitive object={model} />;
};


const Scene: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isAutoMoving, setIsAutoMoving] = useState(false);

  const [currentPosition, setCurrentPosition] = useState<THREE.Vector3>()
  const commitPosition = (position: THREE.Vector3) => {
    setCurrentPosition(new THREE.Vector3(position.x, position.y, position.z));
  };

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

  

  return (
    <>
    <div ref={canvasRef}>
      <Canvas style={{ width: '100%', height: '100%' }} camera={{ fov: 75, position: [1, 2, 9] }} >
        {/* <OrbitControls target={[0, 1, 4]}  /> */}
        <Suspense fallback={null}>
          <ControllableModel isAutoMoving={isAutoMoving} setIsAutoMoving={setIsAutoMoving} character={characters[0]} commitPosition={commitPosition}/>

          <Background />
        </Suspense>
        <ambientLight intensity={2} color={0xffffff} />
        <pointLight position={[10, 10, 10]} />
      </Canvas>
    </div>
      {/* <button onClick={() => setIsAutoMoving(true)}>走到目标节点</button>
      <button onClick={() => setIsAutoMoving(false)}>停止行动</button> */}
      <div>[x: {currentPosition?.x}, y: {currentPosition?.y}, z: {currentPosition?.z}]</div>
    </>
  );
};

export default Scene;
