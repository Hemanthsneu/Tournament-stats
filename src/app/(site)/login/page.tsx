import { redirect } from "next/navigation";
import { LoginForm } from "@/components/account/login-form";
import { getViewer } from "@/lib/community";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const target = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/me";
  if (await getViewer()) redirect(target);
  return (
    <div className="mx-auto max-w-md py-6">
      <LoginForm next={target} />
    </div>
  );
}
