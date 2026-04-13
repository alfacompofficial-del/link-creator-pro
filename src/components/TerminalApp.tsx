import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { io, Socket } from 'socket.io-client';
import '@xterm/xterm/css/xterm.css';
import { Button } from '@/components/ui/button';
import { Play, Square, PlugZap } from 'lucide-react';

interface TerminalAppProps {
  code: string;
}

export default function TerminalApp({ code }: TerminalAppProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termInstanceRef = useRef<Terminal | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    // Initialize xterm.js
    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
      },
      fontFamily: '"Fira Code", monospace',
      fontSize: 14,
    });
    
    // Fit addon to resize automatically
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    if (terminalRef.current) {
      term.open(terminalRef.current);
      fitAddon.fit();
    }
    termInstanceRef.current = term;

    // Connect WebSocket to Python Runner Server
    const socket = io('http://localhost:4000');
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      term.writeln('\\x1b[32m[Подключено к серверу выполнения]\\x1b[0m');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setIsRunning(false);
      term.writeln('\\x1b[31m[Потеряно соединение с сервером]\\x1b[0m');
    });

    // Receive data from python stdout/stderr
    socket.on('terminal_output', (data: string) => {
      term.write(data);
      if (data.includes('--- Process finished') || data.includes('--- Process Killed')) {
        setIsRunning(false);
      }
    });

    // Handle user typing in the terminal (stdin)
    term.onData((data) => {
      if (socketRef.current && isRunning) {
        // Send keystrokes to server
        socketRef.current.emit('terminal_input', data);
      }
    });

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      socket.disconnect();
      term.dispose();
    };
  }, []);

  const handleRun = () => {
    if (!socketRef.current) return;
    setIsRunning(true);
    termInstanceRef.current?.clear();
    socketRef.current.emit('run_python', { code });
  };

  const handleKIll = () => {
    if (!socketRef.current) return;
    socketRef.current.emit('kill_python');
    setIsRunning(false);
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#1e1e1e] overflow-hidden rounded-md border border-border/40">
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            {isConnected ? 'Сервер Активен' : 'Сервер Недоступен'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isRunning ? (
            <Button size="sm" variant="destructive" onClick={handleKIll} className="h-7 text-xs">
              <Square className="w-3 h-3 mr-1" />
              Остановить
            </Button>
          ) : (
            <Button size="sm" variant="hero" onClick={handleRun} disabled={!isConnected} className="h-7 text-xs">
              <Play className="w-3 h-3 mr-1" />
              Запустить
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 p-2 h-full overflow-hidden" ref={terminalRef}></div>
    </div>
  );
}
