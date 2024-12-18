const express = require("express");
const axios = require("axios");
const cron = require("node-cron");
require("dotenv").config();
const cors = require("cors");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const http = require("http"); // using this for http server
const { Server } = require("socket.io"); // using this for socket.io server
// socket.io

// Initialize Express, HTTP, and Socket.io server
const app = express();
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:5173", // Allow requests from the frontend
    methods: ["GET", "POST"],
    credentials: true,
  })
);
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Allow frontend to connect via WebSockets
    methods: ["GET", "POST"],
  },
});

// Connect to MongoDB
mongoose
  .connect("mongodb+srv://morshedwork:QMPjx6hq1ZHsdbH4@cluster0.sq43h.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.log("Failed to connect to MongoDB", err));

// MongoDB Schema for storing chat messages
const chatSchema = new mongoose.Schema({
  user: String, // recipient phone number
  messages: [
    {
      sender: { type: String, require: true },
      text: { type: String, default: "" },
      mediaUrl: { type: String, default: null }, // URL for the media
      mediaType: { type: String, default: null }, // Type of the media (image, video, audio)
      timestamp: { type: Date, default: Date.now },
    },
  ],
});

const Chat = mongoose.model("chat", chatSchema);

const WHATSAPP_API_URL = process.env.WHATSAPP_BUSINESS_API;

let TOKEN = "EAAWoMWMy5S4BO0pm7bqigGJMsI0jeD30DSdzh1QZBnG6aZAccizJN4hYjLcEiFXYXp06LiZBXLDnvcLPpdZBsJoEC536kQ8l4xQHGa2gwpSneDXxZA4dkiPxaC0ZAm9NK7cEYW4z9ZAuacVhPrMjIiZCcIQYSJKEwxe9XYBSrJEzIm9MVT6XZCvhmQYypq5y9ZCAdhmCVFOyY5e3UkZAeVaBervDnq4TVewCgX4LlgMsM4ZD";

// Function to refresh the access token -> work on it after implement business api

// const refreshAccessToken = async () => {
//   try {
//     const response = await axios.get(`https://graph.facebook.com/v12.0/oauth/access_token`, {
//       params: {
//         grant_type: "fb_exchange_token",
//         client_id: process.env.APP_ID,
//         client_secret: process.env.APP_SECRET,
//         fb_exchange_token: "EAAWoMWMy5S4BO4Mbx1025646zrQwpNZBuUBVPHXpv1Q834G37MFjr5oMifKhaHN5KgethZBlLZAj8RCiLKMEoI6WzdQZAOel9nytGZBJLHDPV6dc1ZCfC5eVeUcGsSvuhwmCppeJZBZB0OocpU4kZAyv0fTUi3VSLT8QPa4Nj2B5SlBUZCIGm74RyyURQYNYhKlkhzlz3omU2qAEHabtS8I2pVzSt9xVIZD",
//       },
//     });
//     const longLivedToken = response.data.access_token;
//     TOKEN = longLivedToken; // Update in memory (you can save it in .env or DB)
//     console.log("Token refreshed successfully:", TOKEN);
//   } catch (error) {
//     console.error("Failed to refresh token:", error);
//   }
// };

// // Automatically refresh token every 30 days (adjust as needed)
// cron.schedule("0 0 */1 * *", async () => {
//   console.log("Refreshing token...");
//   await refreshAccessToken();
// });

// send reply to user by socket.io
io.on("connection", (socket) => {
  console.log(`A client connected: ${socket.id}`);
  try {
    // get all users
    socket.on("getAllUsers", async () => {
      const users = await Chat.find();
      socket.emit("allUsers", users);
    });

    // send reply to user from website via whatsApp
    socket.on("sendReply", async ({ recipientNumber, message }, callback) => {
      console.log(recipientNumber, message);

      try {
        await axios.post(
          WHATSAPP_API_URL,
          {
            messaging_product: "whatsapp",
            to: recipientNumber,
            type: "text",
            text: { body: message },
          },
          {
            headers: { Authorization: `Bearer ${TOKEN}` },
          }
        );

        // Add sent message to chat history in MongoDB to show in website ui
        let chat = await Chat.findOne({ user: recipientNumber });
        if (!chat) {
          chat = new Chat({ user: recipientNumber, messages: [] });
        }

        chat.messages.push({ sender: "admin", text: message });
        await chat.save();
        // emit update chat history for the admin dashboard to update UI ---> for real-time chat display
        socket.emit("updateChat", { recipientNumber, message, sender: "admin" });
      } catch (error) {
        console.error("Error sending reply:", error);

        callback({ status: "error", message: "Failed to send message. Please try again." });
      }
    });

    // get user update chat history for the admin dashboard to update UI
    socket.on("getUserChatHistory", async (recipientNumber) => {
      try {
        const chat = await Chat.findOne({ user: recipientNumber });
        if (chat) {
          socket.emit("chatHistory", { recipientNumber, messages: chat.messages });
        }
      } catch (error) {
        console.error("Error fetching chat history:", error);
      }
    });
  } catch (error) {}
});

// For Home route to ensure server is running
app.get("/", (req, res) => {
  res.send("Welcome to the WhatsApp Chat API!");
});

app.get("/whatsapp-webhook", (req, res) => {
  const verifyToken = TOKEN;

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === verifyToken) {
    res.status(200).send(challenge); // Verification success
  } else {
    res.sendStatus(403); // Forbidden if token doesn't match
  }
});

