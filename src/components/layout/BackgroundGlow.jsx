export default function BackgroundGlow() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {/* Primary violet glow - top left */}
      <div
        className="absolute top-[-15%] left-[15%] w-[600px] h-[600px] rounded-full animate-breathe"
        style={{
          background:
            "radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.05) 40%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />

      {/* Secondary indigo glow - bottom right */}
      <div
        className="absolute bottom-[-15%] right-[5%] w-[700px] h-[700px] rounded-full animate-breathe-slow"
        style={{
          background:
            "radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, rgba(99, 102, 241, 0.04) 40%, transparent 70%)",
          filter: "blur(100px)",
          animationDelay: "-4s",
        }}
      />

      {/* Accent purple glow - center right */}
      <div
        className="absolute top-[30%] right-[20%] w-[400px] h-[400px] rounded-full animate-float"
        style={{
          background:
            "radial-gradient(circle, rgba(168, 85, 247, 0.1) 0%, transparent 60%)",
          filter: "blur(60px)",
        }}
      />

      {/* Subtle pink accent - bottom left */}
      <div
        className="absolute bottom-[20%] left-[5%] w-[350px] h-[350px] rounded-full animate-float-delayed"
        style={{
          background:
            "radial-gradient(circle, rgba(236, 72, 153, 0.08) 0%, transparent 60%)",
          filter: "blur(70px)",
        }}
      />

      {/* Floating orbs */}
      <div
        className="absolute top-[10%] left-[60%] w-3 h-3 rounded-full bg-violet-400/30 animate-orb-float"
        style={{ animationDelay: "0s" }}
      />
      <div
        className="absolute top-[25%] left-[80%] w-2 h-2 rounded-full bg-indigo-400/25 animate-orb-float"
        style={{ animationDelay: "-3s" }}
      />
      <div
        className="absolute top-[45%] left-[10%] w-4 h-4 rounded-full bg-purple-400/20 animate-orb-float"
        style={{ animationDelay: "-7s" }}
      />
      <div
        className="absolute top-[60%] left-[75%] w-2 h-2 rounded-full bg-pink-400/25 animate-orb-float"
        style={{ animationDelay: "-5s" }}
      />
      <div
        className="absolute top-[75%] left-[25%] w-3 h-3 rounded-full bg-violet-300/20 animate-orb-float"
        style={{ animationDelay: "-9s" }}
      />
      <div
        className="absolute top-[15%] left-[35%] w-2 h-2 rounded-full bg-indigo-300/30 animate-orb-float"
        style={{ animationDelay: "-2s" }}
      />

      {/* Moving gradient wave */}
      <div
        className="absolute inset-0 opacity-30 animate-gradient-shift"
        style={{
          background:
            "linear-gradient(45deg, transparent 0%, rgba(139, 92, 246, 0.03) 25%, transparent 50%, rgba(99, 102, 241, 0.03) 75%, transparent 100%)",
          backgroundSize: "400% 400%",
        }}
      />

      {/* Aurora effect */}
      <div
        className="absolute top-0 left-0 right-0 h-[60%] opacity-20 animate-aurora"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(139, 92, 246, 0.05) 20%, rgba(99, 102, 241, 0.08) 40%, rgba(168, 85, 247, 0.05) 60%, transparent 100%)",
          filter: "blur(40px)",
        }}
      />

      {/* Subtle star particles */}
      <div className="absolute inset-0">
        <div className="absolute top-[8%] left-[12%] w-1 h-1 rounded-full bg-white/40 animate-twinkle" style={{ animationDelay: "0s" }} />
        <div className="absolute top-[15%] left-[88%] w-1 h-1 rounded-full bg-white/30 animate-twinkle" style={{ animationDelay: "-1s" }} />
        <div className="absolute top-[32%] left-[45%] w-1 h-1 rounded-full bg-white/25 animate-twinkle" style={{ animationDelay: "-2s" }} />
        <div className="absolute top-[48%] left-[22%] w-1 h-1 rounded-full bg-white/35 animate-twinkle" style={{ animationDelay: "-0.5s" }} />
        <div className="absolute top-[55%] left-[78%] w-1 h-1 rounded-full bg-white/30 animate-twinkle" style={{ animationDelay: "-3s" }} />
        <div className="absolute top-[72%] left-[55%] w-1 h-1 rounded-full bg-white/25 animate-twinkle" style={{ animationDelay: "-1.5s" }} />
        <div className="absolute top-[85%] left-[15%] w-1 h-1 rounded-full bg-white/40 animate-twinkle" style={{ animationDelay: "-2.5s" }} />
        <div className="absolute top-[22%] left-[65%] w-1 h-1 rounded-full bg-white/30 animate-twinkle" style={{ animationDelay: "-4s" }} />
        <div className="absolute top-[68%] left-[35%] w-1 h-1 rounded-full bg-white/35 animate-twinkle" style={{ animationDelay: "-3.5s" }} />
        <div className="absolute top-[40%] left-[92%] w-1 h-1 rounded-full bg-white/25 animate-twinkle" style={{ animationDelay: "-0.8s" }} />
      </div>

      {/* Grid overlay for depth */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: "100px 100px",
        }}
      />

      {/* Radial vignette for focus */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, rgba(0, 0, 0, 0.4) 100%)",
        }}
      />
    </div>
  );
}
