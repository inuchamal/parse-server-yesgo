const express = require('express');
const router = express.Router();
const conf = require('config')
const getExpeditiousCache = require('express-expeditious');
// const maps = require('../Maps/Maps').instance()
const redisOptions = {
    host: conf.redis.host,
    port: conf.redis.port,
    no_ready_check: true,
    auth: conf.redis.auth,
    auth_pass: conf.redis.auth
}
const genCacheKey = (req, res, next) => {
    let key = Number(req.headers.originlat).toFixed(5) + Number(req.headers.originlng).toFixed(5) + Number(req.headers.destinylat).toFixed(5) + Number(req.headers.destinylng).toFixed(5);
    return key
}
const cache = getExpeditiousCache({
    namespace: 'expresscache',
    defaultTtl: '1 hour',
    genCacheKey: genCacheKey,
    engine: require('expeditious-engine-redis')({redis: redisOptions})
});
const getRouteCached = async (req, res, next) => {
    Parse.initialize(conf.appId);
    Parse.serverURL = conf.server;
    Parse.masterKey = conf.masterKey
    let body = {
        "_SessionToken": req.headers._sessiontoken,
        "originLat": Number(req.headers.originlat),
        "originLng": Number(req.headers.originlng),
        "destinyLat": Number(req.headers.destinylat),
        "destinyLng": Number(req.headers.destinylng),
    }

    try {
        const response = await Parse.Cloud.run('getRoute', body);
        res.status(200).send({result: response})
    } catch (e) {
        res.status(400).send(e)
    }
};
router.get('/use/functions/getRoute', cache.withTtl('1 hour'), getRouteCached);
module.exports = router;
