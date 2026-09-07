import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";
import { toolMetadata } from "@/lib/seo";
import SplitTool from "./client";

export const metadata: Metadata = toolMetadata("split");

export default function Page() {
  return (
    <ToolPage slug="split">
      <SplitTool />
    </ToolPage>
  );
}
