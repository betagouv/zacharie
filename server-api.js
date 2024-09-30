import { createRequestHandler } from "@remix-run/express";
import compression from "compression";
import cors from "cors";
import express from "express";
import morgan from "morgan";

const viteDevServer =
  process.env.NODE_ENV === "production"
    ? undefined
    : await import("vite").then((vite) =>
        vite.createServer({
          server: { middlewareMode: true },
        }),
      );

const remixHandler = createRequestHandler({
  build: viteDevServer
    ? () => viteDevServer.ssrLoadModule("virtual:remix/server-build")
    : await import("./build-api/server/index.js"),
});

const app = express();

// Log the NODE_ENV
console.log("NODE_ENV:", process.env.NODE_ENV);

// CORS configuration
const corsOptions = {
  credentials: true,
  origin: (origin, callback) => {
    const allowedOrigins = ["https://zacharie.beta.gouv.fr"];
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("CORS not allowed"));
    }
  },
};

if (process.env.NODE_ENV === "production") {
  app.use(cors(corsOptions));
  // app.use(cors({ credentials: true, origin: "zacharie.beta.gouv.fr" }));
} else {
  // app.use(
  //   cors({
  //     credentials: true,
  //     origin: ["http://localhost:3232", "http://localhost:3233"],
  //   }),
  // );
  // it must be defined in the vite.config.ts file
  // if not, there will be the following error:
  /* Access to fetch at 'http://localhost:3233/loader/me' from origin 'http://localhost:3232' has been blocked by CORS policy: The value of the 'Access-Control-Allow-Origin' header in the response must not be the wildcard '*' when the request's credentials mode is 'include'. */
  // if you put it, there will be the following error:
  /* Access to fetch at 'http://localhost:3233/action/app/connexion' from origin 'http://localhost:3232' has been blocked by CORS policy: The 'Access-Control-Allow-Origin' header contains multiple values 'http://localhost:3232, http://localhost:3232', but only one is allowed. Have the server send the header with a valid value, or, if an opaque response serves your needs, set the request's mode to 'no-cors' to fetch the resource with CORS disabled. */
}

app.use(compression());

// http://expressjs.com/en/advanced/best-practice-security.html#at-a-minimum-disable-x-powered-by-header
app.disable("x-powered-by");

// handle asset requests
if (viteDevServer) {
  app.use(viteDevServer.middlewares);
} else {
  // Vite fingerprints its assets so we can cache forever.
  app.use("/assets", express.static("build/client/assets", { immutable: true, maxAge: "1y" }));
}

// Everything else (like favicon.ico) is cached for an hour. You may want to be
// more aggressive with this caching.
app.use(express.static("build/client", { maxAge: "1h" }));

app.use(morgan("tiny"));

// handle SSR requests
app.all("*", remixHandler);

const port = process.env.PORT || 3233;
app.listen(port, () => console.log(`Express server listening at http://localhost:${port}`));
