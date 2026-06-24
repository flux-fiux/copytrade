"use client";

import { useEffect, useState } from "react";

const LOCALES = [
  { code: "en", label: "EN" },
  { code: "zh-CN", label: "中文" },
  { code: "ja", label: "日本語" },
  { code: "es", label: "ES" },
];

export function LocaleSwitcher() {
  const [current, setCurrent] = useState("en");

  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)locale=([^;]+)/);
    if (match) setCurrent(match[1]);
  }, []);

  function switchLocale(code: string) {
    document.cookie = `locale=${code};path=/;max-age=31536000`;
    setCurrent(code);
    window.location.reload();
  }

  return (
    <div className="flex items-center gap-0.5">
      {LOCALES.map((l) => (
        <button
          key={l.code}
          onClick={() => switchLocale(l.code)}
          className={`px-2 py-1 text-xs rounded font-medium transition-colors
            ${current === l.code
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground"
            }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
