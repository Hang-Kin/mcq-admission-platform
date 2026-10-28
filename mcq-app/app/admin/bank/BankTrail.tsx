import Link from "next/link";

export function BankTrail({
  items,
}: {
  items: Array<{ href?: string; label: string }>;
}) {
  return (
    <p className="text-sm text-muted-foreground">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`}>
          {index > 0 ? " · " : null}
          {item.href ? (
            <Link href={item.href} className="hover:underline">
              {item.label}
            </Link>
          ) : (
            item.label
          )}
        </span>
      ))}
    </p>
  );
}

export function WaitingNote() {
  return (
    <p className="rounded-md border border-border bg-muted px-4 py-3 text-sm text-foreground">
      The question bank is waiting for a database update. You can leave this
      page until that update is applied.
    </p>
  );
}
