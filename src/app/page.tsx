import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "../lib/auth";

export default async function Home() {
  const currentUser = await getCurrentUserProfile();
  redirect(currentUser ? "/bulk" : "/login");
}
