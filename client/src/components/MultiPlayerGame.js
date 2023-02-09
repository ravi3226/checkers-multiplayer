import { Container, Grid, Paper } from '@mui/material'
import React from 'react'
import ShowMessage from './ShowMessage';
import LoadingButton from '@mui/lab/LoadingButton';
import AvTimerIcon from '@mui/icons-material/AvTimer';
import Countdown from 'react-countdown';

const MultiPlayerGame = ({socket}) => {

    const [open, setOpen] = React.useState(false);
    const [message, setMessage] = React.useState('');

    const [gameBoard, setGameBoard] = React.useState(null);
    const [player1Tiles, setPlayer1Tiles] = React.useState(null);
    const [player2Tiles, setPlayer2Tiles] = React.useState(null);
    const [targeted, setTargeted] = React.useState(null);
    const [possibleMove, setPossibleMove] = React.useState([]);
    const [expiresAt, setExpiresAt] = React.useState(null);
    const [isWaiting, setIsWaiting] = React.useState(true);

    const positionClick = (e, position) => {

        if (typeof player1Tiles == 'object' && Object.keys(player1Tiles).includes(position)) {
            socket.emit('player:move-possible', {
                position: position,
                token: localStorage.getItem('auth_token'),
                gameId: localStorage.getItem('gameId')
            });
            
            setTargeted(position)
        } else if (possibleMove.includes(position)) {
            socket.emit('player:move', {
                token: localStorage.getItem('auth_token'),
                gameId: localStorage.getItem('gameId'),
                from: targeted,
                to: position
            })
            setPossibleMove([]);
            setTargeted(null);
        } else {
            console.log('cant move this position')
        }
    }

    const showMessage = (message) => {
        setOpen(true);
        setMessage(message);
    }

    const movePlayer1Tile = (from, to) => {
        setPlayer1Tiles(positions => {
            let newPositions = {}

            newPositions[to] = positions[from];
            Object.keys(positions).forEach(position => {
                if ( position !== from ) newPositions[position] = positions[position];
            })
            
            return newPositions;
        })
    }
    const movePlayer2Tile = (from, to) => {
        setPlayer2Tiles(positions => {
            let newPositions = {}

            newPositions[to] = positions[from];
            Object.keys(positions).forEach(position => {
                if ( position !== from ) newPositions[position] = positions[position];
            })

            return newPositions;
        })
    }

    const removeKilledOne = (killed, loseOrKilled) => {
        if (!Array.isArray(killed)) {
            throw new Error('killed is not an array.')
        } else {
            if (loseOrKilled) {
                setPlayer2Tiles(positions => {
                    let newPositions = {}
    
                    Object.keys(positions).forEach(position => {
                        if (!killed.includes(position)) newPositions[position] = positions[position]
                    })
    
                    return newPositions;
                })
            } else {
                setPlayer1Tiles(positions => {
                    let newPositions = {}
    
                    Object.keys(positions).forEach(position => {
                        if (!killed.includes(position)) newPositions[position] = positions[position]
                    })
    
                    return newPositions;
                })
            }
        }
    }


    React.useEffect(() => {

        function initGameWithBot() {
            socket.on('game:over:success', (payload) => {
                console.log(payload);
                alert('game is over')
            })
            socket.on('player:move:success', (payload) => {
                movePlayer1Tile(payload.from, payload.to)

                if (payload.killed) removeKilledOne(payload.killed, true)
            })
            socket.on('player-other:move:success', (payload) => {
                movePlayer2Tile(payload.from, payload.to)

                if (payload.killed) removeKilledOne(payload.killed, false);
            })

            socket.on('player:move:fail', (payload) => {
                console.log(payload)
            })
            
            socket.on('player:move-possible:success', (payload) => {
                console.log(payload)
                let moves = [];
                if (Array.isArray(payload)) {
                    payload.forEach(move => {
                        if (move.jumpTo2) moves.push(move.jumpTo2)
                        else moves.push(move.jumpTo);
                    })
                }

                setPossibleMove(moves);
            })

            socket.on('player:move-possible:fail', (payload) => {
                console.log(payload)
            })

            socket.on('game:create:success', (payload) => {
                if (payload.expiresAt) {
                    const endTime = new Date(payload.expiresAt);
                    const startTime = new Date();

                    var seconds = (endTime.getTime() - startTime.getTime()) / 1000;

                    setExpiresAt(seconds)
                }
                setIsWaiting(payload.waiting)
                setPlayer1Tiles(payload.player1)
                setPlayer2Tiles(payload.player2)
                setGameBoard(payload)
                if (payload.gameId) localStorage.setItem('gameId', payload.gameId)
                else localStorage.removeItem('gameId')
            })

            socket.on('game:create:fail', (payload) => {
                showMessage(payload?.general[0])
            })

            socket.emit('game:create', {
                token: localStorage.getItem('auth_token')
            })
        }
        
        socket.on('connect', () => {
            initGameWithBot()
        })
        return () => {
            if (socket.connected) initGameWithBot();
        }
    }, [socket])

  return (
    <Container style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', flexDirection: 'column', alignContent: 'center', alignItems: 'center' }}>
        <LoadingButton
            loading={isWaiting}
            loadingPosition="start"
            startIcon={<AvTimerIcon />}
            variant="outlined"
        >
            {isWaiting ? 'wait please..' : <Countdown date={Date.now() + 1000 * 60 * 10} />}
        </LoadingButton>
        <Grid sx={{
            backgroundColor: "#E8D2A6"
        }} maxWidth="916px" maxHeight="916px" container spacing={0}>
            {gameBoard && Object.keys(gameBoard.board).map((position) => (
                <Grid item key={position}>
                    <Paper 
                        className="position"
                        variant="outlined" 
                        style={{
                            width: '112.5px',
                            height: '112.5px',
                            backgroundColor: `${gameBoard.board[position]}`,
                            display: 'flex',
                            alignItems: 'center', 
                            justifyContent: 'center',
                            color: 'white',
                            userSelect: 'none',
                            cursor: 'pointer',
                            opacity: possibleMove.includes(position) ? 0 : 1
                        }} 
                        onClick={(e) => positionClick(e, position)} 
                        square 
                        id={position} 
                    >
                        {player1Tiles[position] ? player1Tiles[position] === 'normal' ? <img src="/images/player_tile.png" alt={position} /> : <img src="/images/player_tile_king.png" alt={position} /> : ''}
                        {player2Tiles[position] ? player2Tiles[position] === 'normal' ? <img src="/images/bot_tile.png" alt={position} /> : <img src="/images/bot_tile_king.png" alt={position} /> : ''}
                    </Paper>
                </Grid>
            ))}
        </Grid>
        <ShowMessage open={open} message={message} setOpen={setOpen} />
    </Container>
  )
}

export default MultiPlayerGame