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
      position: new THREE.Vector3(1, 0, 4),
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

interface CharacterInterAction extends Character {
  animation: string,
  myAnimation: string,
  talkingContent: string
}
const characterInterActions: CharacterInterAction[] = [
  {
    ...characters[1],
    animation: "Idle",
    myAnimation: "Angry",
    talkingContent: "Hey"
  },
  {
    ...characters[2],
    animation: "Fighting",
    myAnimation: "Angry",
    talkingContent: "Hi"
  },
  {
    ...characters[3],
    animation: "Fighting",
    myAnimation: "Angry",
    talkingContent: "Dear"
  }
]


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


const ControllableModel: React.FC<{isAutoMoving: boolean, setIsAutoMoving: (arg: boolean) => void, character: Character, isApproaching: string, setIsApproaching: (arg: string) => void}> =({isAutoMoving, setIsAutoMoving, character, isApproaching, setIsApproaching}) => {
  const controlsRef = useRef<ThreeOrbitControls>(null);

  const gltf = useLoader(GLTFLoader, '/' + character.name + '.glb');
  const characterModel = gltf.scene;

  const mixer = useRef<THREE.AnimationMixer>();
  const idleActionRef = useRef<THREE.AnimationAction>();
  const walkingActionRef = useRef<THREE.AnimationAction>();
  
  const [currentAction, setCurrentAction] = useState<THREE.AnimationAction | null>(null);
  // const isAutoMovingRef = useRef(false);
  const autoPathRef = useRef<THREE.CatmullRomCurve3 | THREE.LineCurve3>();
  const [reachedTarget, setReachedTarget] = useState(false); 

  const [approachedCharacter, setApproachedCharacter] = useState<CharacterInterAction>(); 
  const [actingInterAction, setActingInterAction] = useState(false);

  const [isControllable, setIsControllable] = useState(true);

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
    setApproachedCharacter(characterInterActions.find( character => character.name == isApproaching ))
  }, [isApproaching])

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
      if (clip.name === "Walking" ) walkingActionRef.current = action;
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

    if (isControllable) {
      // console.log("reachedTarget", reachedTarget)
      if (keysPressed['w'] && !reachedTarget) { // 前进
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

  }


  function updateAnimation() {
    if ( !isAutoMoving && isControllable ) {  // 自动
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

  function startInterAction () {
    let currentAction: THREE.AnimationAction | undefined;
    let interAction: THREE.AnimationAction | undefined;

    actions.current.forEach(action => {
      if (action.isRunning() ) {
        currentAction = action;
      }
      if (action.getClip().name === approachedCharacter?.myAnimation ) 
        interAction = action;
    });
    
    if (currentAction && interAction && !actingInterAction) {
      setActingInterAction(true);
      setIsControllable(false);
      console.log("currentAction", currentAction);
      currentAction.fadeOut(0.5);
      console.log("interAction", interAction);
      interAction.setLoop(THREE.LoopOnce, 1);
      interAction.clampWhenFinished = true;
      interAction.reset().fadeIn(0.5).play();
      setTimeout(() => {
        interAction?.fadeOut(0.5);
        if(idleActionRef.current) {
          idleActionRef.current?.reset().fadeIn(0.5).play();
          setCurrentAction(idleActionRef.current);
        }
        setIsControllable(true);
      }, 6000); 
    }
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
    
    const distanceList = characterInterActions.map(item => characterModel.position.distanceTo(item.position))
    const minDistance = Math.min(...distanceList)
    const maxDistance = Math.max(...distanceList)
    const minIndex = characterInterActions.findIndex(item => characterModel.position.distanceTo(item.position) == minDistance)
    const direction = new THREE.Vector3().subVectors(characterInterActions[minIndex].position, characterModel.position).normalize();
    const angle = Math.atan2(direction.z, direction.x);
    const forward = new THREE.Vector3(0, 0, 1); // 默认前方向
    forward.applyQuaternion(characterModel.quaternion);
    const forwardAngle = Math.atan2(forward.z, forward.x);
    const [minAngle, maxAngle] = [ angle - Math.PI / 4, angle + Math.PI / 4 ];

    // if (minDistance <= 1.2 && characterModel.rotation.y % (2 * Math.PI) > minAngle && characterModel.rotation.y % (2 * Math.PI) < maxAngle) {
    if (minDistance <= 1.2 && forwardAngle > minAngle && forwardAngle < maxAngle) {
      setReachedTarget(true);
      // stopWalkingAction();
      setIsApproaching(characterInterActions[minIndex].name);
      if ( spriteRef.current && spriteRef.current.material.map ) {
        const canvas = spriteRef.current.material.map.image;
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = 'rgba(255, 255, 255, 0.6)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillText("Hello", 100, 100);
        spriteRef.current.material.map.needsUpdate = true;
      }
      startInterAction();
    }
    else {
      setReachedTarget(false);
      setIsApproaching("");
      if ( spriteRef.current && spriteRef.current.material.map ) {
        const canvas = spriteRef.current.material.map.image;
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = 'rgba(255, 255, 255, 0.6)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillText("", 10, 60);
        spriteRef.current.material.map.needsUpdate = true;
      }
      setActingInterAction(false)
    }

    
    // 调整相机位置
    if (controlsRef.current && walkingActionRef.current.isRunning()) {
      // state.camera.position.copy(characterModel.position).add(cameraOffset);
      // state.camera.position.copy(characterModel.position);
      // state.camera.position.lerp(new THREE.Vector3(characterModel.position.x, characterModel.position.y + 4, characterModel.position.z + 3), 0.05);
      
      // boundingBox.expandByObject(characterModel);
      // updateCameraToFitBoundingBox(state.camera, controlsRef.current, characterModel.position, maxDistance);
      // console.log("origin Position", state.camera.position)

      // const distance = maxDistance * 1.5;
      // const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(state.camera.quaternion).normalize();
      // const newPosition = direction.multiplyScalar(-distance);

      // const dir = new THREE.Vector3(2, 0, 2); // 方向
      // const dist = Math.abs(maxDistance / Math.sin(((75 / 360) * Math.PI) / 2));
      // const temp = new THREE.Vector3();
      // temp.addVectors(state.camera.position, dir.multiplyScalar(dist));
      // state.camera.position.copy(newPosition);
      // const direction = new THREE.Vector3();
      // state.camera.getWorldDirection(direction);
      // console.log(direction)
      // const cameraPosition = new THREE.Vector3()
      //                           .copy(direction)     // 复制相机的朝向
      //                           // .negate()                  // 取反向
      //                           .normalize()               // 标准化
      //                           .multiplyScalar(dist)  // 乘以距离
      //                           .add(characterModel.position);

      // const distance = maxDistance / (Math.tan( 75 / 360 ) * Math.PI);
      // console.log("distance", distance) 
      // const direction = new THREE.Vector3(0, 1, 1.5).normalize(); 
      // const position = new THREE.Vector3().copy(direction).multiplyScalar(distance)
      // state.camera.position.copy(position).add(characterModel.position);
      const cameraToSubjectVector = new THREE.Vector3(0, -4, -3);

      const maxDegrees: number[] = [];
      const cameraPositions = [];
      for(let i = 0; i < 4; i++) {
        const newCameraPosition = new THREE.Vector3(characterModel.position.x + 5 * Math.sin( Math.PI * i / 2), characterModel.position.y + 4, characterModel.position.z + 5 * Math.cos( Math.PI * i / 2));
        const newCameraToSubjectVector = new THREE.Vector3(- 5 * Math.sin( Math.PI * i / 2), -4, - 5 * Math.cos( Math.PI * i / 2))
        const calResult = calMaxDegree(newCameraPosition, newCameraToSubjectVector, i);
        maxDegrees.push(calResult.maxDegree);
        cameraPositions.push(calResult.cameraPosition);
      }
      const minIndex = maxDegrees.findIndex(item => item === Math.min(...maxDegrees));
      // const minIndex = maxDegrees.findIndex(item => item < 35);
      const minDegree = maxDegrees[minIndex];
      const minDegreePosition = cameraPositions[minIndex];
      state.camera.position.lerp(minDegreePosition, 0.05);
      state.camera.fov = minDegree * 2;
      state.camera.updateProjectionMatrix();

      // updateCameraByChangingFov(state.camera, cameraToSubjectVector);

      controlsRef.current.target.copy(new THREE.Vector3(characterModel.position.x, characterModel.position.y + 1, characterModel.position.z));
      controlsRef.current.update();
    }
  });
  
  // Create a canvas and measure the text
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  context.font = '48px Arial';

  context.fillStyle = 'rgba(255, 255, 255, 0.6)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  // context.fillStyle = 'white';
  // context.fillText("Hello", 100, 100);

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 1 });

  return (
    <>
     <OrbitControls ref={controlsRef} position={[character.position.x, character.position.y + 1, character.position.z - 1]}/>
      {reachedTarget ? <sprite ref={spriteRef} position={[character.position.x, character.position.y + 2.2, character.position.z - 1]} material={spriteMaterial} scale={[1, 0.5, 1]}/> : null}
      <primitive object={characterModel} position={[character.position.x, character.position.y, character.position.z]} rotation={[0, Math.PI / 2, 0]}/>
    </>
  );
};



