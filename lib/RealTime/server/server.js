const io = require('socket.io')
let server;
class Server extends io {
    constructor(url) {
        super(url);
    }
}
module.exports = (url) => {
    if(server) {
        return server
    } else {
        server = new Server(url)
        return server
    }

}
