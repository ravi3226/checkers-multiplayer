import mongoose from "mongoose";
import { GameBoard, horizontal__tiles, PositionType, RedisGameBoard, RegisterNewGameWithPlayer, vertical__tiles } from "../config/game.config.js";
import { Game } from "../models/game.model.js";
import { Player } from "../models/player.model.js";
import { addMinutes } from "./util.helper.js";

/**
 * all 4 directions configure according to the function signature named 'findCross'
 */
export const directionConfig = {
    leftForward: { forwardOrBack: false, leftOrRight: false },
    rightForward: { forwardOrBack: false, leftOrRight: true },
    rightBack: { forwardOrBack: true, leftOrRight: true },
    leftBack: { forwardOrBack: true, leftOrRight: false }
}

/**
 * validates given position even exist on board or not
 */
export const validatePosition = (position: string) => {
    try {
        const firstLetter : string = position[0];
        const secondLetter : string = position[1];

        if(!horizontal__tiles.includes(firstLetter) || !vertical__tiles.includes(secondLetter)) {
            return false;
        }
        return true;
    } catch(e) {
        return false;
    }
}

/**
 * creates new game board within both players positions
 */
export const createGameBoard = () : GameBoard => {
    var board = {};
    var player1 = {};
    var player2 = {};

    vertical__tiles.forEach((v, v_index) => {
        let black = v_index%2 == 0 ? true : false;
        horizontal__tiles.forEach((h, h_index) => {
            board[h + v] = black ? "#FF6E31" : "#F0997D";

            if( v_index >= vertical__tiles.length - 3 ) {
                if(!black) { player1[h + v] = "normal"; }
            } else if( v_index <= 2 ) {
                if(!black) { player2[h + v] = "normal"; }
            }

            black = !black;
        })
    })

    return {
        board,
        player1,
        player2
    }
}

/**
 * finds any player with waiting state
 * found: register new game with referenced by both player within waiting state 'false'
 * notFound: register new Player for ready to play within waiting state 'false'
 */
export const registerNewPlayerForGame = async (userId: mongoose.Types.ObjectId, onlineUsers: string[]) : Promise<RegisterNewGameWithPlayer> => {
    return new Promise(async (resolve, reject) => {
        try {
            /**
             * create game board with both player positions
             */
            const newGameBoard : GameBoard = createGameBoard();

            /**
             * check user is already is in waiting state
             */
            const isPlayerAlreadyWaiting = await Player.findOne({
                $and: [
                    { userId: { $eq: userId } },
                    { waiting: true }
                ]
            });

            if (isPlayerAlreadyWaiting) {
                resolve({
                    success: true,
                    waiting: true,
                    newGameBoard: newGameBoard
                })
            } else {

                try {
                    /**
                     * find all the players who's waiting
                     */
                    const waitingPlayers = await Player.find({ 
                        $and: [
                            { waiting: true },
                            { userId: { $ne: userId } }
                        ]
                    }).populate('userId');

                    var onlineWaitingPlayer = null;
                    

                    if (waitingPlayers && waitingPlayers.length > 0) {
                        /**
                         * filter any one is online right now
                         */
                        onlineWaitingPlayer = waitingPlayers.filter((player) => onlineUsers.includes(player.userId.socketId))[0]
                    }

                    /**
                     * already one user is waiting for play -> create user with waiting state false
                     * no user is waiting -> create user with waiting state true
                     */
                    var newPlayer = {}

                    if (onlineWaitingPlayer) {   
                        try {
                            const updateWaitingPlayer = await Player.findByIdAndUpdate(onlineWaitingPlayer.id, {
                                waiting: false
                            }, { new: true });
    
                            if (updateWaitingPlayer) {
                                newPlayer['userId'] = userId
                                newPlayer['normal_positions'] = Object.keys(newGameBoard.player2)
                                newPlayer['king_positions'] = []
                                newPlayer['killed'] = []
                                newPlayer['lose'] = []
                                newPlayer['waiting'] = false
                            } else {
                                reject({
                                    success: false,
                                    message: 'failed updating waiting player'
                                })
                            }
                        } catch(e) {
                            reject({
                                success: false,
                                message: `failed updating waiting player : ${e.message}`
                            })
                        }
                    } else {
                        newPlayer['userId'] = userId;
                        newPlayer['normal_positions'] = Object.keys(newGameBoard.player1);
                        newPlayer['king_positions'] = []
                        newPlayer['killed'] = []
                        newPlayer['lose'] = []
                        newPlayer['waiting'] = true
                    }

                    try {
                        const insertPlayer = await Player.create(newPlayer);

                        if (insertPlayer) {
                            if (onlineWaitingPlayer) {
                                try {
                                    /**
                                     * register game with both ready player
                                     */
                                    const registerGame = await Game.create({
                                        player1: onlineWaitingPlayer.id,
                                        player2: insertPlayer.id,
                                        expiresAt: addMinutes(new Date(), 10)
                                    })
            
                                    if (registerGame) {
                                        resolve({
                                            success: true,
                                            waiting: false,
                                            gameId: registerGame.id,
                                            newGameBoard: newGameBoard,
                                            oponentSocketId: onlineWaitingPlayer.userId.socketId
                                        })
                                    } else {
                                        reject({
                                            success: false,
                                            message: 'failed registering new game'
                                        })
                                    }
            
                                } catch(e) {
                                    reject({
                                        success: false,
                                        message: `failed registering new game : ${e.message}`
                                    })
            
                                }

                            } else {
                                resolve({
                                    success: true,
                                    waiting: true,
                                })
                            }

                        } else {
                            reject({
                                success: false,
                                message: 'failed new player insertion.'
                            })

                        }

                    } catch(e) {
                        reject({
                            success:false,
                            message: `failed creating new player : ${e.message}`
                        })

                    }

                } catch(e) {
                    reject({
                        success: false,
                        message: `failed getting all wating player : ${e.message}`
                    })
                }
            }

        } catch(e) {
            reject({
                success: false,
                message: `finding request player with waiting state failed : ${e.message}`
            })
            
        }
    })
}

