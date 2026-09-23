const mongoose = require("mongoose");

const FALLBACK_URI = "mongodb://127.0.0.1:27017/whiteboard_socket";

const CONNECT_OPTIONS = {
  serverSelectionTimeoutMS: 4000,
  bufferCommands: false,
};

const dbName = (uri) => {
  try {
    return new URL(uri).pathname.replace(/^\//, "").replace(/\/?$/, "") || "(default db)";
  } catch {
    return uri;
  }
};

const connectDB = async () => {
  const candidates = [...new Set([process.env.MONGO_URI, FALLBACK_URI].filter(Boolean))];

  for (const uri of candidates) {
    try {
      const conn = await mongoose.connect(uri, CONNECT_OPTIONS);
      console.log(
        `MongoDB connected: ${conn.connection.host} (database: ${dbName(uri)})`
      );
      return conn;
    } catch (error) {
      console.error(
        `MongoDB connection failed [${dbName(uri)}]: ${error.message}`
      );
      if (mongoose.connection.readyState === 1) return mongoose.connection;
    }
  }

  console.error("MongoDB unreachable via all configured URIs.");
  return null;
};

module.exports = connectDB;