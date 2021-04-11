const utils = require("./Utils.js");
const conf = require("config");
const Define = require('./Define.js');
const Messages = require('./Locales/Messages.js');
const PaymentManagerInstance = require('./PaymentManager').instance();
const listFields = ["type", "amount", "driver", "admin", "paymentId", "status", "pdf", "link", "updatedAt", "createdAt", "objectId"];
const listRequiredFields = [];
const response = require('./response');
function BilletLog(request) {
    const _request = request;
    const _response = response;
    const _currentUser = request ? request.user : null;
    const _params = request ? request.params : null;
    const _language = _currentUser ? _currentUser.get("language") : null;
    const _super = {
        formatBillet: (billet) => {
            let driver = billet.get("driver") || undefined;
            let admin = billet.get("admin") || undefined;
            let output = {
                type: billet.get("type") || undefined,
                amount: billet.get("amount") || undefined,
                driver: driver ? { name: driver.get("name") || undefined , objectId: driver.id} : undefined,
                admin: admin ? { name: admin.get("name") || undefined , objectId: admin.id} : undefined,
                status: billet.get("status") || undefined,
                pdf: billet.get("pdf") || undefined,
                link: billet.get("link") || undefined,
                updatedAt: billet.updatedAt.toJSON(),
                createdAt: billet.createdAt.toJSON(),
                objectId: billet.id
            };

            return output;
        },
        publicMethods: {
            createBilletPayment: {
                f: async () => {
                    try {
                        const {driverId, value} = _params;
                        const force = _params.force === true;
                        let driver =  await utils.getObjectById(driverId, Parse.User);
                        if(!driver.get("isDriver"))
                            return Promise.reject(Messages(_language).error.ERROR_NOT_IS_DRIVER);
                        const billet = await PaymentManagerInstance.createBilletPayment(value, driver, _currentUser, force);
                      return _response.success(billet.id);
                    } catch (e) {
                        _response.error(e.code, e.message);
                    }
                },
                access: ["admin"],
                required: ["driverId", "value"],

            },
            getBilletByDriver: {
                f: async () => {
                    try {
                        let {driverId, limit, page} = _params, data = [];
                        let driver =  await utils.getObjectById(driverId, Parse.User);
                        if(!driver.get("isDriver"))
                            return Promise.reject(Messages(_language).error.ERROR_NOT_IS_DRIVER);
                        let query = new Parse.Query(Define.BilletLog);
                        query.equalTo("driver", driver);
                        let total = await query.count();
                        limit = limit || 2000;
                        page = (page || 0) * limit;
                        query.include(["driver", "admin"]);
                        query.select(["type", "amount", "driver.name", "admin.name", "paymentId", "status", "pdf", "link"]);
                        query.limit(limit);
                        query.skip(page);
                        query.descending('createdAt');
                        let billets = await query.find();
                        for (let i in billets)
                            data.push(_super.formatBillet(billets[i]));
                      return _response.success({total: total, billets: data})
                    } catch (e) {
                        _response.error(e.code, e.message);
                    }
                },
                access: ["admin", "driver"],
                required: ["driverId"],
            }
        }
    };
    return _super;
}

exports.instance = BilletLog;

for (let key in BilletLog().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        const method = BilletLog(request).publicMethods[request.functionName];
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
