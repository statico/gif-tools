import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";
import { toolMetadata } from "@/lib/seo";
import CropTool from "./client";

export const metadata: Metadata = toolMetadata("crop");

export default function Page() {
  return (
    <ToolPage slug="crop">
      <CropTool />
    </ToolPage>
  );
}
