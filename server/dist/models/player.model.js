import mongoose from 'mongoose';
const PlayerCollectionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Types.ObjectId,
        ref: 'user'
    },
    normal_positions: {
        type: Array,
        required: true
    },
    king_positions: {
        type: Array,
        required: true
    },
    killed: {
        type: Array,
        required: true
    },
    lose: {
        type: Array,
        required: true
    },
    waiting: {
        type: Boolean,
        required: true
    },
    turn: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });
/**
 * hide some credentials to query by accident
 */
PlayerCollectionSchema.methods.toJSON = function () {
    var obj = this.toObject();
    delete obj["hash"];
    delete obj["salt"];
    delete obj["__v"];
    return obj;
};
export const Player = mongoose.model("player", PlayerCollectionSchema);
//# sourceMappingURL=player.model.js.map