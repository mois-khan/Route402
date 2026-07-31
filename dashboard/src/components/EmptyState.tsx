/** DESIGN.md §7 — one muted sentence, no illustration, no icon, no button. */
export function EmptyState({ children }: { children: string }) {
  return <p className="text-muted py-6 text-sm">{children}</p>;
}
