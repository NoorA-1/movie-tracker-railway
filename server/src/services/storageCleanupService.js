import Movie from "../models/Movie.js";
import StorageCleanup from "../models/StorageCleanup.js";
import { deleteObject } from "./storageService.js";

export async function scheduleObjectDeletion(
  key,
  { session, delayMs = 0 } = {},
) {
  if (!key) {
    return;
  }

  await StorageCleanup.updateOne(
    { _id: key },
    {
      $setOnInsert: {
        dueAt: new Date(Date.now() + delayMs),
        state: "waiting",
      },
    },
    {
      upsert: true,
      session,
    },
  );
}

export async function keepUploadedObject(key, session) {
  const result = await StorageCleanup.deleteOne(
    {
      _id: key,
      state: "waiting",
    },
    {
      session,
    },
  );

  if (result.deletedCount !== 1) {
    throw new Error("The upload expired before it could be saved. Try again.");
  }
}

export async function cleanUnusedObjects() {
  for (let index = 0; index < 10; index += 1) {
    const leaseUntil = new Date(Date.now() + 60_000);

    const task = await StorageCleanup.findOneAndUpdate(
      {
        dueAt: { $lte: new Date() },
      },
      {
        $set: {
          state: "deleting",
          dueAt: leaseUntil,
        },
      },
      {
        new: true,
        sort: { dueAt: 1 },
      },
    ).lean();

    if (!task) {
      return;
    }

    const taskFilter = {
      _id: task._id,
      state: "deleting",
      dueAt: leaseUntil,
    };

    try {
      const stillReferenced = await Movie.exists({
        $or: [{ posterKey: task._id }, { posterInputKey: task._id }],
      });

      if (stillReferenced) {
        await StorageCleanup.updateOne(taskFilter, {
          $set: {
            state: "waiting",
            dueAt: new Date(Date.now() + 60 * 60 * 1000),
          },
        });

        continue;
      }

      await deleteObject(task._id);
      await StorageCleanup.deleteOne(taskFilter);

      console.log(`Deleted unused R2 object: ${task._id}`);
    } catch (error) {
      console.error(`Cleanup failed for ${task._id}:`, error.message);

      await StorageCleanup.updateOne(taskFilter, {
        $set: {
          dueAt: new Date(Date.now() + 60_000),
        },
      });
    }
  }
}
