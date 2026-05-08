import "./config/env";
import express from "express";
import cors from "cors";
import aiRoutes from "./routes/ai.routes";

const app = express();

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.use("/api/ai", aiRoutes);

const PORT = process.env.PORT || 3001;

app.listen(PORT as number, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
