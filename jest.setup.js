// Hack to make iconv load the encodings module, otherwise jest crashes. Compare
// https://github.com/sidorares/node-mysql2/issues/489
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('mysql2/node_modules/iconv-lite').encodingExists('foo');
jest.setTimeout(300000);
