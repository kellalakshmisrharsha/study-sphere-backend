import { io } from 'socket.io-client';

const socket = io('http://localhost:4000', {
  autoConnect: false,
  withCredentials: true,
  // withCredentials: true, // use if your server requires credentials
});

export default socket;
