import mongoose from 'mongoose';
const GameCollectionSchema = new mongoose.Schema({
    player1: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'player'
    },
    player2: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'player'
    },
    expiresAt: {
        type: Date,
        required: true
    },
    isOver: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });
/**
 * hide some credentials to query by accident
 */
GameCollectionSchema.methods.toJSON = function () {
    var obj = this.toObject();
    delete obj["__v"];
    return obj;
};
export const Game = mongoose.model('game', GameCollectionSchema);
//# sourceMappingURL=game.model.js.map