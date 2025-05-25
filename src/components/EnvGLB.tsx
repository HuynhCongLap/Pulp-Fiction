// src/components/EnvGLB.tsx
import { useGLTF } from "@react-three/drei";

export default function EnvGLB({ url = "/assets/models/room.glb", ...props }) {
  const { scene } = useGLTF(url);
  return (
    <primitive object={scene} {...props} />
  );
}
