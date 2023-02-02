import { createClient, RedisClientType } from 'redis';
import { redisConfig, setRedis } from '../config/redis.config.js';

export var redisClient: any = null;

export const connectToRedis = () => {
    return new Promise( async (resolve, reject) => {
        const client = createClient({
            url: `${redisConfig.protocol}://${redisConfig.host}:${redisConfig.port}`
        });
    
        client.on('error', (err) => {
            global.logger.error('Redis Client Error', err.message)
            process.exit(0);
            reject(err);
        });
    
        await client.connect();
        redisClient = client;
        global.logger.info('Redis connection established successfully ✔')
        resolve(true);
    })
}

export const redisSetKeyValue = async (key: string, value: any, isJson: boolean = false) : Promise<setRedis> => {
    return new Promise(async (resolve, reject) => {
        try {
            const stored = await redisClient.set(key, JSON.stringify(value))
            if (stored === 'OK') {
                resolve({
                    success: true,
                    stored: isJson ? JSON.parse(value) : value
                })
            } else {
                reject({
                    success: false,
                    message: 'failed storing value on redis server'
                })
            }
        } catch(e) {
            reject({
                success: false,
                message: e.message
            })
        }
    })
}