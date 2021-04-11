/**
 * Created by Patrick on 17/01/2019.
 */
const conf = require('config');
let url = "http://sms.painelmarktel.com.br/index.php?app=ws&op=pv";
let user;
let token;
function Marktel() {
    var _super = {
        validate: function () {
            if (!conf.sms || !conf.sms.marktel)
                throw("Missing 'marktel' params");
            let requiredFields = ["user", "token"];
            let missingFields = [];
            for (var i = 0; i < requiredFields.length; i++) {
                if (!conf.sms.marktel[requiredFields[i]] || conf.sms.marktel[requiredFields[i]] === '') {
                    missingFields.push(requiredFields[requiredFields[i]]);
                }
            }
            if (missingFields.length > 0) throw("Missing '" + missingFields + "' params in 'marktel'");
            const user = conf.sms.marktel.user;
            const token = conf.sms.marktel.token;
            url += "&u=" + user + "&h=" + token;
        },
        sendSMS: function (phone, smsToSend, ddi) {
            smsToSend = smsToSend.toString();
            url += "&to=" + phone + "&msg=" + smsToSend;
            return Parse.Cloud.httpRequest({url: url});
        },
    }
    return _super;
};
exports.instance = Marktel;
