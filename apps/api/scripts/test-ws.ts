import { WebSocket } from 'ws';
import fs from 'fs';

const API_URL = 'http://127.0.0.1:8080/match';
const WS_URL = 'ws://127.0.0.1:8080/match';
const POOL_PATH = '../../data/questions/pool.json';

const pool = JSON.parse(fs.readFileSync(POOL_PATH, 'utf8'));
const correctAnswers = new Map();
for (const q of pool) {
  const correct = q.options.find((o: any) => o.score === true);
  if (correct) {
    correctAnswers.set(q.id, correct.id);
  }
}

// Helper to simulate human variance
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

async function joinQueue(address: string) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address })
  });
  if (!res.ok) throw new Error(`Failed to join queue: ${res.statusText}`);
  const data = await res.json();
  return data.roomId;
}

async function run() {
  console.log('Connecting players to queue...');
  
  const [roomId1, roomId2] = await Promise.all([
    joinQueue('Player1'),
    joinQueue('Player2')
  ]);

  console.log(`Matched in room: ${roomId1}`);

  const ws1 = new WebSocket(`${WS_URL}/${roomId1}?address=Player1`);
  const ws2 = new WebSocket(`${WS_URL}/${roomId2}?address=Player2`);

  let p1Hand: any[] = [];
  let isP1Turn = false;
  let processingPlay = false;

  const playNextCard = async () => {
    if (!isP1Turn || p1Hand.length === 0 || processingPlay) return;
    processingPlay = true;
    
    // Always play attack card if possible, else just first card
    const card = p1Hand.find(c => c.type === 'attack') || p1Hand[0];
    const correctOpt = correctAnswers.get(card.question.id) || card.question.options[0].id;
    
    // 1. Simulating human decision time before opening a card (0.5s - 1.5s)
    await sleep(randomInt(500, 1500));
    console.log(`P1 opens card ${card.id}`);
    ws1.send(JSON.stringify({ type: 'openCard', payload: { cardId: card.id } }));
    
    // 2. Simulating human time to read the question and math equations (2s - 5s)
    const readAndThinkTime = randomInt(2000, 5000);
    await sleep(readAndThinkTime);

    // 3. Simulating ~85% accuracy so they aren't totally perfect over 3 rounds
    let chosenAnswer = correctOpt;
    if (Math.random() > 0.85) {
      // Pick a random wrong answer
      const wrongOptions = card.question.options.filter((o: any) => o.id !== correctOpt);
      if (wrongOptions.length > 0) {
        chosenAnswer = wrongOptions[Math.floor(Math.random() * wrongOptions.length)].id;
        console.log(`P1 (simulated mistake) plays card ${card.id} with wrong answer ${chosenAnswer}`);
      }
    } else {
      console.log(`P1 plays card ${card.id} with correct answer ${chosenAnswer}`);
    }

    ws1.send(JSON.stringify({ type: 'playCard', payload: { cardId: card.id, selectedOptionId: chosenAnswer } }));
  };

  ws1.on('open', () => {
    ws1.send(JSON.stringify({ type: 'confirmDeposit', payload: { signature: 'sig1' } }));
  });

  ws2.on('open', () => {
    ws2.send(JSON.stringify({ type: 'confirmDeposit', payload: { signature: 'sig2' } }));
  });

  ws1.on('message', (data: string) => {
    const msg = JSON.parse(data);
    
    if (msg.type === 'gameStateUpdate') {
      if (msg.payload.status === 'playing') {
        p1Hand = msg.payload.hand;
        if (!isP1Turn) {
            isP1Turn = true;
            playNextCard();
        }
      }
    }
    
    if (msg.type === 'playCardResult') {
      // Re-trigger loop only after we get result, allowing async wait to naturally block
      processingPlay = false;
      playNextCard();
    }

    if (msg.type === 'matchInvalidated') {
      console.log(`\n❌ MATCH INVALIDATED: Anti-Cheat Rejection!`);
      process.exit(0);
    }
    
    if (msg.type === 'roundOver') {
      console.log(`\n=========================================`);
      console.log(`🎉 ROUND OVER! Winner: ${msg.payload.winnerAddress}`);
      console.log(`=========================================\n`);
    }

    if (msg.type === 'matchResult') {
      console.log(`\n🌟 MATCH RESULT! Winner: ${msg.payload.winner}`);
      process.exit(0);
    }
  });

  ws2.on('message', (data: string) => {
    const msg = JSON.parse(data);
    if (msg.type === 'damageEvent') {
        process.stdout.write(`💥 P2 hit! Health: ${msg.payload.damage} -> P1's strike\n`);
    }
  });

  ws1.on('close', () => console.log('WS1 Closed'));
  ws2.on('close', () => console.log('WS2 Closed'));
}

run().catch(console.error);
