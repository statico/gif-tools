import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";
import { toolMetadata } from "@/lib/seo";
import GifToVideoTool from "./client";

export const metadata: Metadata = toolMetadata("gif-to-video");

export default function Page() {
  return (
    <ToolPage slug="gif-to-video">
      <GifToVideoTool />
    </ToolPage>
  );
}
