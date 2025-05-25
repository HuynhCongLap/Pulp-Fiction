import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

interface Props {
  url: string;
  play: boolean;
  animIndex: number;
  loopType?: "once" | "repeat";
  onAnimationsLoaded?: (names: string[]) => void;
  onAnimationFinished?: () => void;
}

export default function GLBViewer({
  url,
  play,
  animIndex,
  loopType = "repeat",
  onAnimationsLoaded,
  onAnimationFinished,
}: Props) {
  const { scene, animations } = useGLTF(url) as any;
  const mixer = useRef<THREE.AnimationMixer | null>(null);
  const activeAction = useRef<THREE.AnimationAction | null>(null);
  const prevAnimIndex = useRef<number>(-1);

  useEffect(() => {
    if (animations && animations.length > 0 && onAnimationsLoaded) {
      onAnimationsLoaded(animations.map((a: any) => a.name));
    }
  }, [animations, onAnimationsLoaded]);

  useEffect(() => {
    if (!scene || !animations || animations.length === 0) return;

    if (!mixer.current) {
      mixer.current = new THREE.AnimationMixer(scene);
    }

    const action = mixer.current.clipAction(animations[animIndex]);
    action.reset();
    action.setLoop(
      loopType === "repeat"
        ? THREE.LoopRepeat
        : THREE.LoopOnce,
      Infinity
    );
    action.clampWhenFinished = true;

    if (
      prevAnimIndex.current !== -1 &&
      prevAnimIndex.current !== animIndex &&
      activeAction.current
    ) {
      activeAction.current.fadeOut(0.2);
      action.reset().fadeIn(0.2).play();
    } else {
      action.play();
    }

    activeAction.current = action;
    prevAnimIndex.current = animIndex;

    if (loopType === "once" && onAnimationFinished) {
      const finished = () => {
        onAnimationFinished();
      };
      mixer.current.addEventListener("finished", finished);
      return () => {
        mixer.current?.removeEventListener("finished", finished);
      };
    }
    return () => {
      mixer.current?.stopAllAction();
    };
    // eslint-disable-next-line
  }, [scene, animations, animIndex, loopType]);

  useEffect(() => {
    if (activeAction.current) {
      activeAction.current.paused = !play;
    }
  }, [play]);

  useFrame((_, delta) => {
    if (mixer.current && play) mixer.current.update(delta);
  });

  return <primitive object={scene} />;
}
