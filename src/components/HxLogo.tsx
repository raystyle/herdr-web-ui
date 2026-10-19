// [v3 F0] 皓玄 LOGO(自 V2 HxLogo.vue 原样移植,React 形;静态 id 加
// hx- 前缀防与挂载侧 uid 化 defs 相撞)。乐高·玄穹夜砖·硬线条。
export function HxLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" role="img" aria-label="HaoXuan" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hx-brick" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#263566" /><stop offset="0.3" stopColor="#1b2649" /><stop offset="1" stopColor="#0c1228" />
        </linearGradient>
        <linearGradient id="hx-stud" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#33477e" /><stop offset="1" stopColor="#1a2450" />
        </linearGradient>
        <radialGradient id="hx-moon" cx="0.4" cy="0.35" r="0.9">
          <stop offset="0" stopColor="#ffffff" /><stop offset="0.55" stopColor="#eef3ff" /><stop offset="1" stopColor="#c6d4ef" />
        </radialGradient>
        <radialGradient id="hx-halo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#dbe6ff" stopOpacity="0.55" />
          <stop offset="0.6" stopColor="#dbe6ff" stopOpacity="0.18" />
          <stop offset="1" stopColor="#dbe6ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hx-star" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe9a3" /><stop offset="0.5" stopColor="#ffd76a" /><stop offset="1" stopColor="#f0b90e" />
        </linearGradient>
        <mask id="hx-bite"><rect width="128" height="128" fill="#ffffff" /><circle cx="84" cy="52" r="26" fill="#000000" /></mask>
      </defs>
      <g>
        <rect x="26" y="12" width="28" height="26" fill="url(#hx-stud)" />
        <rect x="26" y="12" width="28" height="3" fill="#4c62a8" />
        <rect x="74" y="12" width="28" height="26" fill="url(#hx-stud)" />
        <rect x="74" y="12" width="28" height="3" fill="#4c62a8" />
      </g>
      <rect x="10" y="34" width="108" height="84" fill="url(#hx-brick)" />
      <rect x="10" y="34" width="108" height="3" fill="#c9d8ff" fillOpacity="0.2" />
      <rect x="10" y="34" width="3" height="84" fill="#c9d8ff" fillOpacity="0.1" />
      <rect x="115" y="34" width="3" height="84" fill="#04060f" fillOpacity="0.5" />
      <circle cx="56" cy="74" r="44" fill="url(#hx-halo)" />
      <g mask="url(#hx-bite)">
        <circle cx="56" cy="74" r="28" fill="url(#hx-moon)" />
        <path d="M 32 61 A 28 28 0 0 1 55 46" fill="none" stroke="#ffffff" strokeOpacity="0.65" strokeWidth="3" strokeLinecap="butt" />
      </g>
      <path d="M95 54l4 9.9L109 68l-10 4.1L95 82l-4-9.9L81 68l10-4.1z" fill="url(#hx-star)" />
      <path d="M95 54l4 9.9L109 68" fill="none" stroke="#fff3c9" strokeOpacity="0.6" strokeWidth="1.5" />
      <rect x="29" y="93" width="3" height="3" fill="#aebde6" fillOpacity="0.8" />
      <rect x="43" y="107" width="2.4" height="2.4" fill="#aebde6" fillOpacity="0.55" />
      <rect x="97" y="101" width="2.8" height="2.8" fill="#aebde6" fillOpacity="0.65" />
      <path d="M 22 112 L 46 112" stroke="#8fa4d8" strokeOpacity="0.25" strokeWidth="2" />
    </svg>
  )
}
