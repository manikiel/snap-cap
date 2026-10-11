import {
  useEffect,
  useRef,
  useId,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";
import { X, ChevronLeft, Search } from "lucide-react";
import { useApp } from "../hooks/app";
import { Avatar } from "./Avatar";
export function IconButton({
  label,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="icon-button"
      {...props}
    >
      {children}
    </button>
  );
}
export function Header({
  title,
  children,
  back = true,
}: {
  title: string;
  children?: ReactNode;
  back?: boolean;
}) {
  const { back: goBack, data, open } = useApp();
  return (
    <header className="header">
      {back ? (
        <IconButton label="Back" onClick={goBack}>
          <ChevronLeft />
        </IconButton>
      ) : (
        <button
          className="avatar-button"
          aria-label="My profile"
          onClick={() => open({ name: "profile" })}
        >
          <Avatar spec={data.account?.avatar} />
        </button>
      )}
      <h1>{title}</h1>
      <div className="header-actions">{children}</div>
    </header>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder = "Search",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="search-box">
      <Search size={19} />
      <input
        type="search"
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
export function Sheet({
  title,
  children,
  onClose,
  full = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  full?: boolean;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const start = useRef(0);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`sheet ${full ? "full-sheet" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="sheet-body">
        <header
          className="sheet-head"
          onTouchStart={(e) => {
            start.current = e.touches[0].clientY;
          }}
          onTouchEnd={(e) => {
            if (e.changedTouches[0].clientY - start.current > 65) onClose();
          }}
        >
          <span className="sheet-handle" />
          <h2 id={titleId}>{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <X />
          </IconButton>
        </header>
        <div className="sheet-content">{children}</div>
      </div>
    </dialog>
  );
}
export function Confirm({
  title,
  text,
  onConfirm,
  onClose,
  danger = true,
}: {
  title: string;
  text: string;
  onConfirm: () => void;
  onClose: () => void;
  danger?: boolean;
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="muted">{text}</p>
      <div className="button-stack">
        <button
          className={danger ? "danger-button" : "primary"}
          onClick={onConfirm}
        >
          {title}
        </button>
        <button className="secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Sheet>
  );
}
export function Empty({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
export const timeAgo = (time: number) => {
  const diff = Math.max(0, Date.now() - time);
  return diff < 60000
    ? "Now"
    : diff < 3600000
      ? `${Math.floor(diff / 60000)}m`
      : diff < 86400000
        ? `${Math.floor(diff / 3600000)}h`
        : diff < 604800000
          ? `${Math.floor(diff / 86400000)}d`
          : new Date(time).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            });
};
export function Ghost({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <path
        d="M50 12c-17 0-25 12-25 28 0 4 1 9 1 13-3 1-6-3-9-1-4 3 1 7 8 9-3 11-10 14-16 16-3 2 0 5 7 5 2 0 3 4 6 4 4 0 7-2 10-1 5 1 9 6 18 6s13-5 18-6c3-1 6 1 10 1 3 0 4-4 6-4 7 0 10-3 7-5-6-2-13-5-16-16 7-2 12-6 8-9-3-2-6 2-9 1 0-4 1-9 1-13 0-16-8-28-25-28Z"
        fill="white"
        stroke="black"
        strokeWidth="4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
