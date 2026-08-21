export function Avatar({ emoji, size = 44, className = '' }: { emoji: string; size?: number; className?: string }) {
  return <span className={`avatar ${className}`} style={{ width: size, height: size, fontSize: Math.round(size * .52) }} role="img" aria-label={`Profile emoji ${emoji}`}>{emoji}</span>
}
