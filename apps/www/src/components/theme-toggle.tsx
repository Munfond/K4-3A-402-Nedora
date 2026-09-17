"use client";
import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const nut = [
  { value: "system", nhan: "Theo hệ thống", Icon: Laptop },
  { value: "light", nhan: "Nền sáng", Icon: Sun },
  { value: "dark", nhan: "Nền tối", Icon: Moon },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // Server không biết theme của người xem, nên chỉ tô nút đang chọn sau khi
  // đã mount — nếu không, HTML của server và client lệch nhau.
  const [daMount, setDaMount] = useState(false);

  useEffect(() => setDaMount(true), []);

  return (
    <div className="flex items-center gap-1">
      {nut.map(({ value, nhan, Icon }) => (
        <button
          key={value}
          type="button"
          aria-label={nhan}
          onClick={() => setTheme(value)}
          className={`rounded-full p-1.5 transition-colors ${
            daMount && theme === value
              ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100"
              : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          }`}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
