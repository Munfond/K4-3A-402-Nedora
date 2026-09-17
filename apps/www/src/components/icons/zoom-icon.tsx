import type { SVGProps } from "react";

export function ZoomIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="graphics-symbol"
      {...props}
    >
      <path
        d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.568 14.29a1.026 1.026 0 01-1.027 1.027H7.46A1.026 1.026 0 016.432 14.29v-4.58A1.026 1.026 0 017.459 8.683h9.08a1.026 1.026 0 011.027 1.027v4.58z"
        fill="#2D8CFF"
      />
      <path
        d="M15.513 10.747h-2.054v2.506h2.054a.684.684 0 00.684-.684v-1.138a.684.684 0 00-.684-.684z"
        fill="white"
      />
    </svg>
  );
}
