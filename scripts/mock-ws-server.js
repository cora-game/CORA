const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

console.log('Mock WebSocket server started on ws://localhost:8080');

const initialGameState = {
  status: 'playing',
  currentRound: 1,
  player: {
    address: 'mock_player_123',
    baseHealth: 100,
    characterState: 'stay'
  },
  opponent: {
    address: 'mock_opponent_456',
    baseHealth: 100,
    characterState: 'stay'
  },
  hand: [
    {
      id: 'card-1',
      type: 'attack',
      question: {
        id: 'q-1',
        text: 'What is 5 + 5?',
        options: ['10', '15', '20']
      }
    },
    {
      id: 'card-2',
      type: 'heal',
      question: {
        id: 'q-2',
        text: 'If A -> B and B -> C, then...',
        options: ['A -> C', 'C -> A', 'A -> B -> A']
      }
    }
  ]
};

wss.on('connection', function connection(ws, req) {
  console.log('Client connected:', req.url);

  // Send initial state
  ws.send(JSON.stringify({
    type: 'gameStateUpdate',
    payload: initialGameState
  }));

  ws.on('message', function incoming(message) {
    try {
      const parsed = JSON.parse(message);
      console.log('Received:', parsed);

      if (parsed.type === 'playCard') {
        const { cardId, selectedOptionIndex } = parsed.payload;
        
        // Mock a response 2 seconds later
        setTimeout(() => {
          console.log(`Responding to card ${cardId}...`);
          // Simulate enemy took 20 damage and player character is now happy
          const nextState = { ...initialGameState };
          nextState.opponent.baseHealth = 80;
          nextState.player.characterState = 'happy';
          nextState.hand = [initialGameState.hand[1]]; // Card was consumed
          
          ws.send(JSON.stringify({
            type: 'gameStateUpdate',
            payload: nextState
          }));
        }, 1000);
      }
    } catch (e) {
      console.error('Failed to parse message', e);
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});
