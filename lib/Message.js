const utils = require("./Utils.js");
const Messages = require('./Locales/Messages.js');
const UserClass = require('./User.js');
const RadiusClass = require('./Radius.js');
const Define = require('./Define.js');
const mail = require('./mailTemplate.js');
const conf = require('config');
const listFields = ["type", "sender", "recipient", "text", "updatedAt", "createdAt", "objectId"];
const listRequiredFields = [];
let cont = 0;
const response = require('./response');
function Message(request) {
    let _request = request;
    let _response = response;
    let _currentUser = request ? request.user : null;
    let _params = request ? request.params : null;
    let _language = _currentUser ? _currentUser.get("language") : null;

    let _super = {

        createMessage: function (text, type, sender, recipientId) {
            let message = new Define.Message();
            message.set("text", text);
            message.set("type", type);
            message.set("sender", sender);
            if (recipientId && type === "user") {
                let recipient = new Parse.User();
                recipient.set("objectId", recipientId);
                message.set("recipient", recipient);
            }
            return message.save(null, {useMasterKey: true});
        },
        formatMessage: function (message) {
            return {
                text: message.get("text") || undefined,
                type: message.get("type") || undefined,
                sender: message.get("sender") ? {
                    objectId: message.get("sender").id,
                    name: message.get("sender").get("name")
                } : undefined,
                recipient: message.get("recipient") ? {
                    objectId: message.get("recipient").id,
                    name: message.get("recipient").get("name"),
                    userType: message.get("recipient").get("isPassenger") ? "passenger" : "driver"
                } : undefined,
                createdAt: message.createdAt,
                updatedAt: message.updatedAt,
                objectId: message.id,
            }

        },
        publicMethods: {
            listMessages: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        let query = new Parse.Query(Define.Message);
                        if (_params.search) {
                            const queryUsers = Parse.Query.or(new Parse.Query(Parse.User).matches("name", _params.search, "i"), new Parse.Query(Parse.User).matches("email", _params.search, "i"));
                            const queryMessages = Parse.Query.or(
                                new Parse.Query(Define.Message).matchesQuery("sender", queryUsers),
                                new Parse.Query(Define.Message).matchesQuery("recipient", queryUsers)
                            );
                            query = Parse.Query.or(queryMessages, new Parse.Query(Define.Message).matches("text", _params.search, "i"));
                        }
                        if (_params.beginDate) {
                            const begin = new Date(_params.beginDate).setHours(0, 0, 0);
                            query.greaterThanOrEqualTo("createdAt", new Date(begin));
                        }
                        if (_params.endDate) {
                            const end = new Date(_params.endDate).setHours(23, 59, 59);
                            query.lessThanOrEqualTo("createdAt", new Date(end));
                        }
                        if (_params.type)
                            query.equalTo("type", _params.type);
                        if (_params.order)
                            _params.order[0] === "+" ? query.ascending(_params.order.substring(1)) : query.descending(_params.order.substring(1));
                        else query.descending("createdAt");
                        if (_currentUser.get('admin_local')) {
                            let cQuery = utils.createQuery({
                                Class: Parse.User,
                                conditions: {
                                    'admin_local.city': _currentUser.get('admin_local').city,
                                    'admin_local.state': _currentUser.get('admin_local').state
                                }
                            });
                            query.matchesQuery('sender', cQuery);
                        }
                        const total = await query.count();
                        const limit = _params.limit || 10;
                        const page = ((_params.page || 1) - 1) * limit;
                        query.include(["sender", "recipient"]);
                        query.select(["text", "type", "sender.id", "sender.name", "recipient.id", "recipient.name", "recipient.isPassenger", "recipient.isDriver"]);
                        query.limit(limit);
                        query.skip(page);
                        let messages = await query.find();
                        let data = [];
                        for (let i in messages)
                            data.push(_super.formatMessage(messages[i]));
                        return _response.success({total: total, messages: data});
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
        }
    };
    return _super;
}

exports.instance = Message;

for (let key in Message().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        if (conf.enableLog) utils.printLogAPI(request);
        return await Message(request).publicMethods[request.functionName]();
    });
}
