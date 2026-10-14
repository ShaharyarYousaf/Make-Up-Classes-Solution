import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';

export interface ComboboxOption {
  value: string;
  /** Main text, e.g. "CS2001 – Data Structures" */
  label: string;
  /** Smaller second line, e.g. the teacher */
  detail?: string;
  /** Extra words that should match a search but are not shown (e.g. teachers, sections) */
  keywords?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
  /** Classes for the input box so each place keeps its own look */
  inputClassName?: string;
  className?: string;
}

/** Longer lists are cut here; typing narrows them */
const MAX_RESULTS = 150;

function rank(option: ComboboxOption, query: string): number {
  const label = option.label.toLowerCase();
  if (label.startsWith(query) || option.value.toLowerCase().startsWith(query)) return 0;
  if (label.split(/[\s–\-/(]+/).some((word) => word.startsWith(query))) return 1;
  if (label.includes(query)) return 2;
  if (option.detail?.toLowerCase().includes(query) || option.keywords?.toLowerCase().includes(query)) return 3;
  return -1;
}

function Highlight({ text, query }: { text: string; query: string }) {
  const index = query ? text.toLowerCase().indexOf(query) : -1;
  if (index === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-yellow-200 dark:bg-yellow-700/60 text-inherit rounded-sm">{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  );
}

/** A dropdown you can type into: filters as you type, arrow keys + Enter to pick, Esc to close. */
export const Combobox: React.FC<ComboboxProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Type to search…',
  ariaLabel,
  inputClassName = '',
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const [position, setPosition] = useState<React.CSSProperties>({});

  const selected = options.find((o) => o.value === value);
  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!q) return options.slice(0, MAX_RESULTS);
    return options
      .map((option, order) => ({ option, score: rank(option, q), order }))
      .filter((r) => r.score >= 0)
      .sort((a, b) => a.score - b.score || a.order - b.order)
      .slice(0, MAX_RESULTS)
      .map((r) => r.option);
  }, [options, q]);

  // The list is drawn on top of the page (banners and modals clip overflow), anchored under the box;
  // it opens upwards when there is no room below
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = inputRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(Math.max(rect.width, 256), window.innerWidth - 16);
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      const below = window.innerHeight - rect.bottom;
      const maxHeight = Math.min(288, Math.max(below, rect.top) - 12);
      setPosition(
        below >= 200 || below >= rect.top
          ? { top: rect.bottom + 4, left, width, maxHeight }
          : { bottom: window.innerHeight - rect.top + 4, left, width, maxHeight }
      );
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  // Close when clicking anywhere else
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!rootRef.current?.contains(target) && !listRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Keep the highlighted row visible while arrowing through the list
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const openList = () => {
    setQuery('');
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  const pick = (option: ComboboxOption) => {
    onChange(option.value);
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      e.preventDefault();
      openList();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[active]) pick(results[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder={open ? placeholder : selected ? undefined : placeholder}
        value={open ? query : selected?.label || ''}
        onFocus={openList}
        onClick={() => !open && openList()}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className={`w-full pr-12 truncate ${inputClassName}`}
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-gray-400">
        {open && query && (
          <button
            type="button"
            aria-label="Clear search"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery('');
              setActive(0);
              inputRef.current?.focus();
            }}
            className="p-0.5 rounded hover:text-gray-700 dark:hover:text-gray-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <ChevronDown className={`w-3.5 h-3.5 pointer-events-none transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && typeof document !== 'undefined' && createPortal(
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          style={{ position: 'fixed', ...position }}
          className="z-[100] overflow-y-auto rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl py-1 text-left"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-xs text-gray-500">No match for “{query}”</li>
          ) : (
            results.map((option, i) => (
              <li
                key={option.value}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={option.value === value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(option)}
                onMouseEnter={() => setActive(i)}
                className={`px-3 py-1.5 cursor-pointer text-xs ${
                  i === active ? 'bg-blue-50 dark:bg-blue-950/60' : ''
                } ${option.value === value ? 'font-bold text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-200'}`}
              >
                <div className="truncate">
                  <Highlight text={option.label} query={q} />
                </div>
                {option.detail && (
                  <div className="truncate text-[10px] text-gray-500 dark:text-gray-400 font-normal">
                    <Highlight text={option.detail} query={q} />
                  </div>
                )}
              </li>
            ))
          )}
          {results.length === MAX_RESULTS && (
            <li className="px-3 py-1.5 text-[10px] text-gray-400">Showing the first {MAX_RESULTS} – type to narrow down</li>
          )}
        </ul>,
        document.body
      )}
    </div>
  );
};
