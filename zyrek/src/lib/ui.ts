import type { AppStatus } from './storage'

export const cardClass =
  'rounded-xl border border-[#d8d1bf] bg-[#faf7f0] shadow-[0_1px_2px_rgba(40,35,25,0.06),0_8px_24px_rgba(40,35,25,0.06)]'

export const microLabel =
  'font-mono text-[11px] uppercase tracking-[0.18em] text-[#8a8371]'

export const STATUS_STYLES: Record<AppStatus, { pill: string; dot: string }> = {
  SAVED: {
    pill: 'bg-[#efe9d9] text-[#6f6858] border-[#ddd6c4]',
    dot: 'bg-[#a39b86]',
  },
  APPLIED: {
    pill: 'bg-[#e6e2d3] text-[#26221b] border-[#cfc7b2]',
    dot: 'bg-[#26221b]',
  },
  INTERVIEW: {
    pill: 'bg-[#f3e8d3] text-[#8a5a1d] border-[#e0c795]',
    dot: 'bg-[#c9962e]',
  },
  OFFER: {
    pill: 'bg-[#e3ecda] text-[#3d5a2e] border-[#b9cba6]',
    dot: 'bg-[#5a8a3e]',
  },
  REJECTED: {
    pill: 'bg-[#f3ddd3] text-[#9c3d1e] border-[#e3b39d]',
    dot: 'bg-[#b3492b]',
  },
}
