import { Laptop } from 'lucide-react'

export function MobileNotice() {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-dialog-title"
      className="mobile-notice-screen fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white p-6 select-none"
      style={{ backgroundColor: '#ffffff', color: '#151515' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-[#ecedee] bg-white p-7 text-center shadow-lift animate-fade-slide-in"
        style={{ backgroundColor: '#ffffff', color: '#151515' }}
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f7f7f8] text-[#17181b]">
          <Laptop size={28} strokeWidth={1.75} />
        </div>

        <h1
          id="mobile-dialog-title"
          className="text-lg font-semibold tracking-tight text-[#17181b]"
        >
          Mobile version is still being developed.
        </h1>

        <p className="mt-2 text-sm leading-relaxed text-[#62656c]">
          Pen is designed for desktop and laptop screens. Please open on a computer for the full screenplay studio experience.
        </p>
      </div>
    </div>
  )
}
