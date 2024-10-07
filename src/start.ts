import server from './server';
import app from './app';
import Logger from './util/logger';

const logger = Logger(module);

server.listen(app.get('port'), () => {
  logger.debug('SAMOC API Server is running at', {
    url: `http://localhost:${app.get('port')}`,
    mode: app.get('env'),
  });
  logger.debug('  Press CTRL-C to stop\n');
});
