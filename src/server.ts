import app from './app';
import http from 'http';
import { Server } from 'socket.io';
import Logger from './util/logger';

const logger = Logger(module);

/**
 * Start Express server.
 */
const server = http.createServer(app);
export const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

// The following was commented out to troubleshoot socket.io
// let clients = 0;
// io.on('connection', (socket) => {
//   clients++;
//   io.sockets.emit('broadcast', {
//     description: clients + ' clients connected!',
//   });
//   socket.on('disconnect', () => {
//     clients--;
//     io.sockets.emit('broadcast', {
//       description: clients + ' clients connected!',
//     });
//   });
// });

// server.listen(app.get('port'), () => {
//   logger.debug('SAMOC API Server is running at', {
//     url: `http://localhost:${app.get('port')}`,
//     mode: app.get('env'),
//   });
//   logger.debug('  Press CTRL-C to stop\n');
// });

export default server;
