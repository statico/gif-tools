import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";
import { toolMetadata } from "@/lib/seo";
import EmojifyTool from "./client";

export const metadata: Metadata = toolMetadata("emojify");

export default function Page() {
  return (
    <ToolPage slug="emojify">
      <EmojifyTool />
    </ToolPage>
  );
}
