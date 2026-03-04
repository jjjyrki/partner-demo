import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import taskRoutes from './routes/tasks';
import messageRoutes from './routes/messages';

const app = express();
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

app.use(morgan('combined'));
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/tasks', taskRoutes);
app.use('/tasks', messageRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default app;
