// src/components/GLBAnimationList.tsx
import { useGLTF } from "@react-three/drei";

export default function GLBAnimationList({ url }: { url: string }) {
  const { animations } = useGLTF(url) as any;

  return (
    <div className="p-3 bg-white/90 rounded-lg shadow text-black text-sm max-w-xs">
      <h3 className="font-bold mb-1">Animation Clips:</h3>
      <ul className="list-disc ml-5">
        {(!animations || animations.length === 0) && <li>Không có animation nào!</li>}
        {animations?.map((clip: any, i: number) => (
          <li key={i}>{clip.name || `Animation ${i}`}</li>
        ))}
      </ul>
    </div>
  );
}
