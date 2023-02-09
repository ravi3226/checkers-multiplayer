import mongoose from "mongoose";
import { Server, Socket } from "socket.io";
import { PossibleMove } from "../config/game.config.js";
import { getRedis, setRedis } from "../config/redis.config.js";
import { TokenStatus } from "../config/user.config.js";
import { errorCodes } from "../helpers/error.helper.js";
import { findPossibleMove, validatePosition } from "../helpers/game.helper.js";
import { validateAuthToken } from "../middlewares/user.middleware.js";
import { Game } from "../models/game.model.js";
import { Player } from "../models/player.model.js";
import { redisGetKeyValue, redisSetKeyValue } from "../services/redis.service.js";
import { findGame } from "./game.controller.js";

export const getPossibleMove = async (io: Server, socket: Socket, payload: any) : Promise<void> => {
    validateAuthToken(payload.token, socket.id)
    .then(async ( tokenValidate: TokenStatus ) : Promise<void> => {

        /**
         * validate token and gameId
         */
        const errors = {
            token: [],
            gameId: [],
            position: []
        }
        if ( !tokenValidate.validate ) errors.token.push(tokenValidate.message);
        if ( !payload.gameId || payload.gameId === '') errors.gameId.push('gameId is required.')
        if ( !payload.position || payload.position === '') errors.position.push('position is required.')
        else if (!validatePosition(payload.position)) errors.position.push('Invalid position.')

        if (
            errors.token.length > 0 ||
            errors.gameId.length > 0 ||
            errors.position.length > 0
        ) {
            Object.keys(errors).forEach((key) => {
                if (errors[key].length < 1) delete errors[key];
            })
            socket.emit('player:move-possible:fail', errors);
        } else {
            
            /**
             * get game info
             */
            try {
                const foundGame = await findGame(new mongoose.Types.ObjectId(payload.gameId))
                
                if ( foundGame.success ) {
                    var this_player = null;
                    var other_player = null;

                    ['player1', 'player2'].forEach(player_title => {
                        if (foundGame.game[player_title].userId.id.toString() == tokenValidate.id.toString()) this_player = foundGame.game[player_title];
                        else other_player = foundGame.game[player_title];
                    })

                    

                    /**
                     * decide normal direction for requesting player is forward or back side
                     */
                    var playerType : string = 'player1';
                    var otherPlayerType : string = 'player2';
                    if ( new Date(this_player.createdAt) > new Date(other_player.createdAt) ) {
                        playerType = 'player2';
                    }
                    if ( new Date(this_player.createdAt) > new Date(other_player.createdAt) ) {
                        otherPlayerType = 'player1';
                    }

                    try {
                        /**
                         * get latest gameplay state from redis
                         */
                        const redisGame = await redisGetKeyValue(foundGame.game.id, true);

                        if (redisGame.success) {
                            /**
                             * validation position on board
                             */
                            if (!Object.keys(redisGame.value[playerType]).includes(payload.position)) {
                                socket.emit('player:move-possible:fail', {
                                    position: `player does not have access over position: ${payload.position}`
                                })
                            } else {
                                /**
                                 * get all possible moves
                                 */
                                const allPossibleMoves = findPossibleMove({ 
                                    position: payload.position,
                                    playerType: (playerType === 'player1' ? 1 : 2),
                                    game: redisGame.value,
                                    positionType: (redisGame.value[playerType][payload.position] === 'normal' ? 1 : 2)
                                })

                                socket.emit('player:move-possible:success', allPossibleMoves);
                            }

                        } else {
                            socket.emit('player:move-possible:fail', redisGame)
                        }

                    } catch(e) {
                        console.log(e.stack);
                        socket.emit('player:move-possible:fail', {
                            general: [e.message]
                        })
                    }

                } else {
                    socket.emit('player:move-possible:fail', {
                        gameId: ['invalid gameId']
                    })
                }
            } catch(e) {
                socket.emit('player:move-possible:fail', {
                    general: [`fail finding game: ${e.message}`]
                })
            }
        }


    }).catch((e : Error) : void => {
        socket.emit('token:refresh:fail', {
            general: [e.message]
        })
        socket.emit('player:move-possible:fail', {
            general: [`failed token validation : ${e.message}`],
            code: errorCodes.invalid_token
        })
    })
}

