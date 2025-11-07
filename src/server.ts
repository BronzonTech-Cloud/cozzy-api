import { createServer } from 'http';

import { createApp } from './app';
import { env } from './config/env';

const app = createApp();
const server = createServer(app);

const port = env.PORT;
server.listen(port, () => {
  console.log(`🚀 Cozzy API Server listening on http://localhost:${port}`);
});
