# WhatsApp Chat API
This project is a REST API for managing and sending WhatsApp messages through the Facebook Graph API. It supports real-time messaging, media handling, and MongoDB storage for chat history. The API allows communication between an admin and users, with message persistence and the ability to send and receive text, image, video, or audio messages.


## Features

- Send WhatsApp Messages: Admins can send text messages to users.
- Receive Incoming Messages: The API can receive messages from WhatsApp users and store them in MongoDB.
- Store Chat History: User chats are saved in MongoDB for future reference.
- Media Handling: Supports image, video, and audio media types.
- Webhook: Handles WhatsApp webhook events for receiving messages.
- Token Refresh: Automatically refreshes access tokens using a cron job (disabled by default but can be enabled).
- Real-Time Updates: Chat history is updated in real-time as new messages are sent or received.

## Technologies Used

- **Language/Framework**: Node.js with Express.
- **Database**: MongoDB
- Axios for making HTTP requests to the Facebook Graph API.
- Cron for scheduling token refreshes.
- Cors and Body-Parser for handling cross-origin requests and parsing request bodies.

## Prerequisites

List the prerequisites to run the project, such as:

- Node.js
- MongoDB

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/project-name.git
2. **Create a .env file in the root directory with your Facebook App credentials**:
   ```bash
   APP_ID=your-app-id
   APP_SECRET=your-app-secret
   MONGO_URI:your-mongodb-url
   TOKEN:your whatsapp-api's-access-token


## API Endpoints
- POST /send-whatsapp: Send a message.
- POST /whatsapp-webhook: Handle incoming WhatsApp messages.
- GET /users: Fetch users with chats.
- GET /chats/:userNumber: Fetch chat history for a user.
