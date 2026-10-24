import mongoose from "mongoose";

const storageCleanupSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    dueAt: {
      type: Date,
      required: true,
      index: true,
    },
    state: {
      type: String,
      enum: ["waiting", "deleting"],
      default: "waiting",
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("StorageCleanup", storageCleanupSchema);
