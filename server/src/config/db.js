import mongoose from "mongoose";
import dns from "node:dns/promises";

export async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is missing");
  }

  const dnsServers = process.env.DNS_SERVERS?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (dnsServers?.length) {
    dns.setServers(dnsServers);
  }

  mongoose.set("bufferCommands", false);

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
  });

  console.log("MongoDB connected successfully");
}
