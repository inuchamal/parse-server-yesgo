const io = require('socket.io-client')
let client;
class Client extends io {
    constructor(url) {
        super(url);
    }
}
module.exports = (url) => {
    if(client) {
        return client
    } else {
        client = new Client(url)
        return client
    }
}
