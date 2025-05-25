import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeftIcon,
  ArrowUpIcon,
  ArrowRightIcon,
  ArrowDownIcon,
} from "@heroicons/react/24/solid";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import GLBViewer from "./components/GLBViewer";
import AutoOrbitCamera from "./components/AutoOrbitCamera";


type Key = "ArrowLeft" | "ArrowUp" | "ArrowRight" | "ArrowDown";
type ComboStep = { key: Key; state: "pending" | "correct" | "wrong" };

const COMBO_LENGTH = 5;
const KEYS: Key[] = ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"];
const GAME_START_TIME = 10000;    // 10 seconds
const COMBO_REWARD = 10000;       // +10 seconds per combo
const COMBO_INTERVAL = 5000;      // after 5s, new combo

// Animation to exclude (e.g., "Armature.009|mixamo.com|Layer0")
const EXCLUDED_ANIMATION = "Armature.009|mixamo.com|Layer0";

const KEY_ICONS: Record<Key, React.FC<{ className?: string }>> = {
  ArrowLeft: ArrowLeftIcon,
  ArrowUp: ArrowUpIcon,
  ArrowRight: ArrowRightIcon,
  ArrowDown: ArrowDownIcon,
};

function getRandomCombo(n: number): ComboStep[] {
  return Array.from({ length: n }, () => ({
    key: KEYS[Math.floor(Math.random() * KEYS.length)],
    state: "pending",
  }));
}

