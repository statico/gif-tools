import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";
import { toolMetadata } from "@/lib/seo";
import CompressTool from "./client";

export const metadata: Metadata = toolMetadata("compress");

export default function Page() {
  return (
    <ToolPage slug="compress">
      <CompressTool />
    </ToolPage>
  );
}
