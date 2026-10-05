import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";
import { toolMetadata } from "@/lib/seo";
import OnFireTool from "./client";

export const metadata: Metadata = toolMetadata("on-fire");

export default function Page() {
  return (
    <ToolPage slug="on-fire">
      <OnFireTool />
    </ToolPage>
  );
}