const boundingBox = new THREE.Box3();
function calMaxDegree (cameraPosition, cameraToSubjectVector, index) {
  // const cameraToObjectVectors = characters.map((item) => {
  const cameraToObjectVectors = characterInterActions.map((item) => {
    return new THREE.Vector3().subVectors(item.position, cameraPosition);
  })
  // const a = new THREE.Vector3().subVectors(characterModel.position, state.camera.position);
  // const cameraToSubjectVector = new THREE.Vector3(0, -4, -5);
  // 计算夹角
  // const angleInRadians = a.angleTo(b);
  // 转换为度
  // const angleInDegrees = angleInRadians * (180 / Math.PI)

  const degrees = cameraToObjectVectors.map((item) => {
    const angle = item.angleTo(cameraToSubjectVector);
    return angle * (180 / Math.PI);
  });
  const maxDegree = Math.max(...degrees);
  return {maxDegree: maxDegree, cameraPosition: cameraPosition}
}


const StableModel: React.FC<{character: Character, isApproaching: string}> = (({character, isApproaching}) => {
  const gltf = useLoader(GLTFLoader, '/' + character.name + '.glb');
  // console.log(character.name , gltf.animations)
  const characterModel = gltf.scene;
  boundingBox.expandByObject(characterModel);
  const mixer = useRef<THREE.AnimationMixer>();
  
  const actions = useRef<THREE.AnimationAction[]>([]);
  const waitingActionRef = useRef<THREE.AnimationAction>();

  if (!mixer.current) {
    mixer.current = new THREE.AnimationMixer(characterModel);
    // const idleClip = gltf.animations[0];
    // const idleAction = mixer.current.clipAction(idleClip as THREE.AnimationClip);
    // idleAction.play();

    gltf.animations.forEach((clip, index) => {
      const action = mixer.current!.clipAction(clip);
      if ( index === 0 ) waitingActionRef.current = action;
      actions.current.push(action);
    });
    if (waitingActionRef.current) {
      waitingActionRef.current.play();
    }
  }

  
  function startInterAction () {
    let interAction: THREE.AnimationAction | undefined;

    actions.current.forEach(action => {
      if (action.getClip().name === characterInterActions.find(e => e.name === isApproaching)?.animation ) 
        interAction = action;
    });
    
    if (interAction && waitingActionRef.current) {
      waitingActionRef.current.fadeOut(0.5);
      console.log("interAction", interAction);
      interAction.setLoop(THREE.LoopOnce, 1);
      interAction.clampWhenFinished = true;
      interAction.reset().fadeIn(0.5).play();
      setTimeout(() => {
        interAction?.fadeOut(0.5);
        if(waitingActionRef.current) {
          waitingActionRef.current?.reset().fadeIn(0.5).play();
        }
      }, 3000); 
    }
  }

  const spriteRef = useRef<THREE.Sprite>(null);

  useFrame((state, delta) => {
    if (mixer.current) {
      mixer.current.update(delta);
    }
    // if (spriteRef.current) {
    //   spriteRef.current.position.x = characterModel.position.x;
    //   spriteRef.current.position.z = characterModel.position.z;
    // }

  });

  
  // Create a canvas and measure the text
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;

  context.fillStyle = 'rgba(255, 255, 255, 0.6)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  // context.fillStyle = 'white';
  // const characterIndex = interactiveActions.find( character => character.name == isApproaching )
  // console.log(character.name, characterIndex)
  
  context.font = '48px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';


  useEffect(() => {
    if (character.name == isApproaching) {
      context.fillText(characterInterActions.find( character => character.name == isApproaching ).talkingContent, canvas.width / 2, 80);
      startInterAction();
    }
  }, [isApproaching])
  

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 1, });

  return (
    <>
      {character.name == isApproaching ? <sprite ref={spriteRef} position={[character.position.x, character.position.y + 2.2, character.position.z]} material={spriteMaterial} scale={[1, 0.5, 1]}/> : null}
      <primitive object={characterModel} position={[character.position.x, character.position.y, character.position.z]} rotation={[0, - Math.PI / 2, 0]}/>
    </>
  );
});

