import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";
import { toolMetadata } from "@/lib/seo";
import OptimizeTool from "./client";

export const metadata: Metadata = toolMetadata("optimize");

export default function Page() {
  return (
    <ToolPage slug="optimize">
      <OptimizeTool />
    </ToolPage>
  );
}
