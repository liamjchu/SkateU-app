// Yearbook paper, strawberry rose. Light mode.
// Keep in sync with @theme tokens in global.css.
export const colors = {
  brand: '#2A2224',
  brandDark: '#1C1718',
  accent: '#E67A90',
  accentDark: '#CF5E78',
  ink: '#2A2224',
  inkDark: '#1C1718',
  muted: '#6E6568',
  mutedSoft: '#AFA8AB',
  mutedStrong: '#4E474A',
  surface: '#F7F4F0',
  surfaceSoft: '#EEEAE6',
  surfaceTinted: '#FBFAF7',
  field: '#FFFFFF',
  borderSoft: '#DDD6D1',
  errorText: '#A63B32',
  errorSurface: '#F4E6E3',
  errorBorder: '#E0C4BE',
  actionDisabled: '#D9D3CF',
  white: '#FFFFFF',
} as const;

export function svgHex(hex: string): string {
  return hex.replace('#', '%23');
}
