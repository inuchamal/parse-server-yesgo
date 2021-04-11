/**
 * Created by Patrick on 17/01/2019.
 */
const conf = require('config');

function MrPostman() {
    var _super = {
        sendSMS: function (phone, smsToSend, ddi) {
            let promise = new Promise((resolve, reject) => {
                const options = {
                    method: 'GET',
                    url: conf.mrpostman.url,
                    qs: {
                        UserID: conf.mrpostman.user_id,
                        Token: conf.mrpostman.user_token,
                        NroDestino: phone,
                        Mensagem: smsToSend
                    },
                    headers: {
                        'Postman-Token': 'd3413ab7-876d-4de9-a19d-f82533b9cbc0',
                        'cache-control': 'no-cache'
                    }
                };

                request(options, function (error, response, body) {
                    if (error) throw new Error(error);
                    return resolve(body);
                });
            });
            return promise;
        }
    }
    return _super;
}
exports.instance = MrPostman;
