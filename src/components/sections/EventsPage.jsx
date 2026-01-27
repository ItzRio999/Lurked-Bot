export default function EventsPage({
  activePage,
  events = [],
  eventsLoading = false,
  eventsError = "",
  isAdmin = false,
  onDeleteEvent = () => {}
}) {

  const colorClasses = {
    violet: {
      bg: "bg-violet-500/10",
      border: "border-violet-500/20",
      hoverBg: "group-hover:bg-violet-500/20",
      hoverBorder: "group-hover:border-violet-400/40",
      text: "text-violet-400",
      hoverText: "group-hover:text-violet-200",
      badge: "border-violet-400/30 bg-violet-500/10 text-violet-300",
    },
    amber: {
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      hoverBg: "group-hover:bg-amber-500/20",
      hoverBorder: "group-hover:border-amber-400/40",
      text: "text-amber-400",
      hoverText: "group-hover:text-amber-200",
      badge: "border-amber-400/30 bg-amber-500/10 text-amber-300",
    },
    pink: {
      bg: "bg-pink-500/10",
      border: "border-pink-500/20",
      hoverBg: "group-hover:bg-pink-500/20",
      hoverBorder: "group-hover:border-pink-400/40",
      text: "text-pink-400",
      hoverText: "group-hover:text-pink-200",
      badge: "border-pink-400/30 bg-pink-500/10 text-pink-300",
    },
    blue: {
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
      hoverBg: "group-hover:bg-blue-500/20",
      hoverBorder: "group-hover:border-blue-400/40",
      text: "text-blue-400",
      hoverText: "group-hover:text-blue-200",
      badge: "border-blue-400/30 bg-blue-500/10 text-blue-300",
    },
    emerald: {
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      hoverBg: "group-hover:bg-emerald-500/20",
      hoverBorder: "group-hover:border-emerald-400/40",
      text: "text-emerald-400",
      hoverText: "group-hover:text-emerald-200",
      badge: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
    },
  };

  return (
    <section
      className="page relative z-10 py-28"
      data-page="events"
      hidden={activePage !== "events"}
    >
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="opacity-0 animate-fade-in-up mb-14">
          <p className="text-sm font-medium text-violet-400 uppercase tracking-widest mb-3">
            What's Happening
          </p>
          <h2 className="text-3xl md:text-4xl font-medium text-white tracking-tight mb-4">
            Events Lineup
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl">
            Tournaments, movie nights, and collabs happen every week.
          </p>
        </div>

        {/* Loading State */}
        {eventsLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin"></div>
              <p className="text-slate-400">Loading events...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {eventsError && !eventsLoading && (
          <div className="opacity-0 animate-fade-in-up delay-100 glass-panel p-8 rounded-2xl text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <iconify-icon
                icon="solar:danger-circle-linear"
                width="32"
                height="32"
                className="text-red-400"
              ></iconify-icon>
            </div>
            <h3 className="text-xl font-medium text-white mb-2">
              Unable to Load Events
            </h3>
            <p className="text-slate-400">{eventsError}</p>
          </div>
        )}

        {/* Empty State */}
        {!eventsLoading && !eventsError && events.length === 0 && (
          <div className="opacity-0 animate-fade-in-up delay-100 glass-panel p-12 rounded-2xl text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <iconify-icon
                icon="solar:calendar-linear"
                width="32"
                height="32"
                className="text-violet-400"
              ></iconify-icon>
            </div>
            <h3 className="text-xl font-medium text-white mb-2">
              No Events Scheduled
            </h3>
            <p className="text-slate-400">
              Check back soon or join Discord to suggest events!
            </p>
          </div>
        )}

        {/* Events Grid */}
        {!eventsLoading && !eventsError && events.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {events.map((event, index) => {
              const colors = colorClasses[event.color] || colorClasses.violet;
              const delay = (index % 3) * 100 + 100; // Stagger animation delays
              return (
                <div
                  key={event.id}
                  className={`opacity-0 animate-fade-in-up delay-${delay} glass-panel p-8 rounded-2xl group card-hover cursor-default`}
                >
                  <div className="flex items-center justify-between mb-6">
                    <div
                      className={`w-12 h-12 rounded-xl ${colors.bg} flex items-center justify-center border ${colors.border} transition-all duration-300 group-hover:scale-110 ${colors.hoverBg} ${colors.hoverBorder}`}
                    >
                      <iconify-icon
                        icon={event.icon}
                        width="24"
                        height="24"
                        className={colors.text}
                      ></iconify-icon>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAdmin && event.status === 'scheduled' && (
                        <button
                          type="button"
                          onClick={() => onDeleteEvent(event.id, event.title)}
                          className="opacity-0 group-hover:opacity-100 rounded-lg p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all duration-200"
                          title="Delete event"
                        >
                          <iconify-icon
                            icon="solar:trash-bin-trash-linear"
                            width="16"
                            height="16"
                          ></iconify-icon>
                        </button>
                      )}
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${colors.badge}`}
                      >
                        <iconify-icon
                          icon="solar:calendar-linear"
                          width="12"
                          height="12"
                        ></iconify-icon>
                        {event.dateFormatted || event.date}
                      </span>
                    </div>
                  </div>
                  <h3
                    className={`text-xl font-medium text-white mb-3 transition-colors duration-300 ${colors.hoverText}`}
                  >
                    {event.title}
                  </h3>
                  <p className="text-base text-slate-400 leading-relaxed">
                    {event.description}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom notice */}
        <div className="opacity-0 animate-fade-in-up delay-500 mt-10 text-center">
          <div className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white/[0.02] border border-white/5 text-sm text-slate-500">
            <iconify-icon
              icon="solar:bell-linear"
              width="16"
              height="16"
            ></iconify-icon>
            <span>Join our Discord for event announcements and reminders</span>
          </div>
        </div>
      </div>
    </section>
  );
}
