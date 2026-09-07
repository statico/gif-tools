import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";
import { toolMetadata } from "@/lib/seo";
import CutTool from "./client";

export const metadata: Metadata = toolMetadata("cut");

export default function Page() {
  return (
    <ToolPage slug="cut">
      <CutTool />
    </ToolPage>
  );
}
