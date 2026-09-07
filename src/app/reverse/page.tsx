import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";
import { toolMetadata } from "@/lib/seo";
import ReverseTool from "./client";

export const metadata: Metadata = toolMetadata("reverse");

export default function Page() {
  return (
    <ToolPage slug="reverse">
      <ReverseTool />
    </ToolPage>
  );
}
