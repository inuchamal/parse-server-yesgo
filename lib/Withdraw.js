const utils = require("./Utils.js");
const conf = require("config");
const Define = require('./Define.js');
const UserClass = require('./User.js');
const Messages = require('./Locales/Messages.js');
const response = require('./response');
function WithdrawLog(request) {
    const _request = request;
    const _response = response;
    const _currentUser = request ? request.user : null;
    const _params = request ? request.params : null;
    const _language = _currentUser ? _currentUser.get("language") : null;
    const _super = {
        saveWithdrawLog: (driver, withdraw, value, bonus, type, error) => {
            let log = new Define.WithdrawLog();
            log.set("driver", driver);
            log.set("value", value);
            log.set("bonus", Number(bonus));
            log.set("type", type);
            log.set("error", error);
            return log.save(null, {useMasterKey: true});
        },
        publicMethods: {}
    };
    return _super;
}

exports.instance = WithdrawLog;

for (let key in WithdrawLog().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        const method = WithdrawLog(request).publicMethods[request.functionName];
        if (utils.verifyRequiredFields(request.params, method.required, response) &&
            ((!method.access || method.access.length === 0) || utils.verifyAccessAuth(request.user, method.access, response))) {
            try {
                return await method.f();
            } catch (e) {
                response.error(e.code, e.message);
            }
        } else {
            response.error(Messages().error.ERROR_UNAUTHORIZED);
        }
    });
}
