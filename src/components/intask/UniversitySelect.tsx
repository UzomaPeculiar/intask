import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { NIGERIAN_UNIVERSITIES } from "@/lib/constants";
import { ChevronDown, Check, Search } from "lucide-react";

interface UniversitySelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function UniversitySelect({
  value,
  onChange,
  placeholder = "Search for your university...",
}: UniversitySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [customValue, setCustomValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isOther = value === "Other" || (value !== "" && !NIGERIAN_UNIVERSITIES.includes(value));
  const displayValue = isOther ? value : value;

  // Filter universities based on search query
  const filtered = query.trim()
    ? NIGERIAN_UNIVERSITIES.filter((u) =>
        u.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : NIGERIAN_UNIVERSITIES.slice(0, 8);

  const handleSelect = useCallback(
    (uni: string) => {
      onChange(uni);
      setQuery("");
      setOpen(false);
    },
    [onChange]
  );

  const handleOtherSelect = useCallback(() => {
    onChange("Other");
    setQuery("");
    setCustomValue("");
    // Focus the custom input after render
    setTimeout(() => {
      const customInput = containerRef.current?.querySelector<HTMLInputElement>(
        'input[placeholder="Type your university name"]'
      );
      customInput?.focus();
    }, 50);
  }, [onChange]);

  const handleCustomChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setCustomValue(e.target.value);
      onChange(e.target.value);
    },
    [onChange]
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Scroll selected item into view
  useEffect(() => {
    if (open && listRef.current) {
      const selected = listRef.current.querySelector("[data-selected]");
      selected?.scrollIntoView({ block: "nearest" });
    }
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      {/* Main input / trigger */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={open ? query : displayValue}
          onChange={(e) => {
            if (!open) setOpen(true);
            setQuery(e.target.value);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          placeholder={open ? "Type to search..." : placeholder}
          className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-8 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            setQuery("");
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">
          <div ref={listRef} className="max-h-60 overflow-y-auto p-1">
            {filtered.length > 0 ? (
              filtered.map((uni) => {
                const isSelected = value === uni;
                return (
                  <button
                    key={uni}
                    data-selected={isSelected ? "" : undefined}
                    type="button"
                    onClick={() => handleSelect(uni)}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground hover:bg-accent"
                    }`}
                  >
                    <span className="flex-1 truncate">{uni}</span>
                    {isSelected && <Check className="size-3.5 shrink-0" />}
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-2 text-sm text-muted-foreground">No matches found</p>
            )}

            {/* Other option */}
            <div className="my-1 border-t border-border" />
            <button
              type="button"
              onClick={handleOtherSelect}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                isOther ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <span className="flex-1">Other (type your own)</span>
              {isOther && <Check className="size-3.5 shrink-0" />}
            </button>
          </div>
        </div>
      )}

      {/* Custom input when "Other" is selected and dropdown is closed */}
      {isOther && !open && (
        <Input
          value={customValue || value}
          onChange={handleCustomChange}
          placeholder="Type your university name"
          className="mt-2"
        />
      )}
    </div>
  );
}