/**
 * reverse the board object 
 * e.g -> { "A8": 'white', "A9": "black" } -> { "A9": "black", "A8": 'white' }
 */
export const reverseGameBoard = (board: object) : object => {
    var reverseBoard = {}
    Object.keys(board).reverse().forEach((key) => {
        reverseBoard[key] = board[key];
    })

    return reverseBoard;
}

/**
 * find out cross tile based on directions and steps
 */
export const findCross = ({
        position, 
        forwardOrBack = false, 
        leftOrRight = false, 
        steps = 1
    } : {
        position: string,
        forwardOrBack?: boolean,
        leftOrRight?: boolean,
        steps?: number
    }) : string | null => {
    if (!validatePosition(position)) throw new Error(`position is not valid : ${position}`);
    const firstLetter : string = position[0];
    const secondLetter : string = position[1];

    const asciiValueOfFirst = firstLetter.charCodeAt(0);
    const numberValueOfSecond = parseInt(secondLetter);

    if(leftOrRight) {
        if (!forwardOrBack) {
            if(!vertical__tiles.includes((numberValueOfSecond + steps).toString()) || !horizontal__tiles.includes(String.fromCharCode(asciiValueOfFirst - steps))) {
                return null
            } else {
                return String.fromCharCode(asciiValueOfFirst - steps) + (numberValueOfSecond + steps).toString()
            }
        }
        else {
            if(!vertical__tiles.includes((numberValueOfSecond - steps).toString()) || !horizontal__tiles.includes(String.fromCharCode(asciiValueOfFirst - steps))) {
                return null
            } else {
                return String.fromCharCode(asciiValueOfFirst - steps) + (numberValueOfSecond - steps).toString()
            }
        }
    } else {
        if (!forwardOrBack) {
            if(!vertical__tiles.includes((numberValueOfSecond + steps).toString()) || !horizontal__tiles.includes(String.fromCharCode(asciiValueOfFirst + steps))) {
                return null
            } else {
                return String.fromCharCode(asciiValueOfFirst + steps) + (numberValueOfSecond + steps).toString()
            }
        }
        else {
            if(!vertical__tiles.includes((numberValueOfSecond - steps).toString()) || !horizontal__tiles.includes(String.fromCharCode(asciiValueOfFirst + steps))) {
                return null
            } else {
                return String.fromCharCode(asciiValueOfFirst + steps) + (numberValueOfSecond - steps).toString()
            }
        }
    }
}

/**
 * get all possible move
 */
export const findPossibleMoves = (position: string, game: RedisGameBoard, maximum: number, realOrBot: boolean) : string[] => {
    if ( !realOrBot && game.realPlayer[position] ) {
        var possible = []
        var findKillPositions : string[] = [];
        var findPossiblePositions : string[] = [];

        let kills : null | string[] = null;
        if ( game.realPlayer[position] === 'normal' ) {
            kills = findKillMoves(position, game, 1, false);
        } else if ( game.realPlayer[position] === 'king' ) {
            kills = findKillMoves(position, game, 2, false);
        } else {
            throw new Error("unknown position_type")
        }

        if(kills) findKillPositions.push(...kills);

        /**
         * if there is any kill possible -> push it to possible
         */
        if ( findKillPositions.length > 0 ) {
            possible.push(...findKillPositions);
        }

        /**
         * if we didn't find maximum number of kills
         */
        if ( possible.length < maximum ) {
            let possibleMove : null | string[] = null;
            if ( game.realPlayer[position] === 'normal' ) {
                possibleMove = findAnyPossibleMoves(position, game, 1, false);
            } else if ( game.realPlayer[position] === 'king' ) {
                possibleMove = findAnyPossibleMoves(position, game, 2);
            } else {
                throw new Error("unknown position_type")
            }

            if ( possibleMove ) findPossiblePositions.push(...possibleMove);

            /**
             * if there is any kill possible -> push it to possible
             */
            if ( findPossiblePositions.length > 0 ) {
                possible.push(...findPossiblePositions);
            }
        }

        return possible.filter((_, i) => i < maximum);
    } else {
        throw new Error("invalid player position");
    }
}

