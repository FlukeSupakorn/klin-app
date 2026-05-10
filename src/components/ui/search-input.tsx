import { forwardRef } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  focused?: boolean;
  containerClassName?: string;
}

/**
 * Shared search input used across the app. Owns the visual chrome only —
 * filtering / fetching logic stays at the call site.
 *
 * The container is `flex` so callers control width via `containerClassName`
 * (e.g. `w-[240px]`, `flex-1 max-w-[420px]`).
 *
 * Pass `focused` to force the focus ring (useful when an open dropdown is
 * driving the highlight independently of native focus).
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput(
    {
      value,
      onChange,
      onClear,
      focused,
      containerClassName,
      className,
      placeholder = "Search...",
      ...rest
    },
    ref,
  ) {
    return (
      <div
        className={cn(
          "flex h-9 items-center gap-2 overflow-hidden rounded-[12px] border bg-card px-3 transition-all",
          "focus-within:border-primary",
          containerClassName,
        )}
        style={{
          borderColor: focused ? "var(--primary)" : "var(--border)",
          boxShadow: focused ? "0 0 0 3px var(--primary-soft)" : "var(--shadow-xs)",
        }}
      >
        <Search
          className="h-3.5 w-3.5 shrink-0 transition-colors"
          style={{ color: focused ? "var(--primary)" : "var(--muted-foreground)" }}
        />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={cn(
            "h-full flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none",
            className,
          )}
          {...rest}
        />
        {onClear && value.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear search"
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        )}
      </div>
    );
  },
);
