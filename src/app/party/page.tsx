import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";
import { toolMetadata } from "@/lib/seo";
import PartyTool from "./client";

export const metadata: Metadata = toolMetadata("party");

export default function Page() {
  return (
    <ToolPage slug="party">
      <PartyTool />
    </ToolPage>
  );
}
