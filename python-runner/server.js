import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import pty from 'node-pty';

const app = express();
app.use(cors());
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

const terminals = new Map();

io.on('connection', (socket) => {
  console.log(`[+] Client connected: ${socket.id}`);

  // Create an interactive shell
  const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: process.cwd(), // Stay in project folder
    env: process.env
  });

  terminals.set(socket.id, ptyProcess);

  ptyProcess.onData((data) => {
    socket.emit('terminal_output', data);
  });

  socket.on('terminal_input', (input) => {
    const term = terminals.get(socket.id);
    if (term) term.write(input);
  });

  socket.on('run_python', ({ code }) => {
    const term = terminals.get(socket.id);
    if (!term) return;

    // Send Ctrl+C to kill any previously running script in this shell
    term.write('\x03');
    
    // Save code to a temp file
    const tempFileName = `temp_${crypto.randomUUID().split('-')[0]}.py`;
    const tempFilePath = path.join(process.cwd(), tempFileName);
    fs.writeFileSync(tempFilePath, code, 'utf-8');

    // Execute the script in the interactive terminal
    const pyCmd = process.platform === 'win32' ? 'python' : 'python3';
    
    // Delay sending the command slightly so Ctrl+C can finalize
    setTimeout(() => {
        term.write(`${pyCmd} -X utf8 -u "${tempFilePath}"\r`);
        // Clean up temp file after a while (lazy cleanup)
        setTimeout(() => { if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath); }, 60000); // 1 min script execution max if we want to delete it, actually let's not delete it immediately since endless scripts need the file.
        // Or better yet, we just leave temp files for endless scripts, and they get overwritten/lost.
    }, 100);
  });

  socket.on('kill_python', () => {
    const term = terminals.get(socket.id);
    if (term) {
        term.write('\x03'); // Send SIGINT (Ctrl+C)
    }
  });

  socket.on('resize', (size) => {
      const term = terminals.get(socket.id);
      if (term) {
          term.resize(size.cols, size.rows);
      }
  });

  socket.on('disconnect', () => {
    console.log(`[-] Client disconnected: ${socket.id}`);
    const term = terminals.get(socket.id);
    if (term) {
      term.kill(); // Kill the shell and all its children
      terminals.delete(socket.id);
    }
  });
});

const PORT = 4000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Python PTY Runner Server started on http://localhost:${PORT}`);
  console.log(`Interactive terminals are ready...`);
});
