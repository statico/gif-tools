import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";
import { toolMetadata } from "@/lib/seo";
import RotateTool from "./client";

export const metadata: Metadata = toolMetadata("rotate");

export default function Page() {
  return (
    <ToolPage slug="rotate">
      <RotateTool />
    </ToolPage>
  );
}
