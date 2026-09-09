import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";
import { toolMetadata } from "@/lib/seo";
import RemoveBgTool from "./client";

export const metadata: Metadata = toolMetadata("remove-bg");

export default function Page() {
  return (
    <ToolPage slug="remove-bg">
      <RemoveBgTool />
    </ToolPage>
  );
}
