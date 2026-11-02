import { t } from "@/lib/i18n";

/** Both languages stay in the HTML. CSS shows the one `data-locale` selects. */
export function ShellText({ id }: { id: string }) {
  return (
    <>
      <span className="shell-en">{t(id, "en")}</span>
      <span className="shell-zh">{t(id, "zh-Hant")}</span>
    </>
  );
}
