import Link from "next/link";

export default function AdminHome() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Admin dashboard</h1>
      <p className="mt-2">Admin placeholder page – only admins should be able to see this.</p>
      <nav className="mt-6 flex flex-col gap-2">
        <Link href="/admin/questions" className="underline">
          Questions
        </Link>
        <Link href="/admin/exams" className="underline">
          Exams / QR codes
        </Link>
        <Link href="/admin/review" className="underline">
          Review queue
        </Link>
      </nav>
    </main>
  );
}