export default function Footer({ LurkedLogo, DiscordLogo }) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-white/5 bg-black/80 backdrop-blur-sm py-12 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          {/* Left side - Logo and copyright */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-3">
              <img
                src={LurkedLogo}
                alt="LurkedAccounts"
                className="h-8 w-auto grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
                height="32"
                loading="lazy"
              />
              <span className="text-white/80 text-sm font-medium hidden sm:inline">
                LurkedAccounts
              </span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-white/10" />
            <span className="text-slate-500 text-sm">
              {currentYear} All rights reserved.
            </span>
          </div>

          {/* Right side - Social links */}
          <div className="flex items-center gap-2">
            <a
              href="https://discord.gg/zTUpkK9JCx"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-10 h-10 rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:border-[#5865F2]/40 hover:bg-[#5865F2]/10 transition-all duration-200"
              aria-label="Discord"
            >
              <img
                src={DiscordLogo}
                alt=""
                className="h-[18px] w-[18px] opacity-60 hover:opacity-100 transition-opacity"
                width="18"
                height="18"
                loading="lazy"
              />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
