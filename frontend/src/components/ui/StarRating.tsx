interface StarRatingProps {
  value: number;
  onChange?: (rating: number) => void;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = { sm: 16, md: 22, lg: 30 };

export default function StarRating({ value, onChange, size = 'md' }: StarRatingProps) {
  const px = sizeMap[size];
  const interactive = !!onChange;

  return (
    <div style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(value);
        return (
          <svg
            key={star}
            width={px}
            height={px}
            viewBox="0 0 24 24"
            fill={filled ? '#f59e0b' : 'none'}
            stroke={filled ? '#f59e0b' : '#d1d5db'}
            strokeWidth={1.8}
            style={{
              cursor: interactive ? 'pointer' : 'default',
              transition: 'transform 0.15s, fill 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (interactive) (e.currentTarget as SVGElement).style.transform = 'scale(1.2)';
            }}
            onMouseLeave={(e) => {
              if (interactive) (e.currentTarget as SVGElement).style.transform = 'scale(1)';
            }}
            onClick={() => interactive && onChange(star)}
            aria-label={`${star} sao`}
            role={interactive ? 'button' : undefined}
          >
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
          </svg>
        );
      })}
      {value > 0 && size !== 'sm' && (
        <span style={{ fontSize: px * 0.6, color: '#6b7280', marginLeft: 4 }}>
          {Number(value).toFixed(1)}
        </span>
      )}
    </div>
  );
}
