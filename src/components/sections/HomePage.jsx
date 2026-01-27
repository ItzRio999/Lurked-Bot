import BoostLogo from "../../../icons/boostv2.png";
import TypingText from "../ui/TypingText";

export default function HomePage({
  activePage,
  currentUser,
  welcomeText,
  onNav,
  LurkedLogo,
  teamMembers,
  teamMembersLoading,
  teamMembersError,
}) {
  return (
    <div className="page" data-page="home" hidden={activePage !== "home"}>
      <main className="relative z-10 pt-32 pb-20 lg:pt-48 lg:pb-32 px-6">
        <div className="max-w-5xl mx-auto text-center">
          {/* Logo */}
          <div className="opacity-0 animate-fade-in-up inline-flex items-center justify-center mb-8">
            <img
              src={LurkedLogo}
              alt="LurkedAccounts Logo"
              className="h-28 sm:h-32 md:h-36 w-auto object-contain drop-shadow-2xl"
              height="144"
            />
          </div>

          {/* Welcome Message (logged in) */}
          {currentUser ? (
            <>
              <div className="opacity-0 animate-fade-in-up delay-100 text-violet-200 text-3xl md:text-4xl lg:text-5xl mb-4">
                <TypingText text={welcomeText} speed={70} delay={500} />
              </div>
              <h1 className="opacity-0 animate-fade-in-up delay-200 text-4xl md:text-6xl lg:text-7xl font-medium text-white tracking-tight mb-8 leading-[1.1]">
                <span className="block">Stop Lurking.</span>
                <span className="block text-gradient">Start Winning.</span>
              </h1>
            </>
          ) : (
            <h1 className="opacity-0 animate-fade-in-up delay-100 text-5xl md:text-7xl lg:text-8xl font-medium text-white tracking-tight mb-8 leading-[1.1]">
              Stop Lurking.
              <br />
              <span className="text-gradient">Start Winning.</span>
            </h1>
          )}

          {/* Subtitle */}
          <p className="opacity-0 animate-fade-in-up delay-200 text-xl md:text-2xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed font-light">
            The open community for every gamer. Join LurkedAccounts for
            exclusive account drops, boost rewards, movie nights, and more.
          </p>

          {/* CTA Buttons */}
          <div className="opacity-0 animate-fade-in-up delay-300 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              className="group w-full sm:w-auto px-8 py-4 bg-white text-black rounded-full font-medium transition-all duration-300 hover:bg-slate-100 hover:shadow-xl hover:shadow-violet-500/20 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
              onClick={onNav("community")}
            >
              <iconify-icon
                icon="solar:gift-linear"
                width="22"
                height="22"
                className="transition-transform duration-300 group-hover:scale-110"
              ></iconify-icon>
              Lurk the Drops
              <iconify-icon
                icon="solar:arrow-right-linear"
                width="18"
                height="18"
                className="transition-transform duration-300 group-hover:translate-x-1"
              ></iconify-icon>
            </button>
            <button
              type="button"
              onClick={onNav("forums")}
              className="group w-full sm:w-auto px-8 py-4 bg-white/5 backdrop-blur-md border border-white/15 text-white rounded-full font-medium transition-all duration-300 hover:bg-white/10 hover:border-white/25 hover:shadow-lg hover:shadow-violet-500/10 active:scale-[0.98] flex items-center justify-center gap-3"
            >
              <iconify-icon
                icon="solar:users-group-rounded-linear"
                width="22"
                height="22"
                className="transition-transform duration-300 group-hover:scale-110"
              ></iconify-icon>
              Lurk the Forums
            </button>
          </div>

          {/* Stats Section */}
          <div className="opacity-0 animate-fade-in-up delay-400 mt-20 pt-10">
            <div className="flex flex-col md:flex-row items-center justify-center gap-10 md:gap-20 py-8 px-10 rounded-2xl bg-white/[0.02] backdrop-blur-sm border border-white/5">
              <div className="group flex flex-col items-center transition-transform duration-300 hover:-translate-y-1">
                <span className="text-4xl font-semibold text-white tracking-tight mb-1 transition-all duration-300 group-hover:text-violet-300">
                  400+
                </span>
                <span className="text-sm text-slate-500 uppercase tracking-widest">
                  Active Members
                </span>
              </div>
              <div className="h-12 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent hidden md:block"></div>
              <div className="group flex flex-col items-center transition-transform duration-300 hover:-translate-y-1">
                <span className="text-4xl font-semibold text-white tracking-tight mb-1 transition-all duration-300 group-hover:text-violet-300">
                  Daily
                </span>
                <span className="text-sm text-slate-500 uppercase tracking-widest">
                  Account Drops
                </span>
              </div>
              <div className="h-12 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent hidden md:block"></div>
              <div className="group flex flex-col items-center transition-transform duration-300 hover:-translate-y-1">
                <span className="text-4xl font-semibold text-white tracking-tight mb-1 transition-all duration-300 group-hover:text-violet-300">
                  24/7
                </span>
                <span className="text-sm text-slate-500 uppercase tracking-widest">
                  Support
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section className="relative z-10 py-28 bg-gradient-to-b from-black/40 via-black/60 to-black/40 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-20 text-center">
            <p className="opacity-0 animate-fade-in-up text-sm font-medium text-violet-400 uppercase tracking-widest mb-4">
              What We Offer
            </p>
            <h2 className="opacity-0 animate-fade-in-up delay-100 text-3xl md:text-5xl font-medium text-white tracking-tight mb-6">
              Everything inside.
            </h2>
            <p className="opacity-0 animate-fade-in-up delay-200 text-xl text-slate-400 max-w-xl mx-auto">
              We aren't just a chat room. We provide value to every member.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1 */}
            <div className="opacity-0 animate-fade-in-up delay-100 glass-panel p-8 rounded-2xl group card-hover cursor-default">
              <div className="w-14 h-14 rounded-xl bg-violet-500/10 flex items-center justify-center mb-6 border border-violet-500/20 transition-all duration-300 group-hover:scale-110 group-hover:bg-violet-500/20 group-hover:border-violet-400/40">
                <iconify-icon
                  icon="solar:users-group-rounded-linear"
                  width="28"
                  height="28"
                  className="text-violet-400"
                ></iconify-icon>
              </div>
              <h3 className="text-xl font-medium text-white mb-3 transition-colors duration-300 group-hover:text-violet-200">
                Open Community
              </h3>
              <p className="text-base text-slate-400 leading-relaxed">
                A welcoming space for any game or genre. Find your squad or just
                hang out.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="opacity-0 animate-fade-in-up delay-200 glass-panel p-8 rounded-2xl group card-hover cursor-default">
              <div className="w-14 h-14 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-6 border border-emerald-500/20 transition-all duration-300 group-hover:scale-110 group-hover:bg-emerald-500/20 group-hover:border-emerald-400/40">
                <iconify-icon
                  icon="solar:gift-linear"
                  width="28"
                  height="28"
                  className="text-emerald-400"
                ></iconify-icon>
              </div>
              <h3 className="text-xl font-medium text-white mb-3 transition-colors duration-300 group-hover:text-emerald-200">
                Account Drops
              </h3>
              <p className="text-base text-slate-400 leading-relaxed">
                Exclusive access to premium account drops dropped regularly for
                our members.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="opacity-0 animate-fade-in-up delay-300 glass-panel p-8 rounded-2xl group card-hover cursor-default">
              <div className="w-14 h-14 rounded-xl bg-pink-500/10 flex items-center justify-center mb-6 border border-pink-500/20 transition-all duration-300 group-hover:scale-110 group-hover:bg-pink-500/20 group-hover:border-pink-400/40">
                <img
                  src={BoostLogo}
                  alt=""
                  className="h-7 w-7 transition-transform duration-300 group-hover:scale-110"
                  width="28"
                  height="28"
                  loading="lazy"
                />
              </div>
              <h3 className="text-xl font-medium text-white mb-3 transition-colors duration-300 group-hover:text-pink-200">
                Boost Rewards
              </h3>
              <p className="text-base text-slate-400 leading-relaxed">
                Boost the server to unlock high-tier perks, roles, and special
                recognition.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="opacity-0 animate-fade-in-up delay-400 glass-panel p-8 rounded-2xl group card-hover cursor-default">
              <div className="w-14 h-14 rounded-xl bg-amber-500/10 flex items-center justify-center mb-6 border border-amber-500/20 transition-all duration-300 group-hover:scale-110 group-hover:bg-amber-500/20 group-hover:border-amber-400/40">
                <iconify-icon
                  icon="solar:clapperboard-play-linear"
                  width="28"
                  height="28"
                  className="text-amber-400"
                ></iconify-icon>
              </div>
              <h3 className="text-xl font-medium text-white mb-3 transition-colors duration-300 group-hover:text-amber-200">
                Movie Nights
              </h3>
              <p className="text-base text-slate-400 leading-relaxed">
                Weekly streamed events. Grab some popcorn and relax with the
                community.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Staff Board Section */}
      <section className="relative py-32 px-6 overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[120px] animate-breathe" />
        </div>

        <div className="max-w-7xl mx-auto relative">
          {/* Section Header */}
          <div className="mb-16 text-center">
            <p className="opacity-0 animate-fade-in-up text-sm font-medium text-violet-400 uppercase tracking-widest mb-4">
              Meet Our Team
            </p>
            <h2 className="opacity-0 animate-fade-in-up delay-100 text-3xl md:text-5xl font-medium text-white tracking-tight mb-6">
              Staff Board
            </h2>
            <p className="opacity-0 animate-fade-in-up delay-200 text-xl text-slate-400 max-w-2xl mx-auto">
              The dedicated team keeping LurkedAccounts running smoothly.
            </p>
          </div>

          {/* Team Members Grid */}
          {teamMembersLoading ? (
            <div className="flex items-center justify-center py-20">
              <iconify-icon
                icon="solar:refresh-circle-linear"
                width="32"
                height="32"
                className="text-violet-400 animate-spin"
              ></iconify-icon>
            </div>
          ) : teamMembersError ? (
            <div className="text-center py-20">
              <iconify-icon
                icon="solar:danger-triangle-linear"
                width="32"
                height="32"
                className="text-rose-400 mx-auto mb-3"
              ></iconify-icon>
              <p className="text-sm text-rose-400">{teamMembersError}</p>
            </div>
          ) : !teamMembers || teamMembers.length === 0 ? (
            <div className="text-center py-20">
              <iconify-icon
                icon="solar:users-group-rounded-linear"
                width="32"
                height="32"
                className="text-slate-600 mx-auto mb-3"
              ></iconify-icon>
              <p className="text-sm text-slate-500">No team members found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {teamMembers.map((member, index) => (
                <div
                  key={member.id}
                  className="opacity-0 animate-fade-in-up glass-panel rounded-2xl group card-hover cursor-default relative overflow-hidden w-full"
                  style={{ animationDelay: `${100 + index * 50}ms` }}
                >
                  {/* Banner Background */}
                  {member.banner ? (
                    <div className="relative h-24 overflow-hidden">
                      <img
                        src={member.banner}
                        alt=""
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/90" />
                    </div>
                  ) : (
                    <div
                      className="h-24 relative overflow-hidden"
                      style={{
                        background: member.bannerColor
                          ? member.bannerColor
                          : `linear-gradient(135deg, ${member.roleColor}40 0%, ${member.roleColor}10 100%)`
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/90" />
                    </div>
                  )}

                  {/* Status indicator */}
                  <div className="absolute top-4 right-4 z-10">
                    <div className="relative">
                      <span
                        className={`w-3 h-3 rounded-full block shadow-lg ${
                          member.status === 'online'
                            ? 'bg-emerald-400'
                            : member.status === 'idle'
                            ? 'bg-amber-400'
                            : member.status === 'dnd'
                            ? 'bg-rose-400'
                            : 'bg-slate-600'
                        } ${member.status === 'online' ? 'animate-pulse' : ''}`}
                      />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="relative px-6 pb-6">
                    {/* Avatar - overlapping banner */}
                    <div className="flex justify-center -mt-10 mb-3">
                      <div className="relative">
                        <div
                          className="absolute -inset-1 rounded-full opacity-30 blur-md transition-opacity duration-300 group-hover:opacity-50"
                          style={{ backgroundColor: member.roleColor }}
                        />
                        <img
                          src={member.avatar}
                          alt={member.displayName}
                          className="relative w-20 h-20 rounded-full border-4 border-black/80 transition-all duration-300 group-hover:scale-105 group-hover:border-black/60"
                          loading="lazy"
                        />
                        <div
                          className="absolute -inset-0.5 rounded-full opacity-40 transition-opacity duration-300 group-hover:opacity-60"
                          style={{
                            boxShadow: `0 0 20px ${member.roleColor}60`
                          }}
                        />
                      </div>
                    </div>

                    {/* Name */}
                    <h3 className="text-lg font-semibold text-white mb-1 text-center transition-colors duration-300 group-hover:text-violet-200">
                      {member.displayName}
                    </h3>

                    {/* Username */}
                    <p className="text-xs text-slate-500 mb-3 text-center">
                      @{member.username}
                    </p>

                    {/* Custom Status or Activity */}
                    {(member.customStatus || member.currentActivity) && (
                      <div className="mb-3 px-2">
                        <p className="text-xs text-slate-400 text-center italic truncate">
                          {member.customStatus || `Playing ${member.currentActivity}`}
                        </p>
                      </div>
                    )}

                    {/* Role Badge */}
                    <div className="flex justify-center mb-3">
                      <div
                        className="px-3 py-1 rounded-lg text-xs font-medium border transition-all duration-200"
                        style={{
                          backgroundColor: `${member.roleColor}10`,
                          borderColor: `${member.roleColor}30`,
                          color: member.roleColor
                        }}
                      >
                        {member.teamRole}
                      </div>
                    </div>

                    {/* Join Date */}
                    {member.joinedAt && (
                      <div className="text-center pt-3 border-t border-white/5">
                        <p className="text-xs text-slate-600">
                          Joined {new Date(member.joinedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Discord CTA at bottom */}
          <div className="mt-16 text-center opacity-0 animate-fade-in-up delay-300">
            <p className="text-slate-400 mb-6">
              Want to join our community?
            </p>
            <a
              href="https://discord.gg/zTUpkK9JCx"
              target="_blank"
              rel="noopener noreferrer"
              className="group/btn inline-flex items-center gap-3 bg-[#5865F2] hover:bg-[#4752C4] text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 hover:shadow-xl hover:shadow-[#5865F2]/20 hover:scale-[1.02] active:scale-[0.98]"
            >
              <iconify-icon
                icon="ic:baseline-discord"
                width="22"
                height="22"
                className="transition-transform duration-300 group-hover/btn:scale-110"
              ></iconify-icon>
              Join Discord
              <iconify-icon
                icon="solar:arrow-right-linear"
                width="18"
                height="18"
                className="transition-transform duration-300 group-hover/btn:translate-x-1"
              ></iconify-icon>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
