"use client";

interface StatusScreenProps {
  icon?: React.ReactNode;
  title: string;
  sub?: string;
  action?: React.ReactNode;
}

/** Centered status screen used for loading, gone, and access-error states. */
export function StatusScreen({ icon, title, sub, action }: StatusScreenProps) {
  return (
    <div className="status-screen">
      {icon ?? null}
      <h2>{title}</h2>
      {sub !== undefined ? <p>{sub}</p> : null}
      {action ?? null}
    </div>
  );
}
