import type { SVGProps } from "react";

/** Silueta propia de un sedán eléctrico con rayo, para el acceso «Mi Tesla». */
export function TeslaCarIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M3.5 14.5 5 10.3c.3-.8 1-1.3 1.9-1.3h8.6c.6 0 1.2.3 1.6.8l2.6 3.2a2 2 0 0 1 .4 1.2V16a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1z" />
      <circle cx="7.5" cy="17" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="17" r="1.6" fill="currentColor" stroke="none" />
      <path d="M12.6 10.2 11 13h2l-1.6 2.8" opacity=".9" />
    </svg>
  );
}
