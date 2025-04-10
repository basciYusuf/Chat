# MerYus Chat Application

A modern, real-time chat application built with React and Firebase, featuring a beautiful UI with dark/light mode support.

## Features

- Real-time messaging
- User authentication
- Dark/Light theme support
- Modern, responsive design
- Message history
- File attachment support (coming soon)

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Firebase account

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd meryus-chat
```

2. Install dependencies:
```bash
npm install
```

3. Create a Firebase project:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project
   - Enable Authentication (Email/Password)
   - Create a Firestore database
   - Get your Firebase configuration

4. Configure Firebase:
   - Open `src/config/firebase.ts`
   - Replace the placeholder values with your Firebase configuration:
```typescript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

5. Start the development server:
```bash
npm start
```

The application will be available at `http://localhost:3000`

## Project Structure

```
src/
  ├── components/     # React components
  ├── contexts/      # React contexts
  ├── config/        # Configuration files
  ├── theme/         # Theme configuration
  └── App.tsx        # Main application component
```

## Technologies Used

- React
- TypeScript
- Firebase (Authentication & Firestore)
- Material-UI
- React Router
- Styled Components

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
