// src/components/AutoOrbitCamera.tsx
import { useThree } from "@react-three/fiber";
import { useRef, useEffect } from "react";
import * as THREE from "three";

interface AutoOrbitCameraProps {
  speed?: number; // tốc độ chuyển hướng (không phải tốc độ quay)
  range?: number; // biên độ random
}

// Lerp một góc, tự xử lý wrap-around 0..2PI
function lerpAngle(a: number, b: number, t: number) {
  let delta = b - a;
  if (delta > Math.PI) delta -= 2 * Math.PI;
  if (delta < -Math.PI) delta += 2 * Math.PI;
  return a + delta * t;
}

const DEFAULT_POLAR = Math.PI / 2.5; // khoảng 72°
const DEFAULT_RADIUS = 5;

// Nếu không truyền prop thì dùng mặc định speed=0.23, range=0.4 như trong App.tsx
export default function AutoOrbitCamera({ speed = 0.23, range = 0.4 }: AutoOrbitCameraProps) {
  const { camera } = useThree();
  const azimuthRef = useRef(0);
  const polarRef = useRef(DEFAULT_POLAR);

  const targetAzimuth = useRef(0);
  const targetPolar = useRef(DEFAULT_POLAR);

  useEffect(() => {
    let running = true;
    let lastT = performance.now();
    let timer = 0;
    let switchInterval = 2500; // Đổi góc mỗi 2.5s

    function animate(t: number) {
      if (!running) return;
      const dt = (t - lastT) / 1000;
      lastT = t;
      timer += dt;

      // Đổi hướng random mỗi switchInterval
      if (timer > switchInterval / 1000) {
        // Azimuth: Xoay quanh trục Y
        targetAzimuth.current = Math.random() * Math.PI * 1.5 - Math.PI * 0.75;
        // Polar: Dao động nhiều hơn (50-100°)
        targetPolar.current =
          Math.PI / 2.8 + Math.random() * range; // range điều chỉnh độ lên/xuống
        timer = 0;
      }

      // Lerp dần dần cho mượt, tỉ lệ lerp dựa trên speed
      azimuthRef.current = lerpAngle(
        azimuthRef.current,
        targetAzimuth.current,
        speed * 0.15
      );
      polarRef.current = THREE.MathUtils.lerp(
        polarRef.current,
        targetPolar.current,
        speed * 0.1
      );

      // Tính vị trí mới
      const r = DEFAULT_RADIUS;
      const azimuth = azimuthRef.current;
      const polar = polarRef.current;
      const x = r * Math.sin(polar) * Math.sin(azimuth);
      const y = r * Math.cos(polar) + 1.1;
      const z = r * Math.sin(polar) * Math.cos(azimuth);
      camera.position.set(x, y, z);
      camera.lookAt(0, 1.1, 0);

      requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);

    return () => {
      running = false;
    };
  }, [camera, speed, range]);

  return null;
}
