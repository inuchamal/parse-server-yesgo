const utils = require("./Utils.js");
const conf = require("config");
const Define = require('./Define.js');
const Messages = require('./Locales/Messages.js');
let skip = 0;
let fixed = 0, sumTotalValue = 0;
const response = require('./response');
function FixManager(request) {
    const _request = request;
    const _response = response;
    const _currentUser = request ? request.user : null;
    const _params = request ? request.params : null;
    const _language = _currentUser ? _currentUser.get("language") : null;
    const _super = {
        activateAllSharedGain: async () => {
            let query = new Parse.Query(Parse.User);
            query.equalTo("sharedGain", false);
            query.select("sharedGain");
            query.limit(20000);
            let users = await query.find();
            for (let i = 0; i < users.length; i++) {
                users[i].set("sharedGain", true);
            }
            return await Parse.Object.saveAll(users, {useMasterKey: true});
        },
        fixBlockedValue: async (user) => {
            let blocked = user.get("blockedValue");
            let qTravels = new Parse.Query(Define.Travel);
            qTravels.equalTo("status", "completed");
            qTravels.equalTo("driver", user);
            qTravels.limit(1000000);
            let travels = await qTravels.find();
            let sum = 0;
            for (let i = 0; i < travels.length; i++) {
                sum += travels[i].get("valueDriver")
            }
            sum = utils.toFloat(sum);
            if (travels.length === 0 || sum === 0) return Promise.resolve();

            const acc = await utils.findObject(Define.BankAccount, {"user": user}, true);
            if (!acc) return Promise.resolve();
            if (!acc) return Promise.resolve(skip++);
            const payment = await require('./Payment/Payment.js').instance().getFinanceData({
                userId: user.id,
                accountId: acc ? acc.get("paymentId") : null,
                bankAccountId: acc ? acc.id : null,
                recipientId: user.get("recipientId"),
                isDriver: true
            });
            const withdraws = await require('./Payment/Payment.js').instance().withdrawConciliations({userId: user.id});
            if (withdraws.value > 0) {
                let a = 2;
            }
            if (sum !== payment.user.balanceAvailable + user.get("blockedValue") + withdraws.value) {
                let c = 4;
            }
            let newValue = utils.toFloat(sum - payment.user.balanceAvailable - withdraws.value);
            if (!newValue || newValue <= 0) {
                let b = 3;
                user.set("blockedValue", 0);
            } else {
                newValue = utils.toFloat(newValue);
                user.set("logValue", {old: user.get("blockedValue"), newValue: newValue});
                await require('./Payment/Payment.js').instance().transferValue({
                    userId: user.id,
                    user: user,
                    value: newValue,
                    type: "fixValues"
                });
                sumTotalValue += newValue;
                fixed++;
                user.set("blockedValue", 0);
            }
            return user.save(null, {useMasterKey: true});
        },
        fixBlockedValueInLets: () => {

            console.log("find", skip)
            let query = new Parse.Query(Parse.User);
            // query.descending("blockedValue");
            // query.lessThan("blockedValue", 0);
            query.equalTo("isDriver", true);
            query.equalTo("status", "approved");
            query.equalTo("profileStage", "approvedDocs");
            query.ascending("createdAt");
            query.limit(1);
            query.skip(skip);
            return query.find().then(function (users) {
                if (users.length === 0) return Promise.resolve();
                //if (users[0].get("blockedValue") === 0) return Promise.resolve()
                let promises = [];
                for (let i = 0; i < users.length; i++) {
                    promises.push(_super.fixBlockedValue(users[i]));
                }
                return Promise.all(promises);
            }).then(function () {
                console.log(" saveAll ok", fixed, sumTotalValue)
                skip++
                return _super.fixBlockedValueInLets();
            }, function (error) {
                console.log(" error ok", error)
            });
        },
        verifyBillet: async (billet) => {
            if (billet.get("status") === "paid") return Promise.resolve();
            let webhooks = await utils.findObject(Define.WebhookRecord, {
                idPostback: billet.get("paymentId"),
                event: "invoice.status_changed"
            });
            let item;
            for (let i = 0; i < webhooks.length; i++) {
                if (webhooks[i].get("body").status === "paid") {
                    item = webhooks[i];
                    break;
                }
            }
            if (!item) return Promise.resolve();
            billet.set("oldStatus", item.get("status"));
            billet.set("status", "paid");
            let _driver = billet.get("driver");
            _driver.increment("inDebt", -billet.get("amount"));
            return Parse.Object.saveAll([_driver, billet], {useMasterKey: true});
        },
        fixBilletsPaid: async () => {
            let billets = await utils.findObject(Define.BilletLog, null, null, ["user"], null, null, null, null, 1000000);
            let promises = [];
            for (let i = 0; i < billets.length; i++) {
                promises.push(_super.verifyBillet(billets[i]));
            }
            return Promise.all(promises);
        },
        publicMethods: {}
    };
    return _super;
}

exports.instance = FixManager;

for (let key in FixManager().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        const method = FixManager(request).publicMethods[request.functionName];
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