// WhatsApp Webhook Route to Handle Incoming Messages and save receive sms to database

// app.post("/whatsapp-webhook", async (req, res) => {
//   try {
//     const { entry } = req.body;
//     const changes = entry[0].changes[0];
//     const messages = changes.value.messages;

//     if (messages && messages.length > 0) {
//       const messageData = messages[0];
//       const userNumber = messageData.from;
//       let text = messageData.text?.body || "";
//       let mediaUrl = null;
//       let mediaType = null;

//       if (messageData.type === "image" || messageData.type === "video" || messageData.type === "audio") {
//         const mediaId = messageData[messageData.type].id;
//         mediaUrl = await axios.get(`https://graph.facebook.com/v21.0/${mediaId}`, {
//           headers: { Authorization: `Bearer ${TOKEN}` },
//         });
//         mediaType = messageData.type;
//       }

//       let chat = await Chat.findOne({ user: userNumber });

//       if (!chat) {
//         chat = new Chat({ user: userNumber, messages: [] });
//       }

//       const newMessage = {
//         sender: "user",
//         text: text,
//         mediaUrl: mediaUrl ? mediaUrl.data.url : null,
//         mediaType: mediaType,
//         timestamp: new Date(),
//       };

//       chat.messages.push(newMessage);
//       await chat.save();

//       // Emit the new message via Socket.IO
//       io.emit("newMessage", { user: userNumber, message: newMessage });

//       res.sendStatus(200);
//     } else {
//       res.sendStatus(200);
//     }
//   } catch (error) {
//     console.error("Error processing WhatsApp webhook:", error);
//     res.sendStatus(500);
//   }
// });

app.post("/whatsapp-webhook", async (req, res) => {
  try {
    const { entry } = req.body;
    const changes = entry[0].changes[0];
    const messages = changes.value.messages;

    if (messages && messages.length > 0) {
      const messageData = messages[0];
      const userNumber = messageData.from;
      let text = messageData.text?.body || "";
      let mediaUrl = null;
      let mediaType = null;
      let mediaFileName = null;

      if (messageData.type === "image" || messageData.type === "video" || messageData.type === "audio") {
        const mediaId = messageData[messageData.type].id;

        // Step 1: Get media URL
        const mediaResponse = await axios.get(`https://graph.facebook.com/v21.0/${mediaId}`, {
          headers: { Authorization: `Bearer ${TOKEN}` },
        });
        mediaUrl = mediaResponse.data.url;
        mediaType = messageData.type;

        // Step 2: Download the media
        const mediaPath = path.join(__dirname, "media"); // Directory to store media
        if (!fs.existsSync(mediaPath)) {
          fs.mkdirSync(mediaPath); // Create directory if not exists
        }
        mediaFileName = `${mediaId}.${mediaType}`; // Generate a unique file name
        const filePath = path.join(mediaPath, mediaFileName);

        const mediaFile = await axios({
          url: mediaUrl,
          method: "GET",
          responseType: "stream",
          headers: {
            Authorization: `Bearer ${TOKEN}`,
          },
        });

        // Save media to file
        const writer = fs.createWriteStream(filePath);
        mediaFile.data.pipe(writer);
        await new Promise((resolve, reject) => {
          writer.on("finish", resolve);
          writer.on("error", reject);
        });

        console.log(`Media downloaded: ${filePath}`);
      }

      // Step 3: Save message to database
      let chat = await Chat.findOne({ user: userNumber });

      if (!chat) {
        chat = new Chat({ user: userNumber, messages: [] });
      }

      const newMessage = {
        sender: "user",
        text: text,
        mediaUrl: mediaFileName ? `/media/${mediaFileName}` : null, // Save relative path to database
        mediaType: mediaType,
        timestamp: new Date(),
      };

      chat.messages.push(newMessage);
      await chat.save();

      // Emit the new message via Socket.IO
      io.emit("newMessage", { user: userNumber, message: newMessage });

      res.sendStatus(200);
    } else {
      res.sendStatus(200);
    }
  } catch (error) {
    console.error("Error processing WhatsApp webhook:", error);
    res.sendStatus(500);
  }
});

server.listen(3000, () => console.log("Server running on port 3000"));
