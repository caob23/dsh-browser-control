// Simple whale + monitor SVG icon for the status page. Matches the design
// language of the Chrome extension icon (blue circle, white whale).
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="32" height="32">
<circle cx="64" cy="64" r="64" fill="#0a2463"/>
<g fill="#fff">
  <!-- monitor -->
  <rect x="18" y="30" width="32" height="24" rx="3"/>
  <rect x="30" y="54" width="8" height="6"/>
  <rect x="22" y="60" width="24" height="3" rx="1.5"/>
  <!-- whale body -->
  <ellipse cx="74" cy="68" rx="28" ry="22"/>
  <!-- whale tail -->
  <path d="M96 56 C104 46, 116 44, 112 54 C118 46, 120 50, 110 60 Z"/>
  <!-- whale eye -->
  <circle cx="62" cy="62" r="3" fill="#0a2463"/>
  <!-- whale belly lines -->
  <line x1="60" y1="72" x2="86" y2="72" stroke="#0a2463" stroke-width="1.5"/>
  <line x1="62" y1="77" x2="84" y2="77" stroke="#0a2463" stroke-width="1.5"/>
  <line x1="64" y1="82" x2="82" y2="82" stroke="#0a2463" stroke-width="1.5"/>
  <!-- whale flipper -->
  <path d="M58 78 Q52 88, 46 84 Q50 76, 58 78Z"/>
</g>
</svg>`;

export { ICON_SVG };
