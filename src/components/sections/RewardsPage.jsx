export default function RewardsPage({ activePage }) {
  const rewards = [
    {
      icon: "solar:crown-linear",
      title: "Exclusive Booster Role",
      description:
        "Stand out with a special booster role and color that shows your support in the server.",
      color: "violet",
      delay: "100",
    },
    {
      icon: "solar:chat-round-dots-linear",
      title: "Booster-Only Channels",
      description:
        "Access private channels exclusive to boosters with special drops and announcements.",
      color: "emerald",
      delay: "200",
    },
    {
      icon: "solar:gift-linear",
      title: "Priority Drops",
      description:
        "Get early access to account drops before they go live to the rest of the server.",
      color: "amber",
      delay: "300",
    },
    {
      icon: "solar:star-shine-linear",
      title: "Recognition & Shoutouts",
      description:
        "Get featured in our booster hall of fame and special thank-you shoutouts.",
      color: "pink",
      delay: "400",
    },
  ];

  const colorClasses = {
    violet: {
      bg: "bg-violet-500/10",
      border: "border-violet-500/20",
      hoverBg: "group-hover:bg-violet-500/20",
      hoverBorder: "group-hover:border-violet-400/40",
      text: "text-violet-400",
      hoverText: "group-hover:text-violet-200",
    },
    emerald: {
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      hoverBg: "group-hover:bg-emerald-500/20",
      hoverBorder: "group-hover:border-emerald-400/40",
      text: "text-emerald-400",
      hoverText: "group-hover:text-emerald-200",
    },
    amber: {
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      hoverBg: "group-hover:bg-amber-500/20",
      hoverBorder: "group-hover:border-amber-400/40",
      text: "text-amber-400",
      hoverText: "group-hover:text-amber-200",
    },
    pink: {
      bg: "bg-pink-500/10",
      border: "border-pink-500/20",
      hoverBg: "group-hover:bg-pink-500/20",
      hoverBorder: "group-hover:border-pink-400/40",
      text: "text-pink-400",
      hoverText: "group-hover:text-pink-200",
    },
  };

  return (
    <section
      className="page relative z-10 py-28"
      data-page="rewards"
      hidden={activePage !== "rewards"}
    >
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="opacity-0 animate-fade-in-up mb-14">
          <div className="flex items-center gap-3 mb-3">
            <iconify-icon
              icon="ic:baseline-discord"
              width="24"
              height="24"
              className="text-[#5865F2]"
            ></iconify-icon>
            <p className="text-sm font-medium text-violet-400 uppercase tracking-widest">
              Discord Booster Perks
            </p>
          </div>
          <h2 className="text-3xl md:text-4xl font-medium text-white tracking-tight mb-4">
            Boost Rewards
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mb-6">
            Support our Discord server with a boost and unlock exclusive in-server perks as a thank you.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#5865F2]/10 border border-[#5865F2]/20 text-sm text-slate-300">
            <iconify-icon
              icon="solar:info-circle-linear"
              width="16"
              height="16"
              className="text-[#5865F2]"
            ></iconify-icon>
            <span>All rewards are exclusive to our Discord server</span>
          </div>
        </div>

        {/* Rewards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rewards.map((reward) => {
            const colors = colorClasses[reward.color];
            return (
              <div
                key={reward.title}
                className={`opacity-0 animate-fade-in-up delay-${reward.delay} glass-panel p-8 rounded-2xl group card-hover cursor-default`}
              >
                <div
                  className={`w-14 h-14 rounded-xl ${colors.bg} flex items-center justify-center mb-6 border ${colors.border} transition-all duration-300 group-hover:scale-110 ${colors.hoverBg} ${colors.hoverBorder}`}
                >
                  <iconify-icon
                    icon={reward.icon}
                    width="28"
                    height="28"
                    className={colors.text}
                  ></iconify-icon>
                </div>
                <h3
                  className={`text-xl font-medium text-white mb-3 transition-colors duration-300 ${colors.hoverText}`}
                >
                  {reward.title}
                </h3>
                <p className="text-base text-slate-400 leading-relaxed">
                  {reward.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Discord-only notice */}
        <div className="opacity-0 animate-fade-in-up delay-600 mt-10 text-center">
          <div className="inline-flex flex-col sm:flex-row items-center gap-3 px-6 py-4 rounded-2xl bg-white/[0.02] border border-white/5">
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <iconify-icon
                icon="solar:shield-check-linear"
                width="18"
                height="18"
                className="text-slate-500"
              ></iconify-icon>
              <span>Boost rewards are redeemed automatically in Discord</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-white/10" />
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <iconify-icon
                icon="solar:info-circle-linear"
                width="18"
                height="18"
                className="text-slate-500"
              ></iconify-icon>
              <span>No external rewards or real-world items</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
