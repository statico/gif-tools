import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";
import { toolMetadata } from "@/lib/seo";
import AddTextTool from "./client";

export const metadata: Metadata = toolMetadata("add-text");

export default function Page() {
  return (
    <ToolPage slug="add-text">
      <AddTextTool />
    </ToolPage>
  );
}
