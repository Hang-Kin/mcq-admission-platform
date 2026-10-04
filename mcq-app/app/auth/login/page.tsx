import { LoginForm } from "@/components/login-form";

export default function Page() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  );
}
