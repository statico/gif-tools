import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";
import { toolMetadata } from "@/lib/seo";
import TintTool from "./client";

export const metadata: Metadata = toolMetadata("tint");

export default function Page() {
  return (
    <ToolPage slug="tint">
      <TintTool />
    </ToolPage>
  );
}