const canKillPosition = (from, game, realOrNot) => {
    var killed = []
    Object.keys(directionConfig).every((direction) => {
      const jump = findCross({ ...directionConfig[direction], steps: 2, position: from });
      const between = findCross({ ...directionConfig[direction], steps: 1, position: from });
      
      if (realOrNot) {  
        if (game.botPlayer[between] && !game.realPlayer[jump] && !game.botPlayer[jump]) {
          killed.push(between)
        }
      } else {
        if (game.realPlayer[between] && !game.realPlayer[jump] && !game.botPlayer[jump]) {
          killed.push(between)
        }
      }
    })
}

export const findAnyPossibleMoves = (position: string, game: RedisGameBoard, position_type: PositionType, forwardOrBack?: boolean): string[] => {
    var available = []
    if (position_type === 1) {
        if (!forwardOrBack) {
            const rightCross = findCross({ position: position, forwardOrBack: false, leftOrRight: true, steps: 1 })
            const leftCross = findCross({ position: position, forwardOrBack: false, leftOrRight: false, steps: 1 })


            if ( rightCross && !game.realPlayer[rightCross] && !game.botPlayer[rightCross] ) {
                available.push(rightCross)
            }

            if ( leftCross && !game.realPlayer[leftCross] && !game.botPlayer[leftCross] ) {
                available.push(leftCross);
            }
        } else {
            const rightCross = findCross({ position: position, forwardOrBack: true, leftOrRight: true, steps: 1 })
            const leftCross = findCross({ position: position, forwardOrBack: true, leftOrRight: false, steps: 1 })


            if ( rightCross && !game.realPlayer[rightCross] && !game.botPlayer[rightCross] ) {
                available.push(rightCross);
            }

            if ( leftCross && !game.realPlayer[leftCross] && !game.botPlayer[leftCross] ) {
                available.push(leftCross);
            }
        }
    } else if (position_type === 2) {
        const rightForwardCross = findCross({ position: position, forwardOrBack: false, leftOrRight: true, steps: 1 })
        const leftForwardCross = findCross({ position: position, forwardOrBack: false, leftOrRight: false, steps: 1 })
        const leftBackCross = findCross({ position: position, forwardOrBack: true, leftOrRight: false, steps: 1 })
        const rightBackCross = findCross({ position: position, forwardOrBack: true, leftOrRight: true, steps: 1 })


        if ( rightForwardCross && !game.realPlayer[rightForwardCross] && !game.botPlayer[rightForwardCross] ) {
            available.push(rightForwardCross)
        }

        if ( leftForwardCross && !game.realPlayer[leftForwardCross] && !game.botPlayer[leftForwardCross] ) {
            available.push(leftForwardCross)
        }

        if ( leftBackCross && !game.realPlayer[leftBackCross] && !game.botPlayer[leftBackCross] ) {
            available.push(leftBackCross)
        }

        if ( rightBackCross && !game.realPlayer[rightBackCross] && !game.botPlayer[rightBackCross] ) {
            available.push(rightBackCross)
        }
    } else {
        throw new Error('position_type is invalid')
    }
    return available;
}

