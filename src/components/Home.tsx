import { useApp } from '../store/useApp'
import { cn } from './ui'
import bgUrl from '../assets/bg.webp'
import logoUrl from '../assets/logo.svg'

/* ---------- Letters-style primitives (pill CTA, pill tag) ---------- */

function PrimaryPill({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-full bg-obsidian px-6 py-3 font-display text-sm font-medium tracking-[-0.01em] text-white shadow-subtle-soft transition-transform hover:-translate-y-px',
        className,
      )}
    >
      {children}
    </button>
  )
}

/* ---------- Homepage ---------- */

export function Home() {
  const openDashboard = useApp((s) => s.openDashboard)

  return (
    <div className="flex h-screen flex-col bg-paper-white font-display text-obsidian">
      <div className="flex min-h-0 flex-1 flex-col bg-paper-white p-[14px]">
      {/* Hero */}
      <section
        className="flex flex-1 flex-col rounded-[14px] bg-cover bg-center max-sm:bg-[position:31%_center] px-6 pb-10 pt-5 text-center text-white"
        style={{ backgroundImage: `url(${bgUrl})`, backgroundColor: '#779bc1' }}
      >
        {/* Top navigation — inside the hero */}
        <header className="mx-auto max-w-[1200px] px-2 sm:px-4">
          <div className="flex h-[68px] items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex shrink-0 items-center"
              title="Ezuth"
            >
              <img src={logoUrl} alt="Ezuth" className="h-15 w-auto" />
            </button>
          </div>
        </header>
        <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col items-center justify-center max-sm:pb-24">
          <h1 className="mx-auto max-w-3xl text-[44px] font-semibold leading-[0.95] tracking-[-0.04em] sm:text-display sm:leading-[0.9]">
            Write scripts
            <br />
            at shoot speed.
          </h1>
          <p className="mx-auto mt-5 max-sm:mt-3 max-w-[480px] text-body-lg font-normal leading-[1.49] tracking-[-0.01em] text-white/90">
            You write the story.
            <br className="sm:hidden" /> Ezuth handles the formatting.
          </p>
          <div className="mt-8 max-sm:mt-5 flex flex-wrap items-center justify-center gap-3">
            <PrimaryPill onClick={() => openDashboard()}>Start writing for free</PrimaryPill>
          </div>
        </div>
      </section>
      </div>

      <footer>
        <div className="mx-auto flex max-w-[1200px] items-center justify-center px-6 py-[28px]">
          <p className="text-center text-xs text-slate-gray">
            Made with ❤️ by sagarmanohar
          </p>
        </div>
      </footer>
    </div>
  )
}
