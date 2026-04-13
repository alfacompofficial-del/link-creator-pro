import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { spawn } from 'child_process';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const app = express();
app.use(cors());
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

const processes = new Map(); // Store child processes by socket id

io.on('connection', (socket) => {
  console.log(`[+] Client connected: ${socket.id}`);

  socket.on('run_python', ({ code }) => {
    // Kill existing process if any
    if (processes.has(socket.id)) {
      processes.get(socket.id).kill();
      processes.delete(socket.id);
    }

    // Save code to a temp file
    const tempFileName = `temp_${crypto.randomUUID()}.py`;
    const tempFilePath = path.join(process.cwd(), tempFileName);
    fs.writeFileSync(tempFilePath, code, 'utf-8');

    // Spawn Python process with -u (unbuffered)
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const pyProcess = spawn(pythonCmd, ['-u', tempFilePath]);

    processes.set(socket.id, pyProcess);

    // Send start signal
    socket.emit('terminal_output', '\\r\\n\\x1b[32m--- Process Started ---\\x1b[0m\\r\\n');

    pyProcess.stdout.on('data', (data) => {
      // Send raw data to terminal
      socket.emit('terminal_output', data.toString().replace(/\\n/g, '\\r\\n'));
    });

    pyProcess.stderr.on('data', (data) => {
      // Send error data to terminal in red
      socket.emit('terminal_output', `\\x1b[31m${data.toString().replace(/\\n/g, '\\r\\n')}\\x1b[0m`);
    });

    pyProcess.on('close', (code) => {
      socket.emit('terminal_output', `\\r\\n\\x1b[33m--- Process finished with exit code ${code} ---\\x1b[0m\\r\\n`);
      processes.delete(socket.id);
      // Clean up temp file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    });
  });

  socket.on('terminal_input', (input) => {
    // Send user input from terminal to running process
    const pyProcess = processes.get(socket.id);
    if (pyProcess && pyProcess.stdin) {
        // Echo input to terminal so user sees what they type
      socket.emit('terminal_output', input.replace(/\\n/g, '\\r\\n'));
      pyProcess.stdin.write(input);
    }
  });

  socket.on('kill_python', () => {
    if (processes.has(socket.id)) {
        processes.get(socket.id).kill();
        processes.delete(socket.id);
        socket.emit('terminal_output', '\\r\\n\\x1b[31m--- Process Killed ---\\x1b[0m\\r\\n');
    }
  });

  socket.on('disconnect', () => {
    console.log(`[-] Client disconnected: ${socket.id}`);
    if (processes.has(socket.id)) {
      processes.get(socket.id).kill();
      processes.delete(socket.id);
    }
  });
});

const PORT = 4000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Python Runner Server started on http://localhost:${PORT}`);
  console.log(`Accepting WebSocket connections for terminal...`);
});
