import { cn } from '@/lib/utils';

interface EnoxLogoProps {
  className?: string;
  iconClassName?: string;
}

export function EnoxLogo({ className, iconClassName }: EnoxLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      className={cn('text-current', className)}
      fill="none"
    >
      <path
        fill="currentColor"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
        d="M38 30H10a6 6 0 0 0 0 12h28a6 6 0 0 0 0-12m-2-8a8 8 0 1 0 0-16a8 8 0 0 0 0 16M4 14l9-9l9 9l-9 9z"
        className={iconClassName}
      />
    </svg>
  );
}