export const findKillMoves = (position: string, game: RedisGameBoard, position_type: PositionType, forwardOrBack?: boolean, realOrBot: boolean = false) : string[] => {
    var available = []
    if (position_type === 1) {
        if (!forwardOrBack) {
            const rightCrossSecond = findCross({ position: position, forwardOrBack: false, leftOrRight: true, steps: 2 })
            const leftCrossSecond = findCross({ position: position, forwardOrBack: false, leftOrRight: false, steps: 2 })


            if ( rightCrossSecond && !game.realPlayer[rightCrossSecond] && !game.botPlayer[rightCrossSecond] ) {
                const rightCross = findCross({ position: position, forwardOrBack: false, leftOrRight: true, steps: 1 })

                if (!realOrBot) {
                    if ( rightCross && game.botPlayer[rightCross] ) available.push(rightCrossSecond);
                } else {
                    if ( rightCross && game.realPlayer[rightCross] ) available.push(rightCrossSecond);
                }
            }

            if ( leftCrossSecond && !game.realPlayer[leftCrossSecond] && !game.botPlayer[leftCrossSecond] ) {
                const leftCross = findCross({ position: position, forwardOrBack: false, leftOrRight: false, steps: 1 })

                if (!realOrBot) {
                    if ( leftCross && game.botPlayer[leftCross] ) available.push(leftCrossSecond);
                } else {
                    if ( leftCross && game.realPlayer[leftCross] ) available.push(leftCrossSecond);
                }
            }
        } else {
            const rightCrossSecond = findCross({ position: position, forwardOrBack: true, leftOrRight: true, steps: 2 })
            const leftCrossSecond = findCross({ position: position, forwardOrBack: true, leftOrRight: false, steps: 2 })


            if ( rightCrossSecond && !game.realPlayer[rightCrossSecond] && !game.botPlayer[rightCrossSecond] ) {
                const rightCross = findCross({ position: position, forwardOrBack: true, leftOrRight: true, steps: 1 })

                if (!realOrBot) {
                    if ( rightCross && game.botPlayer[rightCross] ) available.push(rightCrossSecond);
                } else {
                    if ( rightCross && game.realPlayer[rightCross] ) available.push(rightCrossSecond);
                }
            }

            if ( leftCrossSecond && !game.realPlayer[leftCrossSecond] && !game.botPlayer[leftCrossSecond] ) {
                const leftCross = findCross({ position: position, forwardOrBack: true, leftOrRight: false, steps: 1 })

                if (!realOrBot) {
                    if ( leftCross && game.botPlayer[leftCross] ) available.push(leftCrossSecond);
                } else {
                    if ( leftCross && game.realPlayer[leftCross] ) available.push(leftCrossSecond);
                }
            }
        }
    } else if (position_type === 2) {
        const rightForwardCrossSecond = findCross({ position: position, forwardOrBack: false, leftOrRight: true, steps: 2 })
        const leftForwardCrossSecond = findCross({ position: position, forwardOrBack: false, leftOrRight: false, steps: 2 })
        const leftBackCrossSecond = findCross({ position: position, forwardOrBack: true, leftOrRight: false, steps: 2 })
        const rightBackCrossSecond = findCross({ position: position, forwardOrBack: true, leftOrRight: true, steps: 2 })


        if ( rightForwardCrossSecond && !game.realPlayer[rightForwardCrossSecond] && !game.botPlayer[rightForwardCrossSecond] ) {
            const rightForwardCross = findCross({ position: position, forwardOrBack: false, leftOrRight: true, steps: 1 })

            if (!realOrBot) {
                if ( rightForwardCross && game.botPlayer[rightForwardCross] ) available.push(rightForwardCrossSecond);
            } else {
                if ( rightForwardCross && game.realPlayer[rightForwardCross] ) available.push(rightForwardCrossSecond);
            }
        }

        if ( leftForwardCrossSecond && !game.realPlayer[leftForwardCrossSecond] && !game.botPlayer[leftForwardCrossSecond] ) {
            const leftForwardCross = findCross({ position: position, forwardOrBack: false, leftOrRight: false, steps: 1 })

            if (!realOrBot) {
                if ( leftForwardCross && game.botPlayer[leftForwardCross] ) available.push(leftForwardCrossSecond);
            } else {
                if ( leftForwardCross && game.realPlayer[leftForwardCross] ) available.push(leftForwardCrossSecond);
            }
        }

        if ( leftBackCrossSecond && !game.realPlayer[leftBackCrossSecond] && !game.botPlayer[leftBackCrossSecond] ) {
            const leftBackCross = findCross({ position: position, forwardOrBack: true, leftOrRight: false, steps: 1 })

            if (!realOrBot) {
                if ( leftBackCross && game.botPlayer[leftBackCross] ) available.push(leftBackCrossSecond);
            } else {
                if ( leftBackCross && game.realPlayer[leftBackCross] ) available.push(leftBackCrossSecond);
            }
        }

        if ( rightBackCrossSecond && !game.realPlayer[rightBackCrossSecond] && !game.botPlayer[rightBackCrossSecond] ) {
            const rightBackCross = findCross({ position: position, forwardOrBack: true, leftOrRight: true, steps: 1 })

            if (!realOrBot) {
                if ( rightBackCross && game.botPlayer[rightBackCross] ) available.push(rightBackCrossSecond);
            } else {
                if ( rightBackCross && game.realPlayer[rightBackCross] ) available.push(rightBackCrossSecond);
            }
        }
    } else {
        throw new Error('position_type is invalid')
    }
    return available;
}