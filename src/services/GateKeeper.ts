import Logger from '../util/logger';
import axios from 'axios';

const logger = Logger(module);

export const getAuthToken = async () => {
    logger.debug('GateKeeper: getting authentication credentials - getAuthToken');
    const gateKeeperUrl = process.env.GATEKEEPER_BASE_URL + '/api/Auth/client';
    const apiKey = process.env.GATEKEEPER_API_KEY;
    if (gateKeeperUrl && apiKey) {
        const authResponse = await axios.post(
            gateKeeperUrl,
            { key: apiKey },
            {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json;charset=UTF-8",
                  },
            }
        );

        if (authResponse.status === 200) {
            return [authResponse.data.token, authResponse.data.expiresAt];
        } else {
            return null;
        }
    } else {
        return null;
    }
};
