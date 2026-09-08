import { ImportForm } from "../ImportForm";

export const instant = false;

export default function ImportQuestionsPage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Import questions</h1>
      <ImportForm />
    </main>
  );
}
