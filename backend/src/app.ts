import express from "express";
import cors from "cors";
import morgan from "morgan";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import cardRoutes from "./routes/card";
import walletRoutes from "./routes/wallet";
import taskRoutes from "./routes/tasks";
import messageRoutes from "./routes/messages";
import kycRoutes from "./routes/kyc";

const app = express();
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

app.use(morgan("combined"));
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/card", cardRoutes);
app.use("/wallet", walletRoutes);
app.use("/tasks", taskRoutes);
app.use("/tasks", messageRoutes);
app.use("/kyc", kycRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

export default app;
