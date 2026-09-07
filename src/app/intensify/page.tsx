import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";
import { toolMetadata } from "@/lib/seo";
import IntensifyTool from "./client";

export const metadata: Metadata = toolMetadata("intensify");

export default function Page() {
  return (
    <ToolPage slug="intensify">
      <IntensifyTool />
    </ToolPage>
  );
}
