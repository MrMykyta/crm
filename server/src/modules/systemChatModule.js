'use strict';

const { registerModule } = require('../lib/moduleRegistry');
const chatRouter = require('../routes/system/chat');

registerModule({
  id: 'system.chat',
  mountPath: '/chat',
  router: chatRouter,
});
