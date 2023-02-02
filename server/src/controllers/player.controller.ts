import { Server, Socket } from "socket.io";
import { TokenStatus } from "../config/user.config.js";
import { validateAuthToken } from "../middlewares/user.middleware.js";

export const getPossibleMove = async (io: Server, socket: Socket, payload: any) : Promise<void> => {
    validateAuthToken(payload.token, socket.id)
    .then(async ( tokenValidate: TokenStatus ) : Promise<void> => {

        if ( !tokenValidate.validate ) {
            socket.emit('game:create:fail', {
                token: [tokenValidate.message]
            })
        } else {

            /**
             * get the userId of request
             */
            const userId = tokenValidate.id;
            // TODO: left here...

        }

    }).catch((e : Error) : void => {
        socket.emit('token:refresh:fail', {
            general: [e.message]
        })
        socket.emit('player:possible-move:fail', {
            general: [`failed token validation : ${e.message}`]
        })
    })
}