export default function App() {
  const audioRef = useRef<HTMLAudioElement>(null);

  const [combo, setCombo] = useState<ComboStep[]>(getRandomCombo(COMBO_LENGTH));
  const [comboIndex, setComboIndex] = useState(0);

  const [animationNames, setAnimationNames] = useState<string[]>([]);
  const [idleIndex, setIdleIndex] = useState(0);
  const [endMoveIndex, setEndMoveIndex] = useState(0);

  const [animationQueue, setAnimationQueue] = useState<number[]>([]);
  const [queueCursor, setQueueCursor] = useState(-1);
  const [gameEnded, setGameEnded] = useState(false);

  const [gameStarted, setGameStarted] = useState(false);

  const comboTimerRef = useRef<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(GAME_START_TIME);
  const [ready, setReady] = useState(true);
  const [hasStartedOnce, setHasStartedOnce] = useState(false);

  // Time bonus animation
  const [showTimeBonus, setShowTimeBonus] = useState(false);
  const [bonusAmount, setBonusAmount] = useState(0);

  // Reset all state when change model or new game
  useEffect(() => {
    setQueueCursor(-1);
    setAnimationQueue([]);
    setGameStarted(false);
    setGameEnded(false);
    setTimeLeft(GAME_START_TIME);
    setCombo(getRandomCombo(COMBO_LENGTH));
    setComboIndex(0);
    setReady(true);
    setHasStartedOnce(false);
    setShowTimeBonus(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [animationNames.length]);

  useEffect(() => {
    if (!animationNames.length) return;
    const idle = animationNames.findIndex((n) => n.toLowerCase().includes("idle"));
    setIdleIndex(idle >= 0 ? idle : 0);
    const endMove = animationNames.findIndex((n) => n.toLowerCase().includes("end move"));
    setEndMoveIndex(endMove >= 0 ? endMove : animationNames.length - 1);
  }, [animationNames]);

  // Start audio & timer only first time
  useEffect(() => {
    if (
      gameStarted &&
      animationQueue.length > 0 &&
      queueCursor === 0 &&
      !hasStartedOnce
    ) {
      setHasStartedOnce(true);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    }
  }, [queueCursor, animationQueue.length, gameStarted, hasStartedOnce]);

  // Timer logic (survival mode)
  useEffect(() => {
    if (!gameStarted || gameEnded || !hasStartedOnce) {
      setTimeLeft(GAME_START_TIME);
      return;
    }
    let frameId: number;
    function update() {
      setTimeLeft((prev) => {
        const left = Math.max(0, prev - 1000 / 60);
        if (left <= 0 && !gameEnded) setGameEnded(true);
        return left;
      });
      if (!gameEnded && gameStarted && hasStartedOnce) frameId = requestAnimationFrame(update);
    }
    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
    // eslint-disable-next-line
  }, [gameStarted, gameEnded, hasStartedOnce]);

  // Stop music & allow new game when ended
  useEffect(() => {
    if (gameEnded && queueCursor === -1) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setAnimationQueue([]); // Only clear queue when back to idle!
      setReady(true);
    }
  }, [gameEnded, queueCursor]);

  // Combo timeout
  useEffect(() => {
    if (!gameStarted || gameEnded) return;
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    comboTimerRef.current = window.setTimeout(() => {
      setCombo(getRandomCombo(COMBO_LENGTH));
      setComboIndex(0);
    }, COMBO_INTERVAL);
    return () => {
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    };
  }, [combo, comboIndex, gameEnded, gameStarted]);

  // Keyboard input
  useEffect(() => {
    if (gameEnded || !gameStarted) return;
    const handler = (e: KeyboardEvent) => {
      if (comboIndex < combo.length) {
        if (KEYS.includes(e.key as Key)) {
          if (e.key === combo[comboIndex].key) {
            setCombo((prev) =>
              prev.map((step, idx) =>
                idx === comboIndex
                  ? { ...step, state: "correct" }
                  : step
              )
            );
            setComboIndex((idx) => idx + 1);
          } else {
            setCombo((prev) =>
              prev.map((step, idx) =>
                idx === comboIndex
                  ? { ...step, state: "wrong" }
                  : step
              )
            );
            setTimeout(() => {
              setCombo(getRandomCombo(COMBO_LENGTH));
              setComboIndex(0);
            }, 500);
          }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [comboIndex, combo, gameEnded, gameStarted]);

  // Combo success: +10s and add new animation (only if not ended)
  useEffect(() => {
    if (gameEnded || !gameStarted) return;
    if (comboIndex === combo.length && combo.every(step => step.state === "correct")) {
      setTimeLeft((prev) => prev + COMBO_REWARD);

      // Show time bonus effect
      setBonusAmount(COMBO_REWARD / 1000);
      setShowTimeBonus(true);
      setTimeout(() => setShowTimeBonus(false), 1200);

      // Only allow one animation per combo (avoid double add)
      setAnimationQueue((prev) => {
        // Exclude Idle, EndMove, and EXCLUDED_ANIMATION
        const validAnims = animationNames
          .map((n, i) => ({ n, i }))
          .filter(
            ({ n, i }) =>
              i !== idleIndex &&
              i !== endMoveIndex &&
              n !== EXCLUDED_ANIMATION
          )
          .map(({ i }) => i);

        if (validAnims.length === 0) return prev;
        let candidates = validAnims;
        const lastAnim = prev.length > 0 ? prev[prev.length - 1] : undefined;
        const currentAnim = prev.length > 0 && queueCursor >= 0 ? prev[queueCursor] : undefined;

        if (
          prev.length > 0 &&
          validAnims.length > 2 &&
          currentAnim !== undefined
        ) {
          candidates = validAnims.filter(
            idx => idx !== lastAnim && idx !== currentAnim
          );
        } else if (prev.length > 0 && validAnims.length > 1 && lastAnim !== undefined) {
          candidates = validAnims.filter(idx => idx !== lastAnim);
        }
        const nextAnim = candidates[Math.floor(Math.random() * candidates.length)];
        return [...prev, nextAnim];
      });

      setTimeout(() => {
        setCombo(getRandomCombo(COMBO_LENGTH));
        setComboIndex(0);
      }, 500);
    }
  }, [
    comboIndex,
    combo,
    animationNames,
    gameEnded,
    idleIndex,
    endMoveIndex,
    queueCursor,
    gameStarted,
  ]);

  // When queue has anim and not playing, play first anim
  useEffect(() => {
    if (!gameEnded && queueCursor === -1 && animationQueue.length > 0 && gameStarted) {
      setQueueCursor(0);
    }
  }, [animationQueue, queueCursor, gameEnded, gameStarted]);

  // Handle animation finished
  function handleAnimationFinished() {
    if (gameEnded) {
      // Khi kết thúc, play end move trước idle (nếu chưa play), rồi idle
      if (
        queueCursor + 1 === animationQueue.length &&
        endMoveIndex !== -1 &&
        queueCursor !== endMoveIndex
      ) {
        setQueueCursor(endMoveIndex);
      } else {
        setQueueCursor(-1); // về idle
      }
      return;
    }
    if (queueCursor + 1 < animationQueue.length) {
      setQueueCursor(queueCursor + 1);
    } else if (animationQueue.length > 0) {
      setQueueCursor(animationQueue.length - 1);
    } else {
      setQueueCursor(-1);
    }
  }

  useEffect(() => {
    if (animationNames.length > 0) setQueueCursor(-1);
  }, [animationNames]);

  // Start new game
  function handleStartGame() {
    setReady(false);
    setGameStarted(true);
    setGameEnded(false);
    setHasStartedOnce(false);
    setCombo(getRandomCombo(COMBO_LENGTH));
    setComboIndex(0);
    setAnimationQueue([]);
    setQueueCursor(-1);
    setTimeLeft(GAME_START_TIME);
  }

  // Restart after game end
  function handleNewGame() {
    setCombo(getRandomCombo(COMBO_LENGTH));
    setComboIndex(0);
    setAnimationQueue([]);
    setQueueCursor(-1);
    setGameEnded(false);
    setGameStarted(false);
    setTimeLeft(GAME_START_TIME);
    setReady(true);
    setHasStartedOnce(false);
    setShowTimeBonus(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }

  let animToPlay = idleIndex;
  if (queueCursor >= 0 && animationQueue[queueCursor] != null)
    animToPlay = animationQueue[queueCursor];
  else if (queueCursor === endMoveIndex)
    animToPlay = endMoveIndex;
  else animToPlay = idleIndex;

  let loopType: "once" | "repeat" = "once";
  if (!gameStarted || queueCursor === -1) {
    loopType = "repeat";
  } else if (
    animationQueue.length > 0 &&
    queueCursor === animationQueue.length - 1 &&
    !gameEnded
  ) {
    loopType = "repeat";
  } else if (queueCursor === endMoveIndex) {
    loopType = "once";
  }

  // Đếm đúng số anim còn lại kể cả khi gameEnded và queue chưa empty!
  let remainingAnimations = 0;
  if (queueCursor === -1) {
    remainingAnimations = 0;
  } else if (queueCursor >= 0) {
    remainingAnimations = Math.max(0, animationQueue.length - queueCursor);
  }

  function formatTime(ms: number) {
    const sec = Math.ceil(ms / 1000);
    const min = Math.floor(sec / 60);
    const remain = sec % 60;
    return `${min}:${remain.toString().padStart(2, "0")}`;
  }

  function getBg(step: ComboStep) {
    if (step.state === "correct") return "bg-green-500";
    if (step.state === "wrong") return "bg-red-500";
    return "bg-yellow-400";
  }
  function getBorder(step: ComboStep, idx: number) {
    if (step.state === "wrong") return "border-4 border-red-400";
    if (step.state === "correct") return "border-4 border-green-400";
    if (idx === comboIndex) return "border-4 border-yellow-200";
    return "border-2 border-gray-300";
  }
  function getPulse(step: ComboStep, idx: number) {
    return step.state === "pending" && idx === comboIndex
      ? "animate-pulse"
      : "";
  }

  return (
    <div className="fixed inset-0 w-full h-full bg-black">
      <audio
        ref={audioRef}
        src="/assets/audio/Music.mp3"
        preload="auto"
        hidden
      />
      <Canvas
        camera={{ position: [0, 3.5, 5], fov: 36 }}
        className="absolute inset-0 w-full h-full"
        gl={{ preserveDrawingBuffer: false, alpha: false }}
        style={{ background: "#000" }}
      >
        <ambientLight intensity={1.2} />
        <directionalLight position={[5, 10, 7]} intensity={1.2} />
        <GLBViewer
          url="/assets/models/character.glb"
          play={true}
          animIndex={animToPlay}
          loopType={loopType}
          onAnimationsLoaded={setAnimationNames}
          onAnimationFinished={handleAnimationFinished}
        />
        <OrbitControls enablePan={false} target={[0, 0.5, 0]} />
        {gameStarted && <AutoOrbitCamera speed={0.32} range={0.65} />}
        <Environment files="/assets/hdr/abandoned_garage_2k.hdr" background={false} />
      </Canvas>
      {/* UI góc trái dưới, đồng hồ, combo, queue, nút */}
      <div className="absolute left-12 bottom-12 flex flex-col items-start pointer-events-none w-fit">
        <div className="flex flex-col items-center w-full">
          {gameStarted && !gameEnded && (
            <div className={`relative text-5xl font-mono font-bold mb-6 pointer-events-auto
              ${timeLeft <= 5000 ? "text-red-400 animate-pulse" : "text-green-300"}`}>
              {formatTime(timeLeft)}
              {/* Time Bonus effect */}
              {showTimeBonus && (
                <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full pointer-events-none">
                  <div className="
                    text-3xl font-extrabold text-green-300 drop-shadow-lg
                    animate-bounce
                    opacity-90
                  "
                    style={{
                      animation: "fadeinout 1.2s",
                    }}
                  >
                    +{bonusAmount}s
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="mb-6 flex items-center space-x-2 pointer-events-auto bg-black/40 px-6 py-3 rounded-xl shadow-xl">
            {combo.map((step, idx) => {
              const IconComp = KEY_ICONS[step.key];
              return (
                <div
                  key={idx}
                  className={`w-14 h-14 flex items-center justify-center rounded-full shadow-md
                  ${getBg(step)} ${getBorder(step, idx)} ${getPulse(step, idx)}
                  transition-all duration-150`}
                >
                  <IconComp className="w-9 h-9 text-white" />
                </div>
              );
            })}
          </div>
          <div className="text-white text-lg mb-4 text-center w-full">
            Moves in queue: <span className="font-bold text-green-300">{remainingAnimations}</span>
            {gameEnded && <span className="ml-2 text-blue-400">(Finishing...)</span>}
          </div>
        </div>
        <div className="flex flex-col items-center pointer-events-auto w-full">
          {ready && !gameStarted && (
            <button
              onClick={handleStartGame}
              className="px-8 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg text-white font-semibold text-lg shadow-lg"
            >
              Start
            </button>
          )}
          {ready && gameEnded && (
            <button
              onClick={handleNewGame}
              className="px-8 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg text-white font-semibold text-lg shadow-lg"
            >
              New Game
            </button>
          )}
        </div>
      </div>
      {/* Hướng dẫn - góc phải trên */}
      <div className="absolute top-6 right-6 pointer-events-auto z-50 bg-black/80 text-white p-6 rounded-xl max-w-xs shadow-2xl font-semibold leading-relaxed select-none">
        <div className="text-2xl mb-2 font-bold text-blue-300">How to Play</div>
        <ul className="list-disc pl-5 space-y-2 text-base">
          <li>
            Press the <span className="font-mono bg-gray-800 rounded px-2 py-1">← ↑ → ↓</span> keys in the correct order shown below.
          </li>
          <li>
            Each successful combo adds <span className="font-bold text-green-300">10 seconds</span> to your timer.
          </li>
          <li>
            If the timer reaches zero, your character will finish the last moves and return to idle.
          </li>
          <li>
            Try to keep your character dancing as long as possible!
          </li>
          <li>
            Press <span className="font-mono bg-gray-800 rounded px-2 py-1">Start</span> to begin.
          </li>
        </ul>
      </div>
    </div>
  );
}
