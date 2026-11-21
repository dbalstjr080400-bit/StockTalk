import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { publicPlatformScript } from "./publicConfig";
import { appRouter } from "../routers";
import { getStockDirectory } from "../stocks";
import { getMarketAnalysis, getMarketChart, marketErrorStatus } from "../market";
import { getNewsHeadlines } from "../news";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/news", async (_req, res) => {
    try {
      const headlines = await getNewsHeadlines();
      res.set("Cache-Control", "public, max-age=300").json({ headlines, collectedAt: new Date().toISOString() });
    } catch {
      res.status(503).json({ error: "뉴스를 불러오지 못했습니다.", headlines: [] });
    }
  });
  app.get("/api/stocks", async (_req, res) => {
    try {
      const directory = await getStockDirectory();
      res.set("Cache-Control", "no-store").json(directory);
    } catch {
      res.status(503).json({ error: "종목 목록을 불러오지 못했습니다." });
    }
  });
  app.get("/api/market/chart", async (req, res) => {
    try {
      const chart = await getMarketChart(typeof req.query.symbol === "string" ? req.query.symbol : "");
      res.set("Cache-Control", "no-store").json(chart);
    } catch (error) {
      res.status(marketErrorStatus(error)).json({ error: error instanceof Error ? error.message : "시세 데이터를 불러오지 못했습니다." });
    }
  });
  app.post("/api/market/analysis", async (req, res) => {
    try {
      const analysis = await getMarketAnalysis(req.body?.symbol);
      res.set("Cache-Control", "no-store").json(analysis);
    } catch (error) {
      res.status(marketErrorStatus(error)).json({ error: error instanceof Error ? error.message : "AI 분석을 생성하지 못했습니다." });
    }
  });
  app.get("/api/platform/config.js", (_req, res) => {
    res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript());
  });
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  server.on("error", error => { console.error("Server failed:", error.message); process.exit(1); });
  server.listen(port, "0.0.0.0", () => console.log(`Server listening on port ${port}`));
}

startServer().catch(error => { console.error(error); process.exit(1); });
