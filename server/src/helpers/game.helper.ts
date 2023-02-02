import mongoose from "mongoose";
import { GameBoard, horizontal__tiles, RegisterNewGameWithPlayer, vertical__tiles } from "../config/game.config.js";
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