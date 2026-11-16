import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";
import { toolMetadata } from "@/lib/seo";
import GifApngTool from "./client";

export const metadata: Metadata = toolMetadata("gif-apng");

export default function Page() {
  return (
    <ToolPage slug="gif-apng">
      <GifApngTool />
    </ToolPage>
  );
}
