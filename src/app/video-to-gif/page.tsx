import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";
import { toolMetadata } from "@/lib/seo";
import VideoToGifTool from "./client";

export const metadata: Metadata = toolMetadata("video-to-gif");

export default function Page() {
  return (
    <ToolPage slug="video-to-gif">
      <VideoToGifTool />
    </ToolPage>
  );
}
