import type { WebAppManifest } from "~/types/webmanifest";
import { json } from "@remix-run/node";

export const loader = () => {
  return json(
    {
      short_name: "Zacharie",
      name: "Zacharie | Ministère de l'Agriculture",
      display: "fullscreen",
      background_color: "#000091",
      theme_color: "#000091",
      start_url: "./?mode=standalone",
      scope: "./",
    } as WebAppManifest,
    {
      headers: {
        "Cache-Control": "public, max-age=600",
        "Content-Type": "application/manifest+json",
      },
    }
  );
};
