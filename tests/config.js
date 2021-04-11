module.exports = {
    app: require('../index.js'),
    request: require('supertest'),
    config: require('../config/' + process.env.NODE_ENV + '.json')
};