import express from "express";
import path from "node:path";
import { storageConfig } from "./config/storage.js";
import { apiRouter } from "./routes/index.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";

export const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/uploads", express.static(path.resolve(storageConfig.localDir)));

  app.get("/health", (_req, res) => {
    res.json({ success: true, message: "ok" });
  });

  app.use("/api/v1", apiRouter);
  app.use(notFound);
  app.use(errorHandler);

  return app;
};
