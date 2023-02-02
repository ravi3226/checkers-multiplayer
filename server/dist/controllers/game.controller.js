import mongoose from 'mongoose';
import { registerNewPlayerForGame, reverseGameBoard } from '../helpers/game.helper.js';
import { validateAuthToken } from '../middlewares/user.middleware.js';
import { redisSetKeyValue } from '../services/redis.service.js';
export const createGame = async (io, socket, payload) => {
    validateAuthToken(payload.token, socket.id)
        .then(async (tokenValidate) => {
        if (!tokenValidate.validate) {
            socket.emit('game:create:fail', {
                token: [tokenValidate.message]
            });
        }
        else {
            const userId = tokenValidate.id;
            const onlineUsersSocketIds = Array.from(io.sockets.adapter.sids.keys());
            /**
             * register new player and check if game can be start with other player
             */
            const registerNewGameWithPlayer = await registerNewPlayerForGame(new mongoose.Types.ObjectId(userId), onlineUsersSocketIds);
            if (registerNewGameWithPlayer.success) {
                if (registerNewGameWithPlayer.waiting) {
                    socket.emit('game:create:success', {
                        waiting: true,
                        player1: registerNewGameWithPlayer.newGameBoard.player1,
                        player2: registerNewGameWithPlayer.newGameBoard.player2,
                        board: reverseGameBoard(registerNewGameWithPlayer.newGameBoard.board)
                    });
                }
                else {
                    try {
                        /**
                         * store game on redis to make updation of game play faster
                         * NOTE: rest of the logic will the all positions on a single move, avoiding $pull and $push on mongoDB
                         */
                        const gameOnRedis = await redisSetKeyValue(registerNewGameWithPlayer.gameId, {
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
                                player1: registerNewGameWithPlayer.newGameBoard.player1,
                                player2: registerNewGameWithPlayer.newGameBoard.player2,
                                board: registerNewGameWithPlayer.newGameBoard.board,
                                gameId: registerNewGameWithPlayer.gameId
                            });
                            /**
                             * reverse board object for other player
                             * let other waiting player knows that he got match and can play game now
                             */
                            socket.to(registerNewGameWithPlayer.oponentSocketId).emit('game:create:success', {
                                waiting: false,
                                player2: registerNewGameWithPlayer.newGameBoard.player1,
                                player1: registerNewGameWithPlayer.newGameBoard.player2,
                                board: reverseGameBoard(registerNewGameWithPlayer.newGameBoard.board),
                                gameId: registerNewGameWithPlayer.gameId
                            });
                        }
                        else {
                            socket.emit('game:create:fail', {
                                general: [`failed storing value on redis :: game:controller`]
                            });
                        }
                    }
                    catch (e) {
                        socket.emit('game:create:fail', {
                            general: [`failed redis : ${e.message}`]
                        });
                    }
                }
            }
            else {
                socket.emit('game:create:fail', {
                    general: [registerNewGameWithPlayer.message]
                });
            }
        }
    }).catch((e) => {
        socket.emit('game:create:fail', {
            general: [e.message]
        });
    });
};
//# sourceMappingURL=game.controller.js.map