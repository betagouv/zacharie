/* eslint-disable no-undef */
import compression from "compression";
import express from "express";
import morgan from "morgan";
import path from "path";

const viteDevServer =
  process.env.NODE_ENV === "production"
    ? undefined
    : await import("vite").then((vite) =>
        vite.createServer({
          server: { middlewareMode: true },
        }),
      );

const app = express();

app.use(compression());

// http://expressjs.com/en/advanced/best-practice-security.html#at-a-minimum-disable-x-powered-by-header
app.disable("x-powered-by");

if (viteDevServer) {
  app.use(viteDevServer.middlewares);
  app.use((req, res, next) => {
    res.setHeader("Service-Worker-Allowed", "/");
    console.log("Set Service-Worker-Allowed header");
    next();
  });
} else {
  // Vite fingerprints its assets so we can cache forever.
  app.use("/assets", express.static("build-spa/client/assets", { immutable: true, maxAge: "1y" }));
}

// Serve static files from the build-spa/client directory
app.use(express.static(path.join(process.cwd(), "build-spa", "client")));

// For any other routes, send the index.html file
app.get("*", (req, res, next) => {
  res.sendFile(path.join(process.cwd(), "build-spa", "client", "index.html"), next);
});

app.use(morgan("tiny"));

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Express server listening at http://localhost:${port}`));
