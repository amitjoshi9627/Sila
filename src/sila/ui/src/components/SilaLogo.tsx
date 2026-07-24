interface SilaLogoProps {
  size?: number;
  className?: string;
}

export function SilaLogo({ size = 20, className = "" }: SilaLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="60" cy="60" r="50" strokeWidth="3" opacity="0.9" />
        <path
          d="M 38 60 C 38 42, 54 34, 72 38 C 82 40, 84 52, 74 60 C 64 68, 46 72, 46 84 C 46 94, 60 94, 76 86"
          strokeWidth="2.5"
          opacity="0.85"
        />
        <circle cx="60" cy="60" r="14" strokeWidth="1.5" strokeDasharray="3 4" opacity="0.5" />
        <circle cx="60" cy="60" r="4" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}
