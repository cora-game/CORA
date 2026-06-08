// Simulated RoomManager for Matchmaking Queue Debugging

class SimulatedRoomManager {
  private matchmakingQueue: Array<{ address: string; resolve: (roomId: string) => void }> = [];
  private rooms: Map<string, any> = new Map();

  public createRoom(roomId: string) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        id: roomId,
        clients: new Map(),
        status: 'waiting',
      });
    }
    return this.rooms.get(roomId);
  }

  public joinRoom(roomId: string, address: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.clients.set(address, {});
    if (room.clients.size >= 2) {
      room.status = 'depositing';
    }
  }

  // True FIFO matchmaking: pairs two players and returns a shared roomId
  public async queueMatch(address: string, signal?: AbortSignal): Promise<string> {
    // Check if there is another player in queue who isn't the same address
    const index = this.matchmakingQueue.findIndex((q) => q.address !== address);

    if (index !== -1) {
      // Pair found!
      const pairedPlayer = this.matchmakingQueue.splice(index, 1)[0];
      const newRoomId = `room-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      this.createRoom(newRoomId);

      // Resolve for the waiting player
      pairedPlayer.resolve(newRoomId);
      // Resolve for current player
      return newRoomId;
    }

    // No pair found, enter queue
    return new Promise((resolve) => {
      const queueItem = { address, resolve };
      this.matchmakingQueue.push(queueItem);

      if (signal) {
        signal.addEventListener('abort', () => {
          const qIndex = this.matchmakingQueue.indexOf(queueItem);
          if (qIndex !== -1) {
            this.matchmakingQueue.splice(qIndex, 1);
            console.log(`\n❌ Player ${address} aborted matchmaking request.`);
          }
        });
      }
    });
  }

  // Helper for visualization
  public getQueue() {
    return this.matchmakingQueue;
  }

  public getRooms() {
    return this.rooms;
  }
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.clear();
  console.log("\x1b[36m==================================================");
  console.log("             FIFO Matchmaking Debugger            ");
  console.log("==================================================\x1b[0m\n");

  const manager = new SimulatedRoomManager();

  const drawState = () => {
    console.log('\n\x1b[33m--- Current State ---\x1b[0m');
    
    const queue = manager.getQueue();
    console.log(`\x1b[35m🧍 Queue (${queue.length}):\x1b[0m`);
    if (queue.length === 0) {
      console.log("   \x1b[90m[ Empty ]\x1b[0m");
    } else {
      queue.forEach((q, i) => {
        console.log(`   \x1b[36m${i + 1}. ${q.address}\x1b[0m \x1b[90m(Waiting...)\x1b[0m`);
      });
    }

    const rooms = manager.getRooms();
    console.log(`\n\x1b[34m🏠 Active Rooms (${rooms.size}):\x1b[0m`);
    if (rooms.size === 0) {
      console.log("   \x1b[90m[ None ]\x1b[0m");
    } else {
      rooms.forEach((room, id) => {
        const clients = Array.from(room.clients.keys());
        console.log(`   \x1b[32m- ${id}:\x1b[0m [${clients.join(', ') || 'Empty'}] (Status: \x1b[33m${room.status}\x1b[0m)`);
      });
    }
    console.log("\x1b[33m---------------------\x1b[0m\n");
  };

  const simulateJoinQueue = async (address: string) => {
    console.log(`\x1b[33m➕ Player [${address}] is joining the queue...\x1b[0m`);
    // queueMatch is async and blocks until paired.
    manager.queueMatch(address).then(roomId => {
      console.log(`\x1b[32m🎉 Player [${address}] paired! Assigned to Room: ${roomId}\x1b[0m`);
      // Simulate player joining room
      manager.joinRoom(roomId, address);
      drawState();
    });
    
    await delay(50); // slight delay to allow promise to resolve if instant pair
    drawState();
  };

  const simulateAbort = async (address: string) => {
    console.log(`\x1b[31m🚫 Simulating abort for [${address}]...\x1b[0m`);
    const abortController = new AbortController();
    
    manager.queueMatch(address, abortController.signal).then(roomId => {
        console.log(`\x1b[32m🎉 Player [${address}] paired! Assigned to Room: ${roomId}\x1b[0m`);
        manager.joinRoom(roomId, address);
        drawState();
    });
    await delay(50);
    drawState();

    await delay(1000);
    abortController.abort();
    await delay(50);
    drawState();
  }

  drawState();

  // Test 1: Simple pairing
  await delay(1000);
  await simulateJoinQueue("Alice");
  
  await delay(2000);
  await simulateJoinQueue("Bob"); // Should pair with Alice
  
  // Test 2: Multiple people joining
  await delay(2000);
  await simulateJoinQueue("Charlie");
  
  await delay(1500);
  await simulateJoinQueue("Dave"); // Should pair with Charlie
  
  // Test 3: Self-matching prevention
  console.log("\x1b[36m🧪 Testing self-match prevention (Eve tries to play against herself)...\x1b[0m");
  await delay(2000);
  await simulateJoinQueue("Eve");
  
  await delay(1500);
  await simulateJoinQueue("Eve"); // Eve enters from another tab. Should NOT pair.
  
  await delay(2000);
  await simulateJoinQueue("Frank"); // Frank joins. Should pair with the first Eve.
  
  // Test 4: Abort signal
  console.log("\x1b[36m🧪 Testing abort signal (Grace joins and then leaves)...\x1b[0m");
  await delay(2000);
  await simulateAbort("Grace");

}

main().catch(console.error);
