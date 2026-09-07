import type { Metadata } from "next";
import { ToolPage } from "@/components/tool-page";
import { toolMetadata } from "@/lib/seo";
import EffectsTool from "./client";

export const metadata: Metadata = toolMetadata("effects");

export default function Page() {
  return (
    <ToolPage slug="effects">
      <EffectsTool />
    </ToolPage>
  );
}
