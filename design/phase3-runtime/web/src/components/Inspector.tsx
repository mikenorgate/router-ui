import { useEffect, useId, useRef, type ReactNode } from 'react';
export function Inspector({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef(document.activeElement as HTMLElement | null);
  const titleId = useId();
  useEffect(() => {
    const trigger = triggerRef.current;
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { dialog?.close(); if (trigger?.isConnected) trigger.focus(); };
  }, []);
  return <dialog ref={ref} className="inspector-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }} data-od-id="inspector"><div className="inspector-top"><h2 id={titleId}>{title}</h2><button className="btn" autoFocus onClick={onClose}>Close ×</button></div>{children}</dialog>;
}
