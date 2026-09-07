import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";
import { toolMetadata } from "@/lib/seo";
import ResizeTool from "./client";

export const metadata: Metadata = toolMetadata("resize");

export default function Page() {
  return (
    <ToolPage slug="resize">
      <ResizeTool />
    </ToolPage>
  );
}
