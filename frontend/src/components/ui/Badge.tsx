interface BadgeProps {
  label: string
  variant?: 'success' | 'danger' | 'warning' | 'info' | 'neutral'
}

export default function Badge({ label, variant = 'info' }: BadgeProps) {
  return <span className={`badge badge-${variant}`}>{label}</span>
}
