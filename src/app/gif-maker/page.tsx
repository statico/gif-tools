import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";
import { toolMetadata } from "@/lib/seo";
import GifMakerTool from "./client";

export const metadata: Metadata = toolMetadata("gif-maker");

export default function Page() {
  return (
    <ToolPage slug="gif-maker">
      <GifMakerTool />
    </ToolPage>
  );
}
