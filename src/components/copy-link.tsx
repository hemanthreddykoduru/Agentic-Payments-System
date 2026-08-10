"use client";

import { useState } from "react";

/** Builds the absolute URL in the browser so it works on localhost and in prod
 *  without a configured base URL. */
export function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-center gap-2 rounded border border-line bg-card px-3 py-2">
      <code className="ui flex-1 truncate text-[12px]">{path}</code>
      <button
        onClick={() => {
          navigator.clipboard.writeText(window.location.origin + path);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }}
        className="ui shrink-0 cursor-pointer text-[11px] text-muted transition-colors hover:text-accent-deep"
      >
        {copied ? "copied ✓" : "copy"}
      </button>
    </div>
  );
}
