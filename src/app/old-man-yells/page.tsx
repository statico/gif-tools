import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";
import { toolMetadata } from "@/lib/seo";
import OldManYellsTool from "./client";

export const metadata: Metadata = toolMetadata("old-man-yells");

export default function Page() {
  return (
    <ToolPage slug="old-man-yells">
      <OldManYellsTool />
    </ToolPage>
  );
}
