# Competitive Arena

A real-time multiplayer quiz system using Socket.IO.

## Description

Competitive Arena is a platform for hosting real-time quiz competitions between players. The system uses Socket.IO for real-time communication and provides a competitive environment for quiz games.

## Features

- Real-time multiplayer quiz competitions
- Match-making system
- Tiebreaker rounds
- Score tracking
- Integration with external systems

## Installation

```bash
# Clone the repository
git clone <repository-url>

# Navigate to the project directory
cd competitive-arena

# Install dependencies
npm install
```

## Configuration

Create a `.env` file in the root directory with the following variables:

```
PORT=3000
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
LARAVEL_API_URL=your_laravel_api_url
```

## Usage

### Local Development

```bash
# Start the development server with nodemon
npm run dev

# Start the server
npm start
```

### Online Testing with ngrok

To test the application online and make it accessible over the internet:

```bash
# Install ngrok dependency if not already installed
npm install ngrok

# Authenticate ngrok (required only once)
# Get your authtoken from https://dashboard.ngrok.com/get-started/your-authtoken
npx ngrok authtoken YOUR_AUTH_TOKEN

# Start the ngrok server
npm run ngrok
```

This will start the server and create an ngrok tunnel, providing you with a public URL that can be used to access your application from anywhere.

#### Ngrok Authentication

Ngrok requires authentication to work properly. Follow these steps to authenticate:

1. Create a free account at [ngrok.com](https://ngrok.com)
2. Get your authtoken from the [ngrok dashboard](https://dashboard.ngrok.com/get-started/your-authtoken)
3. Run the authentication command: `npx ngrok authtoken YOUR_AUTH_TOKEN`
4. Start the ngrok server: `npm run ngrok`

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate test coverage report
npm run test:coverage
```

## License

ISC