import { T, TText } from "@/app/admin/T";
import Link from "next/link";

export function BankTrail({
  items,
}: {
  items: Array<{ href?: string; label: string }>;
}) {
  return (
    <p className="text-sm text-muted-foreground">
      {items.map((item, index) => (
        <span key={`$<TText text={item.label} />-${index}`}>
          {index > 0 ? " · " : null}
          {item.href ? (
            <Link href={item.href} className="hover:underline">
              <TText text={item.label} />
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
    <p className="rounded-md border border-border bg-muted px-4 py-3 text-sm text-foreground"><T id="shell.copy.bankWaiting" /></p>
  );
}
