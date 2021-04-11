let users = {};
module.exports = (httpServer, selfUpdateHandler) => {
    const io = require('./server/server')(httpServer)
    io.on('connection', socket => {

        if ((socket.handshake && socket.handshake.query  && socket.handshake.query.user)){

            const uid = socket.handshake.query.user

            socket.on('disconnect', (e) => {
                delete users[uid]
            });

            if(users[uid] && users[uid].socket){
                users[uid].socket = socket
            } else {
                users[uid] = {socket: socket}
            }
            socket.on( uid, (data) => {
                data.user = uid
                if(data.userPassenger && users[data.userPassenger] && users[data.userPassenger].socket && users[data.userPassenger].socket.id) {
                    socket.broadcast.to(users[data.userPassenger].socket.id).emit(uid, data)
                }
                selfUpdateHandler(data)
            })
        }
        else {
            socket.on('update', (data) => {
                let json = JSON.stringify(data)
                json = JSON.parse(data)
                if(users[json.id] && users[json.id].socket && users[json.id].socket.id) {
                    socket.broadcast.to(users[json.id].socket.id).emit(json.id, json)
                } else {
                    io.emit(json.id, json)
                }
            })
        }
    });
}
