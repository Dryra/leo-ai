import "./config/env";
import express from "express";
import cors from "cors";
import aiRoutes from "./routes/ai.routes";

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://192.168.178.26:5173",
  "https://leoai-app.netlify.app",
  process.env.CLIENT_URL,
]
  .filter((origin): origin is string => Boolean(origin))
  .map((origin) => origin.replace(/\/$/, ""));

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ""))) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked origin: ${origin}`));
    },
  }),
);
app.use(express.json());

app.use("/api/ai", aiRoutes);

const PORT = process.env.PORT || 3001;

app.listen(PORT as number, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
