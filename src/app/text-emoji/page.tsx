import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";
import { toolMetadata } from "@/lib/seo";
import TextEmojiTool from "./client";

export const metadata: Metadata = toolMetadata("text-emoji");

export default function Page() {
  return (
    <ToolPage slug="text-emoji">
      <TextEmojiTool />
    </ToolPage>
  );
}
