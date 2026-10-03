const mongoose = require("mongoose");

const connectDB = process.env.MONGO_URI;

mongoose.connect(connectDB)
.then(() => {
    console.log("MongoDB connected successfully");
})
.catch((err) => {
    console.log("MongoDB connection failed");
    console.error(err);
})