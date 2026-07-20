// client/src/hooks/userSocket.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface Room {
  roomId: string;
  title: string;
  currentPlayers: number;
  maxPlayers: number;
  isPrivate?: boolean;
}

export const useSocket = (token: string | null) => {
  const socketRef = useRef<Socket | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const requestRoomList = useCallback(() => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('room:list');
    }
  }, []);

  const createRoom = useCallback((title: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('room:create', { title });
    }
  }, []);

  useEffect(() => {
    if (!token) return;

    const socket = io(window.location.origin, {
      auth: { token },
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('room:list');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('room:list', (roomList: Room[]) => {
      setRooms(roomList);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  return {
    socket: socketRef.current,
    isConnected,
    rooms,
    requestRoomList,
    createRoom,
  };
};