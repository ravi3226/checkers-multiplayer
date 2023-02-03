import express, { HttpServer } from 'express'
import { Server as SocketServer, Socket } from 'socket.io'
import { createServer } from 'http'
import { connectToRedis } from './services/redis.service.js'
import { connectToDatabase } from './services/database.service.js'
import { serverConfig } from './config/server.config.js'
import { loginUser, refreshToken, registerUser } from './controllers/user.controller.js'
import * as PinoLogger from 'pino';
import { instrument } from '@socket.io/admin-ui'

import {dirname, join} from 'path'
import { fileURLToPath } from 'url';
import { createGame } from './controllers/game.controller.js'
import { getPossibleMove, moveTile } from './controllers/player.controller.js'


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * register logger for development env...
 */
const logger = PinoLogger.pino();
global.logger = logger;

connectToRedis().then(() => {
    connectToDatabase().then(() => {
        const app = express()

        const httpServer: HttpServer = createServer(app);
        const io: SocketServer = new SocketServer(httpServer, {
            cors: {
              origin: ["http://localhost:3000", "https://admin.socket.io"],
              credentials: true
            }
        });
    
        io.on('connection', (socket: Socket) => {
            logger.info(`new socket connection : ${socket.id}`);
            socket.on('user:register', (payload) => registerUser(io, socket, payload))
            socket.on('user:login', (payload) => loginUser(io, socket, payload))
            socket.on('token:refresh', (payload) => refreshToken(io, socket, payload))
            socket.on('game:create', async (payload) => await createGame(io, socket, payload))
            socket.on('player:move-possible', async (payload) => await getPossibleMove(io, socket, payload))
            socket.on('player:move', async (payload) => moveTile(io, socket, payload))
        })

        instrument(io, {
            auth: false,
            readonly: true
        });
    
    
        httpServer.listen(serverConfig.port, () => {
            logger.info(`Server is running on port : ${serverConfig.port}`);
        });
    }).catch((e: Error) => {
        /**
         * project manager should get message via email
         */
        logger.info(e.message);
    })
}).catch((e: Error) => {
    /**
     * project manager should get message via email
     */
    logger.info(e.message)
})