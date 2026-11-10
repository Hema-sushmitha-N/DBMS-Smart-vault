import { redirect } from "next/navigation";
import { getUser } from "../lib/auth.mjs";
export default async function Home() {
  redirect((await getUser()) ? "/dashboard" : "/login");
}
