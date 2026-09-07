import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";
import { toolMetadata } from "@/lib/seo";
import NumberTool from "./client";

export const metadata: Metadata = toolMetadata("number");

export default function Page() {
  return (
    <ToolPage slug="number">
      <NumberTool />
    </ToolPage>
  );
}
