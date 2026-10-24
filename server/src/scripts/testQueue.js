import { createPosterQueue } from "../queues/posterQueue.js";

async function testQueue() {
  const { queue, connection } = await createPosterQueue();

  try {
    await queue.waitUntilReady();

    const job = await queue.add("connection-check", {
      message: "Hello from Movie Tracker!",
    });

    console.log(`Test job queued successfully. Job ID: ${job.id}`);
    console.log("Check the worker terminal for processing output.");
  } finally {
    try {
      await queue.close();
    } finally {
      connection.disconnect();
    }
  }
}

testQueue().catch((error) => {
  console.error("Queue test failed:", error.message);
  process.exitCode = 1;
});
