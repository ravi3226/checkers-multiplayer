import mongoose from 'mongoose';
import { Server, Socket } from 'socket.io'
import { RegisterNewGameWithPlayer } from '../config/game.config.js';
import { setRedis } from '../config/redis.config.js';
import { TokenStatus } from '../config/user.config.js';
import { registerNewPlayerForGame, reverseGameBoard } from '../helpers/game.helper.js';
import { validateAuthToken } from '../middlewares/user.middleware.js';
import { Game } from '../models/game.model.js';
import { redisSetKeyValue } from '../services/redis.service.js';

export const findGame = async (gameId: mongoose.Types.ObjectId) : Promise<any> => {
    return new Promise(async (resolve, reject) => {
        try {
            const existingGame = await Game.findById(gameId).populate({
                path: 'player1',
                populate: {
                    path: 'userId'
                }
            }).populate({
                path: 'player2',
                populate: {
                    path: 'userId'
                }
            })

            if (existingGame) {
                resolve({
                    success: true,
                    game: existingGame
                })
            } else {
                reject({
                    success: false,
                    message: 'invalid gameId'
                })
            }
        } catch(e) {
            reject({
                success: false,
                message: e.message
            })
        }
    }) 
}

export const createGame = async (io: Server, socket: Socket, payload) : Promise<void> => {
    /**
     * validate the user by JWT token authentication
     */
    validateAuthToken(payload.token, socket.id)
    .then(async ( tokenValidate: TokenStatus ) : Promise<void> => {
        if ( !tokenValidate.validate ) {
            socket.emit('game:create:fail', {
                token: [tokenValidate.message]
            })
        } else {
            /**
             * get the requesting user and all the online user waiting to play the game
             */
            const userId = tokenValidate.id;
            const onlineUsersSocketIds = Array.from(io.sockets.adapter.sids.keys())


            /**
             * register new player and check if game can be start with other player
             */
            const registerNewGameWithPlayer : RegisterNewGameWithPlayer = await registerNewPlayerForGame(new mongoose.Types.ObjectId(userId), onlineUsersSocketIds)

            if ( registerNewGameWithPlayer.success ) {
                
                if ( registerNewGameWithPlayer.waiting ) {
                    socket.emit('game:create:success', {
                        waiting: true,
                        player1: registerNewGameWithPlayer.newGameBoard.player1,
                        player2: registerNewGameWithPlayer.newGameBoard.player2,
                        board: registerNewGameWithPlayer.newGameBoard.board
                    })

                } else {
                    try {
                        /**
                         * store game on redis to make updation of game play faster
                         * NOTE: rest of the logic will the all positions on a single move, avoiding $pull and $push on mongoDB
                         */
                        const gameOnRedis: setRedis = await redisSetKeyValue(registerNewGameWithPlayer.gameId, {
                            player1: registerNewGameWithPlayer.newGameBoard.player1,
                            player2: registerNewGameWithPlayer.newGameBoard.player2,
                            board: registerNewGameWithPlayer.newGameBoard.board
                        }, true);

                        if (gameOnRedis.success) {
                            
                            /**
                             * player can start playing game
                             */
                            socket.emit('game:create:success', {
                                waiting: false,
                                player1: registerNewGameWithPlayer.newGameBoard.player2,
                                player2: registerNewGameWithPlayer.newGameBoard.player1,
                                board: reverseGameBoard(registerNewGameWithPlayer.newGameBoard.board),
                                gameId: registerNewGameWithPlayer.gameId,
                                expiresAt: registerNewGameWithPlayer.expiresAt
                            })

                            /**
                             * reverse board object for other player
                             * let other waiting player knows that he got match and can play game now
                             */
                            socket.to(registerNewGameWithPlayer.oponentSocketId).emit('game:create:success', {
                                waiting: false,
                                player1: registerNewGameWithPlayer.newGameBoard.player1,
                                player2: registerNewGameWithPlayer.newGameBoard.player2,
                                board: registerNewGameWithPlayer.newGameBoard.board,
                                gameId: registerNewGameWithPlayer.gameId,
                                expiresAt: registerNewGameWithPlayer.expiresAt
                            })
                        } else {
                            socket.emit('game:create:fail', {
                                general: [`failed storing value on redis :: game:controller`]
                            })
                        }
                    } catch(e) {
                        socket.emit('game:create:fail', {
                            general: [`failed redis : ${e.message}`]
                        })
                        
                    }

                }

            } else {
                socket.emit('game:create:fail', {
                    general: [registerNewGameWithPlayer.message]
                })
            }
        }
    }).catch(( e: Error ) : void => {
        socket.emit('game:create:fail', {
            general: [e.message]
        })
    })
}