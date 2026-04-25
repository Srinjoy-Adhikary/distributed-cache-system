import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import mongoose from "mongoose";
import * as dotenv from 'dotenv';
import apiRouter from "./src/server/api";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Attempt to connect to MongoDB if URI is provided, otherwise run in memory mode
  const MONGODB_URI = process.env.MONGODB_URI;
  if (MONGODB_URI) {
    try {
      if (mongoose.connection.readyState === 0) {
          await mongoose.connect(MONGODB_URI);
          console.log('Connected to MongoDB.');
      }
    } catch (err) {
      console.error('Failed to connect to MongoDB:', err);
    }
  } else {
    console.log('MONGODB_URI not found in env. Running in pure in-memory mode.');
  }

  app.use(express.json());

  // API Routes
  app.use('/api', apiRouter);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global Error Handler to override Express's default HTML response
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Express Error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