const Background = () => {
  const gltf = useLoader(GLTFLoader, '/factory.glb');
  const model = gltf.scene;

  return <primitive object={model} />;
};


const Scene: React.FC<{width: number, height: number}> = ({width, height}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isAutoMoving, setIsAutoMoving] = useState(false);
  const [isApproaching, setIsApproaching] = useState<string>("");

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        // canvasRef.current.style.width = window.innerWidth + 'px';
        // canvasRef.current.style.height = window.innerHeight + 'px';
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
    <div>
      <Canvas style={{ width: width + 'px', height: height + 'px' }} camera={{ fov: 75, position: [1, 2, 9] }} >
        {/* <OrbitControls target={[0, 1, 4]}  /> */}
        <Suspense fallback={null}>
          {/* {characterModel && <primitive object={characterModel} />} */}
          <ControllableModel isAutoMoving={isAutoMoving} setIsAutoMoving={setIsAutoMoving} character={characters[0]} isApproaching={isApproaching} setIsApproaching={setIsApproaching}/>
          {characters.map((character, index) => (index > 0 && <StableModel key={character.name} character={character} isApproaching={isApproaching}/>))}
          {/* <StableModel character={characters[1]}/>
          <StableModel character={characters[2]}/>
          <StableModel character={characters[3]}/>
          <StableModel character={characters[4]}/> */}
          <Background />
        </Suspense>
        <ambientLight intensity={2} color={0xffffff} />
        <pointLight position={[10, 10, 10]} />
      </Canvas>
    </div>
      {/* <button onClick={() => setIsAutoMoving(true)}>走到目标节点</button>
      <button onClick={() => setIsAutoMoving(false)}>停止行动</button> */}
    </>
  );
};

export default Scene;