export const moveTile = async (io: Server, socket: Socket, payload: any) : Promise<void> => {
    validateAuthToken(payload.token, socket.id)
    .then(async ( tokenValidate: TokenStatus ) : Promise<void> => {

        /**
         * validate token and gameId
         */
        const errors = {
            token: [],
            gameId: [],
            from: [],
            to: []
        }
        if ( !tokenValidate.validate ) errors.token.push(tokenValidate.message);
        if ( !payload.gameId || payload.gameId === '') errors.gameId.push('gameId is required.')

        if ( !payload.from || payload.from === '') errors.from.push('from is required.')
        else if (!validatePosition(payload.from)) errors.from.push('Invalid position.')

        if ( !payload.to || payload.to === '') errors.to.push('to is required.')
        else if (!validatePosition(payload.to)) errors.to.push('Invalid position.')

        if (
            errors.token.length > 0 ||
            errors.gameId.length > 0 ||
            errors.from.length > 0 ||
            errors.to.length > 0
        ) {
            Object.keys(errors).forEach((key) => {
                if (errors[key].length < 1) delete errors[key];
            })
            socket.emit('player:move:fail', errors);
        } else {
            
            /**
             * get game info
             */
            try {
                const foundGame = await findGame(new mongoose.Types.ObjectId(payload.gameId))

                /**
                 * decide which player is requesting.
                 */
                var this_player = null;
                var other_player = null;

                if (foundGame.success) {
                    ['player1', 'player2'].forEach(player_title => {
                        if (foundGame.game[player_title].userId.id == tokenValidate.id) this_player = foundGame.game[player_title];
                        else other_player = foundGame.game[player_title];
                    })
    
                    /**
                     * decide normal direction for requesting player is forward or back side
                     */
                    var playerType : string = 'player1';
                    var otherPlayerType : string = 'player2';
                    if ( new Date(this_player.createdAt) > new Date(other_player.createdAt) ) {
                        playerType = 'player2';
                    }
                    if ( new Date(this_player.createdAt) > new Date(other_player.createdAt) ) {
                        otherPlayerType = 'player1';
                    }
                }

                /**
                 * check -> game is over or not.
                 */
                if (foundGame.success && foundGame.game.isOver) {

                    socket.emit('game:over:success', foundGame.game);
                    io.to(foundGame.game[otherPlayerType].userId.socketId).emit('game:over:success', foundGame.game);

                } else if ( foundGame.success ) {

                    if ( this_player.turn ) {

                        try {
                            /**
                             * get latest gameplay state from redis
                             */
                            const redisGame : getRedis = await redisGetKeyValue(foundGame.game.id, true);

                            if (redisGame.success) {
                                /**
                                 * validation position on board
                                 */
                                if (!Object.keys(redisGame.value[playerType]).includes(payload.from)) {

                                    socket.emit('player:move:fail', {
                                        from: [`player does not have access over 'from': ${payload.from}`]
                                    })
                                } else {
                                    /**
                                     * get all possible moves
                                     */
                                    const allPossibleMoves : PossibleMove[] = findPossibleMove({ 
                                        position: payload.from,
                                        playerType: (playerType === 'player1' ? 1 : 2),
                                        game: redisGame.value,
                                        positionType: (redisGame.value[playerType][payload.position] === 'normal' ? 1 : 2)
                                    })

                                    var allPossibleMovesInArray : string[] = []

                                    allPossibleMoves.forEach(move => {
                                        allPossibleMovesInArray.push(move.jumpTo);
                                        if (move.jumpTo2) allPossibleMovesInArray.push(move.jumpTo2);
                                    })

                                    /**
                                     * check player is moving on right prosition
                                     */
                                    if (!allPossibleMovesInArray.includes(payload.to)) {
                                        socket.emit('player:move:fail', {
                                            to: [`player does not have access over 'to': ${payload.to}`]
                                        })
                                    } else {
                                        /**
                                         * payload validation has completed, {token, gameId, from, to}
                                         * actual logic is below
                                         */
                                        var updateGame = redisGame.value;

                                        /**
                                         * verify -> is this move is kill or normal move
                                         * right now limit is set to 2 step jump only in the logic
                                         * below logic implies according to 2 steps check
                                         */
                                        var kills = []
                                        allPossibleMoves.forEach((move: PossibleMove) => {
                                            if (move.from === payload.from && move?.kill && move?.jumpTo === payload.to) {
                                                kills.push(move.kill[0])
                                            } else if (move.from === payload.from && move?.kill && move?.jumpTo2 === payload.to) {
                                                kills.push(...move.kill)
                                            }
                                        })

                                        /**
                                         * remove kill positions and moved positions on other player's positions list
                                         * update kills, loses and moved positions in database
                                         */
                                        if (kills.length > 0) {
                                            kills.forEach(kill => {
                                                if ( updateGame[otherPlayerType][kill] ) delete updateGame[otherPlayerType][kill];
                                                else throw new Error("failed removing kill position on otherplayer's positions list :: logic wrong.");
                                            })
                                        }
                                        
                                        var border = '8';
                                        if (playerType == 'player2') border = '1'

                                        if (payload.to[1] === border && updateGame[playerType][payload.from] !== 'king')  {
                                            updateGame[playerType][payload.to] = 'king';
                                        } else {
                                            updateGame[playerType][payload.to] = updateGame[playerType][payload.from]
                                        }
                                        delete updateGame[playerType][payload.from];

                                        /**
                                         * update on redis
                                         */
                                        try {
                                            const updateRedisGame : setRedis = await redisSetKeyValue(foundGame.game.id, updateGame, true);

                                            if ( updateRedisGame.success ) {
                                                
                                                /**
                                                 * update in database
                                                 */
                                                var update = {
                                                    $set: {
                                                        normal_positions: Object.keys(updateGame[playerType]).filter(position => updateGame[playerType][position] === 'normal'),
                                                        king_positions: Object.keys(updateGame[playerType]).filter(position => updateGame[playerType][position] === 'king'),
                                                        turn: foundGame.game[playerType].turn ? false : true
                                                    }
                                                }

                                                if (kills.length > 0) update.$set['killed'] = [...foundGame.game[playerType].killed, ...kills]

                                                try {
                                                    /**
                                                     * update the player is moving tiles
                                                     */
                                                    const updateThisPlayer = await Player.findByIdAndUpdate(foundGame.game[playerType].id, update, { new: true });

                                                    if (updateThisPlayer) {

                                                        /**
                                                         * if there is any kill happened then we need to update other players positions too.
                                                         */
                                                        if (kills.length > 0) {

                                                            delete update.$set['killed'];
                                                            update.$set['lose'] = [...foundGame.game[otherPlayerType].lose, ...kills]

                                                        } else {
                                                            global.logger.info(`there is no killed by ${foundGame.game[playerType].id}`)
                                                        }

                                                        update.$set['normal_positions'] = Object.keys(updateGame[otherPlayerType]).filter(position => updateGame[otherPlayerType][position] === 'normal')
                                                        update.$set['king_positions'] = Object.keys(updateGame[otherPlayerType]).filter(position => updateGame[otherPlayerType][position] === 'king')
                                                        update.$set['turn'] = foundGame.game[otherPlayerType].turn ? false : true;

                                                        /**
                                                         * update other player
                                                         */
                                                        try {
                                                            const updateOtherPlayer = await Player.findByIdAndUpdate(foundGame.game[otherPlayerType].id, update, { new: true})

                                                            if (updateOtherPlayer) {

                                                                var response = {}
                                                                response['from'] = payload.from;
                                                                response['to'] = payload.to;

                                                                if (kills.length > 0) {
                                                                    response['killed'] = kills;

                                                                    if ( Object.keys(updateGame[otherPlayerType]).length < 1 ) {
                                                                        try {

                                                                            const game = await Game.findOneAndUpdate({
                                                                                [playerType]: new mongoose.Types.ObjectId(updateThisPlayer.id)
                                                                            }, { isOver: true }, { new: true }).populate(['player1', 'player2']);

                                                                            if (game && game.isOver) {
                                                                                socket.emit('game:over:success', game);
                                                                                io.to(foundGame.game[otherPlayerType].userId.socketId).emit('game:over:success', response);
                                                                            }

                                                                        } catch(e) {
                                                                            socket.emit('game:over:fail', {
                                                                                general: [`failed updating game over state : ${e.message}`]
                                                                            })
                                                                        }
                                                                    }
                                                                }

                                                                socket.emit('player:move:success', response)

                                                                /**
                                                                 * check if other player has left or not
                                                                 */
                                                                const onlinePlayers = Array.from(io.sockets.adapter.sids.keys())
                                                                if (!onlinePlayers.includes(foundGame.game[otherPlayerType].userId.socketId)) {
                                                                    socket.emit('user:left', {
                                                                        otherPlayer: foundGame.game[otherPlayerType].userId.email
                                                                    })
                                                                } else {
                                                                    io.to(foundGame.game[otherPlayerType].userId.socketId).emit('player-other:move:success', response);
                                                                    socket.emit('player:move:success', response);
                                                                }

                                                            } else {
                                                                global.logger.info('failed updation on other player')
                                                                socket.emit('player:move:fail', {
                                                                    general: ['failed other player updation']
                                                                })
                                                            }

                                                        } catch(e) {
                                                            socket.emit('player:move:fail', {
                                                                general: [`failed updation on otherplayer :: ${e.message}`]
                                                            })
                                                        }

                                                    } else {
                                                        socket.emit('player:move:fail', {
                                                            general: [`failed updating thisPlayer : ${updateThisPlayer}`]
                                                        })
                                                    }

                                                } catch(e) {
                                                    socket.emit('player:move:fail', {
                                                        general: [`failed updation of player1 :: ${e.message}`]
                                                    })
                                                }

                                            } else {
                                                socket.emit('player:move:fail', {
                                                    general: [`redis failed : ${updateRedisGame.message}`]
                                                })
                                            }
                                        } catch(e) {
                                            socket.emit('player:move:fail', {
                                                general: [`redis failed : ${e.message}`]
                                            })
                                        }
                                    }
                                }

                            } else {
                                socket.emit('player:move:fail', {
                                    general: [redisGame.message]
                                })
                            }

                        } catch(e) {
                            socket.emit('player:move:fail', {
                                general: [e.message]
                            })
                        }
                    } else {
                        socket.emit('player:move:fail', {
                            general: [`not your turn`]
                        })
                    }

                } else {
                    socket.emit('player:move:fail', {
                        gameId: ['invalid gameId']
                    })
                }
            } catch(e) {
                socket.emit('player:move:fail', {
                    general: [`fail finding game: ${e.message}`]
                })
            }
        }


    }).catch((e : Error) : void => {
        socket.emit('token:refresh:fail', {
            general: [e.message]
        })
        socket.emit('player:move:fail', {
            general: [`failed token validation : ${e.message}`],
            code: errorCodes.invalid_token
        })
    })
}