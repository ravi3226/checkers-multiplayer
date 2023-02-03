import { createClient } from 'redis';
import { redisConfig } from '../config/redis.config.js';
export var redisClient = null;
export const connectToRedis = () => {
    return new Promise(async (resolve, reject) => {
        const client = createClient({
            url: `${redisConfig.protocol}://${redisConfig.host}:${redisConfig.port}`
        });
        client.on('error', (err) => {
            global.logger.error('Redis Client Error', err.message);
            process.exit(0);
            reject(err);
        });
        await client.connect();
        redisClient = client;
        global.logger.info('Redis connection established successfully ✔');
        resolve(true);
    });
};
export const redisSetKeyValue = async (key, value, isJson = false) => {
    return new Promise(async (resolve, reject) => {
        try {
            value = isJson ? JSON.stringify(value) : value;
            const stored = await redisClient.set(key, value);
            if (stored === 'OK') {
                resolve({
                    success: true,
                    stored: isJson ? JSON.parse(value) : value
                });
            }
            else {
                reject({
                    success: false,
                    message: 'failed storing value on redis server'
                });
            }
        }
        catch (e) {
            reject({
                success: false,
                message: e.message
            });
        }
    });
};
export const redisGetKeyValue = async (key, isJson = false) => {
    return new Promise(async (resolve, reject) => {
        try {
            var value = await redisClient.get(key);
            if (value) {
                if (isJson)
                    value = JSON.parse(value);
                resolve({
                    success: true,
                    value
                });
            }
            else {
                reject({
                    success: false,
                    message: 'not found'
                });
            }
        }
        catch (e) {
            reject({
                success: false,
                message: `redis failed : ${e.message}`
            });
        }
    });
};
//# sourceMappingURL=redis.service.js.map