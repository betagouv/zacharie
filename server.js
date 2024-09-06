import "./instrumentation.server.mjs";
import { createRequestHandler } from "@remix-run/express";
import compression from "compression";
import express from "express";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import userRouter from "./api/controllers/user";
// import configurePassport from "./api/utils/passport";
import { getUserFromCookie } from "./app/services/auth.server";

const viteDevServer =
  process.env.NODE_ENV === "production"
    ? undefined
    : await import("vite").then((vite) =>
        vite.createServer({
          server: { middlewareMode: true },
        })
      );

const remixHandler = createRequestHandler({
  build: viteDevServer
    ? () => viteDevServer.ssrLoadModule("virtual:remix/server-build")
    : await import("./build/server/index.js"),
});

const app = express();

app.use(cookieParser());

// Add this line to log all requests
app.use((req, res, next) => {
  console.log(`Request received: ${req.method} ${req.url}`);
  next();
});

// configurePassport(app);

// Add this to log when Passport initialization happens
console.log("Passport initialized");

app.use(compression());
app.use(express.json());

app.disable("x-powered-by");

if (viteDevServer) {
  app.use(viteDevServer.middlewares);
} else {
  app.use("/assets", express.static("build/client/assets", { immutable: true, maxAge: "1y" }));
}

app.use(express.static("build/client", { maxAge: "1h" }));

app.use(morgan("tiny"));

// API routes
// Add logging middleware for the /api/user route
app.use(
  "/api/user",
  async (req, res, next) => {
    console.log("Entering /api/user route");
    try {
      const user = await getUserFromCookie(req, { optional: false });
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      req.user = user;
      console.log("Authentication passed");
      next();
    } catch (error) {
      console.error("Error during authentication:", error);
      return res.status(401).json({ message: "Unauthorized" });
    }
  },
  userRouter
);
// handle SSR requests
app.all("*", remixHandler);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Express server listening at http://localhost:${port}`));
