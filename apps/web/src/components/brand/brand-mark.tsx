import Image from 'next/image';

/** The mark's SVGs share one view box: 148.8 by 135 units (scripts/brand/mark.mjs, D-289). */
const RATIO = 148.8 / 135;

/**
 * The logo mark, from the brand kit in public/brand. `on-dark` is for a black or dark ground (the
 * arrowhead's top face is gold there). It is decorative: the name beside it says what it is.
 */
export function BrandMark({
  variant = 'light',
  height = 40,
  className,
}: {
  variant?: 'light' | 'on-dark';
  height?: number;
  className?: string;
}) {
  return (
    <Image
      src={variant === 'on-dark' ? '/brand/mark-on-dark.svg' : '/brand/mark.svg'}
      alt=""
      width={Math.round(height * RATIO)}
      height={height}
      unoptimized
      className={className}
    />
  );
}
