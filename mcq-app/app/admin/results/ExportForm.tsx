import { T } from "@/app/admin/T";
import { OptionText } from "@/app/admin/usePhrase";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatIntakeLabel } from "@/app/admin/students/intakeLabel";

const fieldClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-base text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm";

export function ExportForm({
  exams,
  intakes,
  intakeReady,
}: {
  exams: Array<{ id: string; name: string }>;
  intakes: string[];
  intakeReady: boolean;
}) {
  return (
    <form action="/admin/results/export" method="get" className="flex flex-wrap items-end gap-3">
      <div className="flex min-w-56 flex-1 flex-col gap-2">
        <Label htmlFor="export-exam"><T id="shell.copy.exam" /></Label>
        <select
          id="export-exam"
          name="examId"
          required
          defaultValue={exams.length === 1 ? exams[0]?.id : ""}
          className={fieldClassName}
        >
          {exams.length === 1 ? null : <option value=""><OptionText text="Choose an exam" /></option>}
          {exams.map((exam) => (
            <option key={exam.id} value={exam.id}>
              {exam.name}
            </option>
          ))}
        </select>
      </div>
      {intakeReady ? (
        <div className="flex min-w-56 flex-1 flex-col gap-2">
          <Label htmlFor="export-intake"><T id="shell.copy.intake" /></Label>
          <select id="export-intake" name="intake" defaultValue="" className={fieldClassName}>
            <option value=""><OptionText text="All intakes" /></option>
            {intakes.map((intake) => (
              <option key={intake} value={intake}>
                <OptionText text={formatIntakeLabel(intake) ?? intake} />
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <Button type="submit" name="format" value="xlsx" variant="outline"><T id="results.page.exportExcel" /></Button>
      <Button type="submit" name="format" value="csv" variant="outline"><T id="results.page.exportCsv" /></Button>
    </form>
  );
}
