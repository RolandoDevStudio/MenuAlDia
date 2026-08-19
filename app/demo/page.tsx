import { redirect } from "next/navigation";

/** Legacy slug — keep bookmarks working after seed rename. */
export default function DemoRedirectPage() {
  redirect("/demo-restaurante");
}
