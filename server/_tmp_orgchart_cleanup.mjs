import mongoose from "mongoose";
import "dotenv/config";

const User = (await import("./src/models/User.js")).default;
await mongoose.connect(process.env.MONGO_URI);

const result = await User.deleteMany({ email: { $in: ["orgchart-qa-hr@itradiant-test.local", "orgchart-qa-emp@itradiant-test.local"] } });
console.log("DELETED", result.deletedCount);
await mongoose.disconnect();
