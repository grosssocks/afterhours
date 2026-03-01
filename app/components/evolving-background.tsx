"use client";

export type Vibe =
  | "lush"      // vibrant forest / good day
  | "rainy"     // calm rainy cityscape / low
  | "calm"      // warm amber / mixed
  | "sunset"    // warm positive
  | "night"     // neutral / rest
  | "ocean"     // calm blue
  | "neutral";  // default

type Props = { vibe: Vibe };

export function EvolvingBackground({ vibe }: Props) {
  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Base layer: deep gradient per vibe */}
      <div
        className="vibe-base absolute inset-0 transition-all duration-[2500ms] ease-out"
        style={{
          background:
            vibe === "lush"
              ? "linear-gradient(165deg, #052e16 0%, #064e3b 35%, #022c22 70%, #01200e 100%)"
              : vibe === "rainy"
                ? "linear-gradient(180deg, #0f172a 0%, #1e293b 30%, #0c4a6e 60%, #082f49 100%)"
                : vibe === "calm"
                  ? "linear-gradient(180deg, #1c1917 0%, #292524 40%, #44403c 70%, #0f0f12 100%)"
                  : vibe === "sunset"
                    ? "linear-gradient(180deg, #7c2d12 0%, #9a3412 25%, #c2410c 50%, #1c1917 85%, #0f0f12 100%)"
                    : vibe === "night"
                      ? "linear-gradient(180deg, #0c0a09 0%, #1c1917 30%, #0f0f12 60%, #030712 100%)"
                      : vibe === "ocean"
                        ? "linear-gradient(180deg, #0c4a6e 0%, #075985 30%, #0e7490 55%, #164e63 100%)"
                        : "linear-gradient(180deg, #18181b 0%, #0f0f12 50%, #09090b 100%)",
        }}
      />

      {/* Lush: forest glow + soft floating orbs */}
      {vibe === "lush" && (
        <>
          <div
            className="absolute -top-[10%] left-1/2 h-[70%] w-[140%] -translate-x-1/2 rounded-full opacity-40 blur-[80px] transition-opacity duration-[2500ms]"
            style={{ background: "radial-gradient(circle, #4ade80 0%, #16a34a 40%, transparent 70%)" }}
          />
          <div
            className="absolute bottom-0 left-0 right-0 h-[55%] opacity-50 transition-opacity duration-[2500ms]"
            style={{
              background: "radial-gradient(ellipse 100% 70% at 50% 100%, #166534, #052e16 50%, transparent)",
            }}
          />
          <div className="absolute bottom-[20%] left-[5%] h-32 w-40 rounded-full bg-emerald-600/20 blur-3xl" />
          <div className="absolute bottom-[25%] right-[10%] h-28 w-36 rounded-full bg-green-700/25 blur-3xl" />
          <div className="absolute top-[40%] right-[20%] h-16 w-16 rounded-full bg-lime-500/15 blur-2xl animate-pulse" />
        </>
      )}

      {/* Rainy: soft drizzle, barely there */}
      {vibe === "rainy" && (
        <>
          <div
            className="absolute inset-0 opacity-25 transition-opacity duration-[2500ms]"
            style={{
              background: "linear-gradient(180deg, transparent 0%, #334155 40%, #1e293b 100%)",
            }}
          />
          <div className="rain-container absolute inset-0 overflow-hidden opacity-[0.22]">
            {Array.from({ length: 16 }).map((_, i) => (
              <div
                key={i}
                className="rain-line absolute h-12 w-px bg-white/20"
                style={{
                  left: `${(i * 6.5) % 100}%`,
                  animationDelay: `${(i * 0.15) % 2.5}s`,
                  transform: "translateY(-100%) rotate(-8deg)",
                }}
              />
            ))}
          </div>
          <div
            className="absolute bottom-0 left-0 right-0 h-[45%] opacity-30"
            style={{
              background: "linear-gradient(0deg, #0f172a 0%, transparent 60%)",
            }}
          />
        </>
      )}

      {/* Calm: warm center glow */}
      {vibe === "calm" && (
        <>
          <div
            className="absolute top-1/2 left-1/2 h-[90%] w-[90%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-35 blur-[100px] transition-opacity duration-[2500ms]"
            style={{ background: "radial-gradient(circle, #d97706 0%, #b45309 30%, transparent 65%)" }}
          />
        </>
      )}

      {/* Sunset: horizon band + glow */}
      {vibe === "sunset" && (
        <>
          <div
            className="absolute bottom-[25%] left-0 right-0 h-[35%] opacity-60 transition-opacity duration-[2500ms]"
            style={{
              background: "linear-gradient(0deg, #0f0f12 0%, #ea580c 25%, #fbbf24 50%, #fcd34d 75%, transparent 100%)",
            }}
          />
          <div
            className="absolute bottom-[30%] left-1/2 h-[50%] w-[120%] -translate-x-1/2 rounded-full opacity-25 blur-[60px]"
            style={{ background: "radial-gradient(circle, #f59e0b 0%, transparent 60%)" }}
          />
        </>
      )}

      {vibe === "night" ? (
        <>
          <div
            className="absolute inset-0 opacity-50"
            style={{
              background: "radial-gradient(ellipse 80% 50% at 50% 20%, #1e3a5f 0%, transparent 50%)",
            }}
          />
          <div className="stars absolute inset-0">
            {Array.from({ length: 50 }).map((_, i) => (
              <div
                key={i}
                className="star absolute h-px w-px rounded-full bg-white"
                style={{
                  left: `${(i * 17) % 100}%`,
                  top: `${(i * 11 + 5) % 85}%`,
                  opacity: 0.3 + (i % 3) * 0.2,
                  animationDelay: `${(i * 0.2) % 3}s`,
                }}
              />
            ))}
          </div>
        </>
      ) : null}

      {/* Ocean: waves feel + depth */}
      {vibe === "ocean" && (
        <>
          <div
            className="absolute -top-[20%] left-1/2 h-[60%] w-[120%] -translate-x-1/2 rounded-full opacity-30 blur-3xl transition-opacity duration-[2500ms]"
            style={{ background: "radial-gradient(circle, #0ea5e9 0%, #0284c7 40%, transparent 70%)" }}
          />
          <div
            className="absolute bottom-0 left-0 right-0 h-[50%] opacity-40"
            style={{
              background: "linear-gradient(0deg, #0e7490 0%, #155e75 40%, #164e63 100%)",
            }}
          />
          <div className="wave wave-1" />
          <div className="wave wave-2" />
        </>
      )}

      {/* Neutral: soft vignette */}
      {vibe === "neutral" && (
        <div
          className="absolute inset-0 opacity-50 transition-opacity duration-[2500ms]"
          style={{
            background: "radial-gradient(ellipse 90% 80% at 50% 50%, transparent 30%, #0f0f12 100%)",
          }}
        />
      )}
    </div>
  );
}
