import { createHandler } from "graphql-http/lib/use/http";
import { createServer } from "node:http";
import { ruruHTML } from "ruru/server";
import { serveStatic } from "ruru/static";
import schema from "./schema.js";

const handler = createHandler({ schema });

const config = {
  staticPath: "/static/",
  endpoint: "http://localhost:4000/graphql", // TODO: Make this configurable
};

const staticMiddleware = serveStatic(config.staticPath);

const server = createServer((req, res) => {
  if (req.url === "/graphql") {
    handler(req, res);
    return;
  } else if (req.url === "/graphiql") {
    const html = ruruHTML(config);
    res.writeHead(200, {
      "content-type": "text/html",
      "content-length": html.length,
    });
    res.end(html);
    return;
  } else {
    return staticMiddleware(req, res);
  }
});

export default server;