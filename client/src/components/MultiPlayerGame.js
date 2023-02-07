import { Container, Grid, Paper } from '@mui/material'
import React from 'react'
import ShowMessage from './ShowMessage';

const MultiPlayerGame = ({socket}) => {

    const [open, setOpen] = React.useState(false);
    const [message, setMessage] = React.useState('');

    const [gameBoard, setGameBoard] = React.useState(null);
    const [player1Tiles, setPlayer1Tiles] = React.useState([]);
    const [player2Tiles, setPlayer2Tiles] = React.useState([]);
    const [possibleMove, setPossibleMove] = React.useState([]);
    const [targeted, setTargeted] = React.useState(null);

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


    React.useEffect(() => {
        function initGameWithBot() {
            socket.on('player:move:success', (payload) => {
                console.log(payload)
            })

            socket.on('player:move:fail', (payload) => {
                console.log(payload)
            })
            
            socket.on('player:move-possible:success', (payload) => {
                let moves = [];
                if (Array.isArray(payload)) {
                    payload.forEach(move => {
                        moves.push(move.jumpTo);
                    })
                }

                setPossibleMove(moves);
            })

            socket.on('player:move-possible:fail', (payload) => {
                console.log(payload)
            })

            socket.on('game:create:success', (payload) => {
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
    <Container sx={{
        paddingTop: "10px",
    }}>
        <Grid sx={{
            backgroundColor: "#E8D2A6",
            paddingBottom: '20px'
        }} maxWidth="950px" maxHeight="950px" container spacing={0}>
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
                        {player1Tiles[position] ? <img src="/images/player_tile.png" alt={position} /> : ''}
                        {player2Tiles[position] ? <img src="/images/bot_tile.png" alt={position} /> : ''}
                    </Paper>
                </Grid>
            ))}
        </Grid>
        <ShowMessage open={open} message={message} setOpen={setOpen} />
    </Container>
  )
}

export default MultiPlayerGame