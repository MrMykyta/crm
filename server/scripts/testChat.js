// scripts/testChat.js
require('dotenv').config();
const { connectMongo } = require('../src/db/mongo');
const chat = require('../src/services/system/chat/chatService');

(async () => {
  await connectMongo();

  const companyId = '1';
  const userA = '100';
  const userB = '200';

  console.log('Creating direct room...');
  const room = await chat.findOrCreateDirectRoom({
    companyId,
    userId: userA,
    otherUserId: userB,
  });

  console.log('Room ID:', room._id.toString());

  console.log('Sending message...');
  const msg = await chat.sendMessage({
    companyId,
    roomId: room._id,
    authorId: userA,
    text: 'Hello from test script!',
  });

  console.log('Message created:', msg);

  process.exit(0);
})();