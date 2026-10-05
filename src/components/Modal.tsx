import { useEffect, useRef, type ReactNode } from "react";

interface Props { open: boolean; onClose: () => void; label: string; variant?: "drawer" | "center"; children: ReactNode }

/** Native <dialog>: built-in focus trap, Esc to close, inert background. */
export default function Modal({ open, onClose, label, variant = "drawer", children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const pos = variant === "drawer"
    ? "drawer fixed right-0 top-0 m-0 h-dvh w-full max-w-lg"
    : "drawer m-auto w-[calc(100%-2rem)] max-w-xl rounded-lg";
  return (
    <dialog ref={ref} aria-label={label} className={`${pos} bg-white shadow-xl`} onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      {open && <div className="flex max-h-dvh flex-col overflow-y-auto p-6 sm:p-8">
        <button type="button" onClick={onClose} aria-label="Close" className="btn btn-ghost-light mb-6 self-end !min-h-[44px] !px-4">Close</button>
        {children}
      </div>}
    </dialog>
  );
}
