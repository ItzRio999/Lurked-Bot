const navItems = ["home", "community", "forums", "rewards", "events", "admin"];

const adminEmails = ["lilbluedevil07@gmail.com"];

const pageLabels = {
  home: "Home",
  community: "Drops",
  forums: "Forums",
  rewards: "Rewards",
  events: "Events",
  admin: "Admin",
};

const forumCategories = [
  {
    label: "General",
    tone: "violet",
    icon: "solar:chat-round-line-linear",
  },
  {
    label: "Tech Support",
    tone: "blue",
    icon: "solar:chat-round-line-linear",
  },
  {
    label: "Events",
    tone: "amber",
    icon: "solar:calendar-mark-linear",
  },
  {
    label: "Marketplace",
    tone: "emerald",
    icon: "solar:cart-large-2-linear",
  },
  {
    label: "Crack",
    tone: "pink",
    icon: "solar:gamepad-linear",
  },
];

const forumToneStyles = {
  violet: {
    badge: "bg-violet-500/10 text-violet-400 border border-violet-500/20",
    icon: "bg-violet-500/10 text-violet-400 border border-violet-500/20",
  },
  blue: {
    badge: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    icon: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  },
  amber: {
    badge: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    icon: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  },
  emerald: {
    badge: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    icon: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  },
  pink: {
    badge: "bg-pink-500/10 text-pink-400 border border-pink-500/20",
    icon: "bg-pink-500/10 text-pink-400 border border-pink-500/20",
  },
  slate: {
    badge: "bg-slate-500/10 text-slate-400 border border-slate-500/20",
    icon: "bg-slate-500/10 text-slate-400 border border-slate-500/20",
  },
};

export { adminEmails, forumCategories, forumToneStyles, navItems, pageLabels };
