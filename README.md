# CloudPool — Micro-Order Wholesale Aggregation Platform (PS #268)

Mobile-first wholesale supply chain platform for independent cloud kitchens. Aggregates fragmented daily ingredient orders within a 3 km geographic radius using PostGIS spatial indexing and atomic PostgreSQL row locks to unlock bulk mandi pricing.

## Tech Stack
- **Mobile:** React Native (Expo JS), `react-native-maps`, `expo-location`, `AsyncStorage`, `socket.io-client`
- **Backend:** Node.js, Express, Socket.io, Prisma ORM, `node-cron`
- **Database:** PostgreSQL 15+ with PostGIS spatial extension

## Project Structure
- `backend/` — REST API, WebSocket hub server, spatial clustering & atomic pooling engine
- `mobile/` — Expo Android/iOS application for cloud kitchen owners
