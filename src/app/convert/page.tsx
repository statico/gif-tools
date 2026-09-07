import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";
import { toolMetadata } from "@/lib/seo";
import ConvertTool from "./client";

export const metadata: Metadata = toolMetadata("convert");

export default function Page() {
  return (
    <ToolPage slug="convert">
      <ConvertTool />
    </ToolPage>
  );
}
