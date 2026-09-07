import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";
import { toolMetadata } from "@/lib/seo";
import SpeedTool from "./client";

export const metadata: Metadata = toolMetadata("speed");

export default function Page() {
  return (
    <ToolPage slug="speed">
      <SpeedTool />
    </ToolPage>
  );
}
