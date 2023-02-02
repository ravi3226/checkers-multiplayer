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
            const stored = await redisClient.set(key, JSON.stringify(value));
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
//# sourceMappingURL=redis.service.js.map