import { redirect } from "next/navigation";
import { getUser } from "../../../lib/auth.mjs";
import Dashboard from "../../../components/dashboard";
export const dynamic = "force-dynamic";
export default async function Page({ params }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const { section } = await params;
  const active = section?.[0] || "overview";
  return <Dashboard key={active} user={user} section={active} />;
}
