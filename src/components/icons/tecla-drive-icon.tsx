import type { SVGProps } from "react";

export function TeclaDriveIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4.2 16.8a8 8 0 1 1 15.6 0" />
      <path d="M12 13.2 16.3 8.8" />
      <circle cx="12" cy="13.2" r="1.25" fill="currentColor" stroke="none" />
      <path d="M7.2 19.2h9.6" opacity=".65" />
      <path d="M4.1 16.8h1.6M18.3 16.8h1.6" opacity=".55" />
    </svg>
  );
}
