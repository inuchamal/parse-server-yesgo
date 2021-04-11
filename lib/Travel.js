/**
 * Created by Patrick on 08/08/2017.
 */

'use strict';
const Define = require("./Define.js");
const utils = require("./Utils.js");
const conf = require('config');
const DeviceInfoClass = require('./DeviceInfo.js');
const ReceiptClass = require('./Receipt').instance();
const PushNotificationClass = require('./PushNotification.js');
const PlanClass = require('./Plan.js');
const RadiusClass = require('./Radius.js');
const FirebaseClass = require('./Firebase.js');
const FareInstance = require('./Fare.js').instance();
const ConfigInstance = require('./Config.js').instance();
const Address = require('./Address.js').instance();
const UserClass = require('./User.js');
const Messages = require('./Locales/Messages.js');
const Fare = require('./Fare.js').instance();
const Activity = require('./Activity.js').instance();
const Mail = require('./mailTemplate.js');
const BonusInstance = require('./Bonus.js').instance();
const MapsInstance = require('./Maps/Maps.js').instance();
const DismissTravel = require('./DismissTravel.js').instance();
const fs = require('fs');
const UserDiscountInstance = require('./UserDiscount').instance();
const PaymentModule = require('./Payment/Payment.js').instance();
const RedisJobInstance = require('./RedisJob.js').instance();
const CouponInstance = require('./Coupon.js').instance();
const Cancellation = require('./Cancellation.js').instance();
const Maps = require('./Maps/Maps');
const io = require('./RealTime/client/client')(conf.realTime ? conf.realTime.realTimeUrl : 'http://localhost:2203');
const redis = require('redis');
const listFields = ["driverFeeDetails", "passengerFeeDetails", "paidWithBonusReturned", "logDriversCallAgain", "originalListLocationInTravel", "isPointToPoint", "countMapsToRecalculate", "secondPaymentId", "secondPaymentUrls", "currentStep", "points", "serviceOrder", "timeStoppedDriver", "valueStoppedDriver", "listLocationInTravel", "sumDistance", "originalFare", "passenger_last_city", "passenger_last_state", "appointmentDateString", "isScheduled", "appointmentDate", "apiVersion", "pagarmeId", "cancellationFee", "paidCancellation", "originalValue", "valueBeforeRecalculate", "dataBeforeRecalculate", "networkPassengerValue", "inDebt", "debtCharged", "driverLocationWhenArrived", "driverLocationWhenCancell", "driverCredit", "paid", "couponValue", "couponRelation", "debitOfDriver", "debitOfDriverBefore", "sharedGain", "networkDriverValue", "paymentId", "usingBonus", "planFee", "isNew", "offset", "completedByAdmin", "errorReason", "errorCode", "passengerLocation", "paidWithBonus", "inDebtUsed", "creditDriverBonus", "coupon", "couponRelation", "originJson", "destinationJson", "expectedTime", "logDriversCall", "locationWhenAccept", "driverLocationWhenCancel", "passengerLocationWhenCancel", "locationWhenComplete", "locationWhenInit", "deletedDate", "plan", "isWaitingPassenger", "waitingDate", "womenOnly", "deleted", "driversInCall", "nextDriversToCall", "nextTimeToCall", "finalLocation", "indicator", "whoReceiveBonus", "dateString", "driversReceivePush", "receiptDriver", "valueDriver", "receiptPassenger", "driverRateDate", "userRateDate", "bigMap", "smallMap", "map", "discountObj", "DriverRate", "totalValue", "distance", "time", "driverReview", "userReview", "fare", "card", "discount", "vehicleCategory", "fee", "user", "driver", "date", "vehicle", "startDate", "cancelBy", "cancelDate", "duration", "endDate", "receipt", "originInfo", "destinationInfo", "driverRate", "userRate", "acceptedDate", "status", "value", "origin", "destination", "deleted", "updatedAt", "createdAt", "objectId", "ACL"];
const listRequiredFields = [];
const statusAllow = ["newScheduled", "new", "waiting", "onTheWay", "onTheDestination", "completed", "cancelled", "deleted"];
let travelsWaiting = {};
let travelsArrived = {};
let userInTravel = {};
let blockedTravels = {};
let travelInitializing = {};
let travelsFinalizing = {};
let cache;
const response = require('./response');
const client = redis.createClient({
    host: conf.redis.host,
    password: conf.redis.auth,
    db: conf.redis.db,
    port: conf.redis.port,
});
const {promisify} = require('util');
const getAsync = promisify(client.get).bind(client);
client.set('userInTravel', JSON.stringify({}));
client.set('travelsWaiting', JSON.stringify({}));
client.set('travelInitializing', JSON.stringify({}));

function Travel(request) {
    let _request = request;
    let _response = response;
    let _currentUser = request ? request.user : null;
    let _params = request ? request.params : null;
    let _language = _currentUser ? _currentUser.get("language") : null;

    let _super = {
        getAditionalValuesOfStops: async (travel) => {
            try {
                let changeStoppedValue = false, stoppedValue = 0;
                if (conf.stops && conf.stops.maxStopedTime) {
                    const points = travel.get('points');
                    let totalMS = 0;
                    for (let i = 0; i < points.length; i++) {
                        totalMS += (points[i].diffms && points[i].diffms > (conf.stops.maxStopedTime * 60000)) ? points[i].diffms : 0
                    }
                    totalMS = totalMS / 60000;
                    if (totalMS > 0) {
                        changeStoppedValue = true;
                        const confObj = await utils.findObject(Define.Config, {}, true);
                        stoppedValue = (confObj && confObj.get("valueStoped")) ? totalMS * confObj.get("valueStoped") : totalMS * conf.stops.valueStop;
                    }
                }
                return Promise.resolve({changeStoppedValue, stoppedValue});
            } catch (e) {
                console.log(e);
                return Promise.resolve({changeStoppedValue: false, stoppedValue: 0});
            }

        },
        getValueOfTravelEalier: async ({objectId, latitude, longitude}) => {
            try {
                let travel = await utils.getObjectById(objectId, Define.Travel, ['fare', 'couponRelation']);
                if (!travel.get('points') || !Array.isArray(travel.get('points')))
                    return Promise.reject(Messages().error.ERROR_INVALID_POINTS);
                let points = travel.get('points').filter(address => address.visited);
                const temporaryDestiny = {
                    "address": {
                        "location": {
                            "latitude": latitude,
                            "longitude": longitude
                        }
                    },
                    "visited": true,
                    "type": "destiny",
                    "visitedAt": new Date().toISOString(),
                    "leftedAt": new Date().toISOString()
                };
                points.push(temporaryDestiny);
                let totalDistance = 0, totalTime = 0;
                for (let i = 0; i < points.length - 1; i++) {
                    let point = points[i];
                    let nextPoint = points[i + 1];
                    if ((!point.address.location && !point.address.placeId) || (!nextPoint.address.location && !nextPoint.address.placeId))
                        return _response.error(Messages(_language).error.ERROR_LOCATION_OR_PLACEID.code, Messages(_language).error.ERROR_LOCATION_OR_PLACEID.message);
                    let data = await Maps.instance().makePartialRoute(
                        point.address.placeId,
                        point.address.location ? point.address.location.latitude : null,
                        point.address.location ? point.address.location.longitude : null,
                        nextPoint.address.placeId,
                        nextPoint.address.location ? nextPoint.address.location.latitude : null,
                        nextPoint.address.location ? nextPoint.address.location.longitude : null,
                        false
                    );

                    totalTime += data.duration;
                    totalDistance += data.distance;
                }
                let value = Fare.calculateValue(travel.get('fare'), totalDistance / 1000, totalTime / 60, _currentUser);
                if (travel.get("couponRelation")) {
                    let newValues = CouponInstance.calculateDiscount(travel.get("couponRelation"), value);
                    value = newValues.value;
                }
                return Promise.resolve({value, travel});
            } catch (e) {
                return Promise.reject(e);
            }
        },
        isTravelWaiting: async (id) => {
            travelsWaiting = await getAsync('travelsWaiting') || travelsWaiting;
            travelsWaiting = JSON.parse(travelsWaiting);
            return travelsWaiting[id] ? true : false;
        },
        insertTravelWaiting: async (id) => {
            travelsWaiting = await getAsync('travelsWaiting') || travelsWaiting;
            travelsWaiting = JSON.parse(travelsWaiting);
            travelsWaiting[id] = true
            client.set('travelsWaiting', JSON.stringify(travelsWaiting))

        },
        removeTravelWaiting: async (id) => {
            travelsWaiting = await getAsync('travelsWaiting') || travelsWaiting;
            travelsWaiting = JSON.parse(travelsWaiting);
            delete travelsWaiting[id]
            client.set('travelsWaiting', JSON.stringify(travelsWaiting))

        },
        beforeSave: function () {
            let object = _request.object;
            let wrongFields = utils.verify(object.toJSON(), listFields);
            if (wrongFields.length > 0) {
                _response.error("Field(s) '" + wrongFields + "' not supported.");
                return;
            }
            let requiredFields = utils.verifyRequiredFields(object.toJSON(), listRequiredFields);
            if (requiredFields.length > 0) {
                _response.error("Field(s) '" + requiredFields + "' are required.");
                return;
            }
            if (object.isNew()) {
                object.set("isNew", true);
                object.set("deleted", false);
                object.set("apiVersion", "0.0.1");
                object.set("serviceOrder", object._objCount);
            }
            return _response.success();
        },
        beforeDelete: function () {
            if (request.master) {
                return _response.success();
            } else {
                _response.error(Messages().error.ERROR_UNAUTHORIZED);
            }
        },
        verifyIsFakeCard: function (cardId) {
            return cardId && (Define.fakeCard.ids.indexOf(cardId) < 0)
        },
        afterSave: function () {
            let object = _request.object;
            if (object.get("isNew")) {
                let bigMap = 'https://maps.googleapis.com/maps/api/staticmap?key=' + Define.MapsKey + '&size=600x300&maptype=roadmap&markers=color:green%7Clabel:I%7C' + -20.4005033 + ',' + -43.511050999999995 + '&markers=color:red%7Clabel:F%7C' + -20.4005033 + ',' + -43.511050999999995;
                let smallMap = 'https://maps.googleapis.com/maps/api/staticmap?key=' + Define.MapsKey + '&size=300x300&maptype=roadmap&markers=color:green%7Clabel:I%7C' + -20.4005033 + ',' + -43.511050999999995;
                let _big;
                return utils.saveImageFromUrl(bigMap).then(function (bigM) {
                    _big = bigM;
                    return utils.saveImageFromUrl(smallMap);
                }).then(function (smallM) {
                    let _map = {
                        bigMap: _big,
                        smallMap: smallM
                    };
                    object.set("map", _map);
                    object.set("isNew", false);
                    return object.save();
                });
            }
        },
        finishCancellation: async (locationCancell, _travel, _currentUser, offset, cancelRefund, canCallAgain) => {
            if (locationCancell) {
                _travel.set('driverLocationWhenCancell', locationCancell)
            }
            if (["cancelled", "completed"].indexOf(_travel.get("status")) >= 0) {
                const cancelBy = _currentUser.get("isDriverApp") ? "driver" : "passenger";
                _travel.set("cancelBy", cancelBy);
                await _travel.save(null, {useMasterKey: true});
                return Promise.reject({
                    code: 401,
                    message: _travel.get("status") === "completed" ? "Esta corrida já foi concluida anteriormente." : "Esta corrida já foi cancelada anteriormente."
                });
            }
            if (!_currentUser.get("isDriverApp") && ["waiting", "onTheWay"].indexOf(_travel.get("status")) < 0) {
                return Promise.reject({
                    code: 400,
                    message: "Não é possível cancelar uma ocorrida em andamento."
                });
            }
            const driver = _travel.get('driver');
            if (driver && _currentUser.id === driver.id) {
                driver.set("dismissArray", []);
                await driver.save(null, {useMasterKey: true});
                FirebaseClass.instance().updateDriver(driver.id, null, null, []);
            }
            return _super.cancelTravel(_travel, _currentUser, offset, null, cancelRefund, canCallAgain).then(function () {
                _super.createCancellationActivity(_travel, _currentUser);
            });
        },
        applyCancellationRules: async function (travel, rule, cancelledBy, charge) {
            if (!rule) return false;
            let regCurrentDAte = new RegExp('{{currentDate}}', 'g');
            let regAcceptedDate = new RegExp('{{acceptedDate}}', 'g');
            let regStatus = new RegExp('{{status}}', 'g');
            let regDuration = new RegExp('{{duration}}', 'g');
            let regArrival = new RegExp('{{arrivalDate}}', 'g');
            let regCreatedAt = new RegExp('{{createdAt}}', 'g');
            let currentDate = (new Date().getTime() / (60000));
            let acceptedDate = travel.get('acceptedDate') ? travel.get('acceptedDate').getTime() / (60000) : undefined;
            let createdAt = travel.get('createdAt') ? travel.get('createdAt').getTime() / (60000) : 0;
            let dateDiff = currentDate - acceptedDate;
            let exp = rule.replace(regCurrentDAte, currentDate).replace(regCreatedAt, createdAt).replace(regAcceptedDate, acceptedDate).replace(regStatus, "'" + travel.get('status') + "'").replace(regDuration, travel.get('time'));
            if (travel.get('driverLocationWhenArrived') && travel.get('driverLocationWhenArrived').date) {
                let dArrived = (travel.get('driverLocationWhenArrived').date.getTime() / (60000));
                exp = exp.replace(regArrival, dArrived);
            } else {
                exp = exp.replace(regArrival, undefined);
            }
            let result = eval(exp), value = false;
            if (result && (conf.appName.toLowerCase() === "mobdrive" || conf.appName.toLowerCase() === "demodev")) {
                value = cancelledBy == "driver" ? conf.driverCancellationTax : travel.get('fare').get('minValue')
            } else if (result && (conf.appName.toLowerCase() === "letsgo" || conf.appName.toLowerCase() === "ubx")) {
                value = (cancelledBy == "driver" && result != "driver") ? travel.get('fare').get('minValue') : conf.driverCancellationTax;
                let confValue = (result === 'driver') ? conf.driverCancellationTax : await new Parse.Query(Define.Config).select(['cancellationFee']).first();
                value = (confValue.get ? confValue.get('cancellationFee') : undefined) || value;
            } else if (result && conf.appName.toLowerCase() === "ubx") {
                value = (cancelledBy == "driver" && result != "driver") ? travel.get('fare').get('minValue') : conf.driverCancellationTax;
                let confValue = await new Parse.Query(Define.Config).select(['cancellationFee']).first();
                value = (confValue.get ? confValue.get('cancellationFee') : undefined) || value;
            } else if (result && conf.appName.toLowerCase() === "022") {
                value = travel.get('fare').get('minValue');
                let confValue = await new Parse.Query(Define.Config).select(['cancellationFee']).first();
                value = ((confValue.get && confValue.get('cancellationFee')) ? confValue.get('cancellationFee') : value);
            } else if (result) {
                value = cancelledBy == "driver" ? conf.driverCancellationTax : travel.get('fare').get('minValue')
            }
            if (charge) {
                switch (conf.appName.toLowerCase()) {
                    case "mobdrive":
                        return _super.chargeCancellationMob(travel, cancelledBy, value);
                        break;
                    case "letsgo":
                        return _super.chargeCancellationLets(travel, cancelledBy, value, result);
                        break;
                    default:
                        return _super.chargeCancellationMob(travel, cancelledBy, value);
                        break;
                }
            }
            let message = value ? (result === 'client' && cancelledBy === "driver" ? Messages(_language).success.CANCELLATION_FEE_DRIVER_TO_CLIENT.replace("{{fee}}", value.toFixed(2).replace('.', ',')) : Messages(_language).success.CANCELLATION_FEE.replace("{{fee}}", value.toFixed(2).replace('.', ','))) : false;
            return message;
        },
        chargeCancellationMob: async (travel, cancelledBy, cancellValue) => {
            let driver = travel.get('driver');
            travel.set('cancellationFee', cancellValue);
            travel.set('paidCancellation', cancelledBy);
            let dAmount = travel.get('originalValue') || travel.get('value');
            let _plan = await PlanClass.instance().getDefaultPlan(driver.get("plan"));
            if (cancelledBy === "driver") {
                PaymentModule.captureMoneyTransaction({
                    isCancellation: true,
                    value: -cancellValue,
                    targetId: driver.id,
                    userId: travel.get('user').id,
                    travelId: travel.id,
                    originalvalue: -cancellValue,
                    request: {}
                });
                driver.increment('inDebt', cancellValue);
                await driver.save(null, {useMasterKey: true})
            } else if (travel.has('card')) {
                let planFee = 0;
                let price = cancellValue; //discount was already considered (in requestTravel)
                let fee = travel.get("fee") ? parseFloat((travel.get("fee") || 0).toFixed(2)) : 0;

                if (conf.usePlan)
                    planFee = parseFloat((price * (_plan.get("percent") / 100)).toFixed(2));
                else {
                    const percentCompany = travel.get("vehicle").get("category").get("percentCompany") || _plan.get("percent");
                    planFee = parseFloat((price * (percentCompany / 100)).toFixed(2));
                }
                dAmount = price - fee - (planFee || 0);
                await PaymentModule.refund({id: travel.get("paymentId")});
                let pay = await PaymentModule.createCardTransaction({
                    travel: true,
                    installments: 1,
                    userId: travel.get("paymentId"),
                    cardId: travel.get("card").get("paymentId"),
                    value: cancellValue,
                    customerId: travel.get("user").get("paymentId"),
                    cpf: travel.get("user").get("cpf"),
                    phone: travel.get("user").get("phone"),
                    name: UserClass.instance().formatNameToPayment(travel.get("user")),
                    email: travel.get("user").get("email"),
                    destination: Address.formatAddressToPayment(travel.get("destinationJson"), travel.get("destination")),
                    isCancellation: true
                });
                if (pay.id && (pay.status === 'authorized' || (pay.success))) travel.set('paymentId', pay.id.toString());
                travel = await travel.save(null, {useMasterKey: true});
                return PaymentModule.captureTransaction({
                    userId: driver.id,
                    id: travel.get("paymentId"),
                    destination: travel.get("destinationJson"),
                    cardId: travel.get("card").get("paymentId"),
                    driverId: travel.get("driver").id,
                    isDriver: travel.get("driver").get("isDriverApp"),
                    recipientId: travel.get("driver").get("recipientId"),
                    drive: travel.get("driver").get("recipientId"),
                    email: travel.get("user").get("email"),
                    cpf: travel.get("user").get("cpf"),
                    name: UserClass.instance().formatNameToPayment(travel.get("user")),
                    driverAmount: dAmount,
                    totalAmount: parseFloat(cancellValue),
                    toRefund: travel.get("paidWithBonus"),
                    travelId: travel.id,
                    isCancellation: true,
                    driverCpf: travel.get("driver").get("cpf")
                }).then((pay) => {
                    return Promise.resolve();
                }, (err) => {
                    return Promise.reject(err);
                })
            } else {
                let user = travel.get('user');
                if (user.has('clientDebt')) {
                    user.increment('clientDebt', cancellValue)
                } else {
                    user.set('clientDebt', cancellValue)
                }
                let driver = travel.get('driver');
                let planFee;
                if (conf.usePlan)
                    planFee = parseFloat((cancellValue * (_plan.get("percent") / 100)).toFixed(2));
                else {
                    const percentCompany = travel.get("vehicle").get("category").get("percentCompany") || _plan.get("percent");
                    planFee = parseFloat((cancellValue * (percentCompany / 100)).toFixed(2));
                }
                if (conf.payment.db) {
                    PaymentModule.captureMoneyTransaction({
                        isCancellation: true,
                        value: -1 * (conf.cancellationSplitInMoney ? (cancellValue * conf.cancellationSplitInMoney) : (cancellValue - planFee)),
                        targetId: driver.id,
                        travelId: travel.id,
                        userId: travel.get('user').id,
                        originalvalue: -cancellValue,
                        request: {}
                    })
                }
                driver.increment('inDebt', -1 * (conf.cancellationSplitInMoney ? (cancellValue * conf.cancellationSplitInMoney) : (cancellValue - planFee)));
                await driver.save(null, {useMasterKey: true})
            }
            return Promise.resolve();
        },
        chargeCancellationLets: async (travel, cancelledBy, cancellValue, whoPay) => {
            let driver = travel.get('driver');
            travel.set('cancellationFee', cancellValue);
            travel.set('paidCancellation', whoPay);
            if (cancelledBy === "driver" && whoPay == "client") {
                await PaymentModule.refund({id: travel.get("paymentId")});
                if (driver.get('dayValue')) {
                    driver.increment('dayValue', cancellValue)
                } else {
                    driver.set('dayValue', cancellValue)
                }
                await driver.save(null, {useMasterKey: true});
                travel.set('valueDriver', cancellValue);


                let pay = await PaymentModule.createCardTransaction({
                    travel: true,
                    installments: 1,
                    userId: travel.get("user").id,
                    cardId: travel.get("card").get("paymentId"),
                    value: cancellValue,
                    customerId: travel.get("user").get("paymentId"),
                    cpf: travel.get("user").get("cpf"),
                    phone: travel.get("user").get("phone"),
                    name: UserClass.instance().formatNameToPayment(travel.get("user")),
                    email: travel.get("user").get("email"),
                    destination: Address.formatAddressToPayment(travel.get("destinationJson"), travel.get("destination"))
                });
                travel.set('paymentId', pay.id);
                let promises = [travel.save(null, {useMasterKey: true})];
                promises.push(PaymentModule.captureTransaction({
                    userId: driver.id,
                    id: pay.id,
                    destination: travel.get("destinationJson"),
                    cardId: travel.get("card").get("paymentId"),
                    driverId: travel.get("driver").id,
                    isDriver: travel.get("driver").get("isDriverApp"),
                    recipientId: travel.get("driver").get("recipientId"),
                    drive: travel.get("driver").get("recipientId"),
                    email: travel.get("user").get("email"),
                    cpf: travel.get("user").get("cpf"),
                    name: UserClass.instance().formatNameToPayment(travel.get("user")),
                    driverAmount: cancellValue,
                    totalAmount: parseFloat(cancellValue),
                    travelId: travel.id,
                    driverCpf: travel.get("driver").get("cpf")

                }));
                return Promise.all(promises)
            } else if (travel.has('card') && whoPay == "client") {
                driver = travel.get('driver');
                if (driver.get('dayValue')) {
                    driver.increment('dayValue', cancellValue)
                } else {
                    driver.set('dayValue', cancellValue)
                }
                await driver.save(null, {useMasterKey: true});
                await PaymentModule.refund({id: travel.get("paymentId")});
                travel.set('cancellationFee', cancellValue);
                travel.set('valueDriver', cancellValue);


                let pay = await PaymentModule.createCardTransaction({
                    travel: true,
                    installments: 1,
                    userId: travel.get("user").id,
                    cardId: travel.get("card").get("paymentId"),
                    value: cancellValue,
                    customerId: travel.get("user").get("paymentId"),
                    cpf: travel.get("user").get("cpf"),
                    phone: travel.get("user").get("phone"),
                    name: UserClass.instance().formatNameToPayment(travel.get("user")),
                    email: travel.get("user").get("email"),
                    destination: Address.formatAddressToPayment(travel.get("destinationJson"), travel.get("destination"))
                });
                travel.set('paymentId', pay[1]);
                let promises = [travel.save(null, {useMasterKey: true})];
                promises.push(PaymentModule.captureTransaction({
                    userId: driver.id,
                    id: travel.get("paymentId"),
                    destination: travel.get("destinationJson"),
                    cardId: travel.get("card").get("paymentId"),
                    driverId: travel.get("driver").id,
                    isDriver: travel.get("driver").get("isDriverApp"),
                    recipientId: travel.get("driver").get("recipientId"),
                    drive: travel.get("driver").get("recipientId"),
                    email: travel.get("user").get("email"),
                    cpf: travel.get("user").get("cpf"),
                    name: UserClass.instance().formatNameToPayment(travel.get("user")),
                    driverAmount: cancellValue,
                    totalAmount: parseFloat(cancellValue),
                    travelId: travel.id,
                    driverCpf: travel.get("driver").get("cpf")
                }));
                return Promise.all(promises)
            } else if (cancelledBy === "driver" && whoPay == "driver") {
                driver = travel.get('driver');
                if (driver.has('clientDebt')) {
                    driver.increment('clientDebt', cancellValue);
                    return driver.save(null, {useMasterKey: true});
                } else {
                    driver.set('clientDebt', cancellValue);
                    return driver.save(null, {useMasterKey: true});
                }
            }
            return Promise.resolve();
        },
        updateTravelsWithoutPlan: function () {
            return utils.findObject(Define.Travel, {"status": "completed"}, null, ["driver"], null, null, null, null, 10000).then(function (travels) {
                let promises = [];
                for (let i = 0; i < travels.length; i++) {
                    promises.push(promises.push(PlanClass.instance().feelPlanInTravel(travels[i])));
                }
                return Promise.all(promises);
            });
        },
        countTotalTravels: function (user) {
            const promises = [];
            promises.push(utils.countObject(Define.Travel, {"status": "completed", "driver": user}));
            promises.push(utils.countObject(Define.Travel, {"status": "completed", "user": user}));
            return Promise.all(promises).then(function (result) {
                user.set("totalTravelsAsDriver", result[0] || 0);
                user.set("totalTravelsAsUser", result[1] || 0);
                return Promise.resolve(user);
            });
        },
        callCountMethod: function (users) {
            const promises = [];
            for (let i = 0; i < users.length; i++) {
                promises.push(_super.countTotalTravels(users[i]));
            }
            return Promise.all(promises).then(function (result) {
                return Parse.Object.saveAll(result, {useMasterKey: true});
            });
        },
        updateTotalTravelsOfUser: function (page) {
            page = page || 0;
            let query = new Parse.Query(Parse.User);
            query.select([]);
            query.skip(page * 100);
            query.equalTo("totalTravelsAsDriver", null);
            return query.find().then(function (users) {
                if (users.length === 0)
                    return Promise.resolve();
                return _super.callCountMethod(users).finally(function () {
                    return _super.updateTotalTravelsOfUser(++page);
                });
            });
        },
        paidTravelWithCoupon: function (driverId, data) {
            return PaymentModule.transferValue({userId: driverId, value: data.value, type: "coupon"});
        },
        generateReceipt: async function (objectId, type, offset) {
            try {
                let travel = await utils.getObjectById(objectId, Define.Travel, ["user", "driver", "driver.plan", "fare", "discountObj", "origin", "destination", "card"]);
                if (travel.get("status") !== "completed") {
                    return Promise.reject({code: 400, message: "Esta viagem não possui recibo."});
                }
                if (type === "driver" && travel.get("receiptDriver")) {
                    return travel.get("receiptDriver");
                }
                if (type === "user" && travel.get("receiptPassenger")) {
                    return travel.get("receiptPassenger");
                }
                const price = travel.get("value");
                let fee = parseFloat((travel.get("fee") || 0).toFixed(2));
                const planFee = parseFloat((travel.get("planFee") || 0).toFixed(2));
                const _fees = {
                    fee: parseFloat(fee.toFixed(2)),
                    planFee,
                    valueWithFee: parseFloat(price.toFixed(2)),
                    valueWithoutFee: parseFloat((price - fee - planFee).toFixed(2))
                };
                let receipt = await _super.createReceiptHtml(travel, _fees, type === "driver", Messages(_language).receipt.file_html, offset);
                if (!receipt) return Promise.resolve();
                const url = await utils.convertHtmlToImage(receipt);
                if (!url) return Promise.resolve();
                if (type === "driver")
                    travel.set("receiptDriver", url);
                else
                    travel.set("receiptPassenger", url);
                await travel.save(null, {useMasterKey: true});
                return url;
            } catch (e) {
                return Promise.reject(e);
            }
        },
        refundTravelsCancelledBySystem: function () {
            return Promise.resolve();
            let query = new Parse.Query(Define.Travel);
            query.equalTo("cancelBy", "system");
            query.exists("card");
            query.select(["pagarmeId", "paymentId"]);
            // query.limit(1);
            query.skip(2);
            return query.find().then(function (travels) {
                let promises = [];
                for (let i = 0; i < travels.length; i++) {
                    promises.push(PaymentModule.refund({id: travels[i].get("paymentId")}));
                }
                return Promise.all(promises)
            });
        },
        createTravel: function (origin, destination, user, status, value, card, originInfo, destinationInfo, discount, fare, discountObj, obj, distance, time, paymentId, womenOnly, passengerLocation, coupon, offset, paidWithBonus, originalValue, appointmentDate, points) {
            // let bigMap = 'https://maps.googleapis.com/maps/api/staticmap?key=' + Define.MapsKey + '&size=600x300&maptype=roadmap&markers=color:green%7Clabel:I%7C' +
            //     obj.originLatitude + ',' + obj.originLongitude + '&markers=color:red%7Clabel:F%7C' + obj.destinationLatitude + ',' + obj.destinationLongitude;
            // let smallMap = 'https://maps.googleapis.com/maps/api/staticmap?key=' + Define.MapsKey + '&size=300x300&maptype=roadmap&markers=color:green%7Clabel:I%7C' +
            //     obj.originLatitude + ',' + obj.originLongitude;
            // let _big;
            // return utils.saveImageFromUrl(bigMap).then(function (bigM) {
            //     _big = bigM;
            //     return utils.saveImageFromUrl(smallMap);
            // }).then(function (smallM) {
            let _map = {
                bigMap: null,
                smallMap: null
            };
            let travel = new Define.Travel();
            // travel.set("origin", origin);
            travel.set("usingBonus", paidWithBonus);
            travel.set("originalValue", originalValue);
            travel.set("coupon", coupon);
            if (coupon) {
                let couponRelation = new Define.Coupon();
                couponRelation.set("objectId", coupon);
                travel.set("couponRelation", couponRelation);
            }
            travel.set("originJson", origin);
            travel.set("paymentId", paymentId ? paymentId.toString() : null);
            // travel.set("destination", destination);
            travel.set("destinationJson", destination);
            travel.set("user", user);
            travel.set("status", status);
            travel.set("passengerLocation", passengerLocation);
            travel.set("value", value - (discount || 0));
            travel.set("valueDriver", value - (discount || 0));
            travel.set("originInfo", originInfo);
            travel.set("destinationInfo", destinationInfo);
            travel.set("discount", discount);
            travel.set("discountObj", discountObj);
            if (fare) {
                travel.set("fare", fare);
                travel.set("originalFare", fare.toJSON());
            }
            travel.set("paidWithBonus", 0);
            travel.set("creditDriverBonus", 0);
            if (conf.usePlanRetention) {
                travel.set("fee", 0);
            } else {
                travel.set("fee", fare.get("retention"));
            }
            if (conf.bonusLevel && conf.bonusLevel.addFeeValue) {
                let valueToCalculate = travel.get("originalValue") || travel.get("value");
                travel.set("fee", (valueToCalculate - (valueToCalculate / conf.bonusLevel.addFeeValue)));
            }
            if (originalValue) {
                travel.set("couponValue", travel.get("originalValue") - travel.get("value"));
            }
            travel.set("map", _map);
            travel.set("distance", distance);
            travel.set("offset", offset);
            travel.set("time", time);
            travel.set("womenOnly", womenOnly);
            if (appointmentDate) {
                travel.set("appointmentDate", appointmentDate);
                travel.set("appointmentDateString", appointmentDate.getDate() + "-" + (appointmentDate.getMonth() + 1) + "-" + appointmentDate.getFullYear());
                travel.set("isScheduled", true);
            }
            if (card) travel.set("card", card);
            if (points) {
                let tPoints = [];
                for (let i = 0; i < points.length; i++) {
                    let type;
                    if (i === 0) {
                        type = 'origin'
                    } else if (i === points.length - 1) {
                        type = 'destination'
                    } else {
                        type = 'point'
                    }
                    let point = {
                        address: {
                            address: points[i].address.address,
                            city: points[i].address.city,
                            state: points[i].address.state,
                            zip: points[i].address.zip,
                            favorite: points[i].address.favorite,
                            location: {
                                __type: "GeoPoint",
                                latitude: points[i].address.latitude,
                                longitude: points[i].address.longitude
                            },
                            neighborhood: points[i].address.neighborhood,
                            number: points[i].address.number
                        },
                        visited: false,
                        visitedAt: undefined,
                        leftedAt: undefined,
                        duration: undefined,
                        type: type,
                    };
                    tPoints.push(point)
                }
                travel.set('points', tPoints);
                travel.set('currentStep', 0);
            }
            return travel.save(null, {useMasterKey: true});
            // })
        },
        calculateValue: function (fares, distance, time, mapDrivers, _currentUser) {
            mapDrivers = mapDrivers || {};
            let prices = [];
            for (let i = 0; i < fares.length; i++) {
                if (fares[i] != null) {
                    let capacity = "";
                    if (fares[i].get("category").get("minCapacity")) {
                        capacity = fares[i].get("category").get("minCapacity").toString();
                        if (fares[i].get("category").get("maxCapacity")) {
                            capacity += " - " + fares[i].get("category").get("maxCapacity").toString();
                        }
                    }
                    prices.push({
                        category: fares[i].get("category").get("woman") ? 'women' : (fares[i].get("category").get("type") || "common"),
                        type: fares[i].get("category").get("name"),
                        icon: fares[i].get("category").get("icon"),
                        capacity: capacity,
                        price: conf.payment.hidePayment ? 0 : Fare.calculateValue(fares[i], distance, time, _currentUser),
                        objectId: fares[i].id,
                        drivers: mapDrivers[fares[i].get("category").id] || []
                    });
                }
            }
            return prices;
        },
        updateStatus: function (travel, status, driver) {
            travel.set("status", status);
            // FirebaseClass.instance().saveTravelStatus(travel.id, status, driver);
        },
        travelStatus: function (user) {
            let queryUser = new Parse.Query(Define.Travel);
            queryUser.equalTo("user", user);
            queryUser.containedIn("status", ["waiting", "onTheWay", "onTheDestination"]);

            let queryDriver = new Parse.Query(Define.Travel);
            queryDriver.equalTo("driver", user);
            queryDriver.containedIn("status", ["new", "waiting", "onTheWay", "onTheDestination"]);


            let query = Parse.Query.or(queryDriver, queryUser);
            query.include(["user", "driver", "fare", "origin", "destination", "vehicle"]);
            query.descending("createdAt");
            return query.first();
        },
        cancelTravelWithoutDriver: function (travel, pushTitle, pushData) {
            return PushNotificationClass.instance().sendPushToDismissTravel(travel.id, travel.get("driversInCall")).then(function () {
                let language = travel.get("user").get("language");
                travel.set("status", "cancelled");
                travel.set("cancelDate", new Date());
                travel.set("cancelBy", "system");
                travel.set("errorReason", Messages(language).error.ERROR_NO_DRIVERS.message);
                travel.set("errorCode", Messages(language).error.ERROR_NO_DRIVERS.code);
                FirebaseClass.instance().removeTravelOfUser(travel.get("user").id);
                FirebaseClass.instance().removeTravelCopyOfUser(travel.get("user").id);

                if (travel.get("driver")) {
                    FirebaseClass.instance().removeTravelOfUser(travel.get("driver").id);
                }
                FirebaseClass.instance().saveTravelStatus(travel.id, null, null, {
                    status: travel.get("status"),
                    cancelBy: travel.get("cancelBy"),
                    errorReason: travel.get("errorReason"),
                    errorCode: travel.get("errorCode")
                });
                let promises = [];
                promises.push(travel.save(null, {useMasterKey: true}));
                if (travel.get("card")) {
                    promises.push(PaymentModule.refund({id: travel.get("paymentId")}));
                }
                promises.push(PushNotificationClass.instance().sendPush(travel.get("user").id, (pushTitle || Messages(language).push.driversBusy), (pushData || {
                    client: "passenger",
                    type: "busy"
                })));
                delete userInTravel[travel.get("user").id];
                blockedTravels[travel.id];
                client.set('userInTravel', JSON.stringify(userInTravel));
                promises.push(UserDiscountInstance.markUserDiscount(travel.get("user"), travel.get("coupon"), false));
                return Promise.all(promises);
            }, (error) => {
                console.log('error', error)
            });
        },
        verifyTravelsWithoutDriver: function () {

            let date = new Date();
            date = new Date(date.setMinutes(date.getMinutes() - 1));
            let _ids = [];
            const query = new Parse.Query(Define.Travel);
            query.limit(100);
            query.equalTo("status", "waiting");
            query.lessThanOrEqualTo("createdAt", date);
            query.select(["card", "pagarmeId", "paymentId", "user", "coupon"]);
            return query.find().then(function (travels) {
                if (travels.length === 0) {
                    return Promise.resolve();
                }
                let promises = [];
                for (let i = 0; i < travels.length; i++) {
                    if (!blockedTravels[travels[i].id])
                        promises.push(_super.cancelTravelWithoutDriver(travels[i]));
                }
                return Promise.all(promises);
            }, function (error) {
            });
        },
        calculateListLocationsTravel: async (list, sumDistance) => {
            const diff = list[list.length - 2].kilometersTo(list[list.length - 1]);
            let info = {distance: sumDistance + diff};
            return Promise.resolve(info);
        },
        formatLocationItem: (locations, obj, travel, type = null) => {
            try {
                if (!type || (type !== "initial" && type !== "final")) return;
                const initialType = type === "initial";
                if (!obj.type || obj.type !== type) {
                    let location = initialType ? travel.get("locationWhenInit") : {location: travel.get("finalLocation")};
                    location.type = type;
                    location.distance = 0;
                    location.date = initialType ? location.date : (travel.get("locationWhenComplete").date || null);
                    if (location.date && utils.verifyIsoDate(location.date))
                        location.timestamp = new Date(location.date).getTime();
                    if (initialType) {
                        locations.unshift(location);
                    } else {
                        locations.push(location);
                    }
                }
            } catch (e) {
                console.log("Error in format location item.", e);
            }
        },
        maxPredictionDistance: (originTimeStamps = null, destinyTimeStamps = null) => {
            try {
                if (!originTimeStamps || !destinyTimeStamps) return false;
                const origin = new Date(originTimeStamps), destiny = new Date(destinyTimeStamps);
                const {maxDistancePerSecond = 50} = conf.settingsOfDriverAlerts;
                const seconds = Math.abs(origin.getTime() - destiny.getTime()) / 1000;
                return (maxDistancePerSecond * seconds) / 1000;
            } catch (e) {
                return false;
            }
        },
        verifyTimeStampsInItemLocation: (item) => {
            if (!item.timestamp && utils.verifyIsoDate(item.date)) {
                item.timestamp = new Date(item.date).getTime();
                return item;
            }
            return item;
        },
        removeInvalidLocations: (item, index, locations) => {
            if (index === 0)
                return item;
            const origin = locations[index - 1], destiny = locations[index];
            const currentDistance = destiny.distance || 0;
            const maxDiffPermited = _super.maxPredictionDistance(origin.timestamp, destiny.timestamp);
            const ruleDistanceIsValid = maxDiffPermited && currentDistance > maxDiffPermited;
            //verificando se o distance do destino está no limite permitido
            if (ruleDistanceIsValid) {
                item.invalid = true;
                const next = locations[index + 1] || null;
                if (next)
                    next.type = "remake";
                return item;
            } else
                return item;
        },
        verifyLastDistance: (locations = []) => {
            const last = Array.isArray(locations) && locations.length >= 2 ? locations[locations.length - 1] : null;
            if (!last) return;
            const settingsOfDriverAlerts = conf.settingsOfDriverAlerts || null;
            if (settingsOfDriverAlerts) {
                const {maxDistanceLastLocation = 0.05} = settingsOfDriverAlerts;
                if ((last.distance || 0) > maxDistanceLastLocation && last.type !== "remake")
                    last.distance = 0;
            }
        },
        verifyIntervalsListLocation: async function (locations, travel) {
            try {
                const initial = locations[0];
                const final = locations[locations.length - 1];
                const oldSumDistance = travel.get("sumDistance");
                const speedLimitTop = 35, speedLimitBottom = 10;
                let changes = false, countUseMaps = 0, originalLength = locations.length, _speeds = [];
                locations = locations.map(_super.verifyTimeStampsInItemLocation);
                _super.formatLocationItem(locations, initial, travel, "initial");
                _super.formatLocationItem(locations, final, travel, "final");

                for (let i = 1; i < locations.length; i++) {
                    if (!locations[i].seconds) {
                        if (locations[i - 1].type && locations[i - 1].type.includes("endStop")) {//&& locations[i-2]){
                            locations[i].seconds = 10;
                        } else {
                            const origin = new Date(locations[i - 1].timestamp),
                                destiny = new Date(locations[i].timestamp);
                            const seconds = Math.abs(origin.getTime() - destiny.getTime()) / 1000;
                            locations[i].seconds = seconds;
                        }
                    }
                }

                for (let i = 1; i < locations.length; i++) {
                    const speed = typeof locations[i].speed === "number" ? locations[i].speed : null;
                    if (speed && !["beginStop", "endStop"].includes(locations[i].type)) {
                        if (locations[i].speed > 5.5) // 20 km/h
                            _speeds.push(Math.ceil(locations[i].speed));
                    } else if (locations[i - 1] && !["beginStop", "endStop"].includes(locations[i].type)) {
                        if (locations[i].seconds !== 0 && locations[i].distance !== 0) {
                            locations[i].speed = parseFloat(((locations[i].distance / locations[i].seconds) * 1000).toFixed(2));
                            if (locations[i].speed > 5.5)
                                _speeds.push(Math.ceil(locations[i].speed));
                        }
                    }
                }

                const modeArray = utils.getMode(_speeds);
                const speedMode = modeArray.reduce((a, b) => a + b, 0) / modeArray.length;
                const topRule = speedMode * 2; //+ (speedMode * 0.75);
                const bottomRule = speedMode - (speedMode * 0.5);
                const limitTop = topRule < speedLimitTop ? topRule : speedLimitTop;
                const limitBottom = bottomRule < speedLimitBottom ? bottomRule : speedLimitBottom;

                for (let i = 1; i < locations.length; i++) {
                    const speed = typeof locations[i].speed === "number" ? locations[i].speed : 0;
                    const distance = typeof locations[i].distance === "number" ? locations[i].distance : 0;
                    const type = locations[i].type;
                    const seconds = locations[i].seconds || 0;
                    const isNotStop = !["beginStop", "endStop"].includes(locations[i].type);
                    const isOutLimit = speed > limitTop; //(speed < limitBottom || speed > limitTop);
                    const isValidSpeed = speed > 0;
                    const isValidDistance = distance > 0;
                    const isValidSeconds = seconds > 0;
                    const rule1 = (isValidSpeed && isOutLimit);
                    const rule2 = (isValidDistance && !isValidSeconds);
                    const rule3 = false; //(distance > 0.500 && seconds <= 15);

                    if (isNotStop && (rule1 || rule2 || rule3)) {
                        if (locations[i + 1] && locations[i + 1].type !== "final") {
                            if (locations[i + 1].type !== "remake") {
                                locations[i + 1].type = locations[i + 1].type + "/remake";
                            } else {
                                locations[i + 1].type = "remake";
                            }
                            locations[i].invalid = true;
                        } else if (locations[i].type === "final") {
                            locations[i].type = "final/remake";
                        }
                    }
                }

                locations = locations.filter(location => !location.invalid);

                // _super.verifyLastDistance(locations);
                for (let i = 1; i < locations.length; i++) {
                    let origin = locations[i - 1].type === "endStop" && locations[i - 2] ? locations[i - 2] : locations[i - 1];
                    let destiny = locations[i];
                    const currentDistance = destiny.distance || 0;
                    if (!destiny.usedMaps && destiny.type !== "beginStop" && destiny.type !== "endStop" && ((currentDistance === 0 || (destiny.type).includes("remake")))) {
                        if (utils.validateLocation(origin.location) && utils.validateLocation(destiny.location)) {
                            const originLocation = new Parse.GeoPoint({
                                latitude: origin.location.latitude,
                                longitude: origin.location.longitude
                            });
                            const destinyLocation = new Parse.GeoPoint({
                                latitude: destiny.location.latitude,
                                longitude: destiny.location.longitude
                            });
                            let straightLineDistance = originLocation.kilometersTo(destinyLocation) || 0;
                            if (straightLineDistance > 0.500) {
                                const {distance = 0.001} = await MapsInstance.getDistanceBetweenPoints(origin.location, destiny.location);
                                straightLineDistance = distance;
                                locations[i].usedMaps = true;
                            }
                            countUseMaps++;
                            changes = true;
                            if (straightLineDistance > 0)
                                locations[i].distance = straightLineDistance;
                            else
                                locations[i].distance = 0;
                        }
                    }
                }
                const newSumDistance = locations.reduce((acc, item) => acc + item.distance, 0);
                if (changes || oldSumDistance !== newSumDistance || locations.length !== originalLength) {
                    travel.set("sumDistance", newSumDistance);
                    travel.set("listLocationInTravel", locations);
                    travel.set("countMapsToRecalculate", countUseMaps);
                    await travel.save(null, {useMasterKey: true});
                }
            } catch (e) {
                console.log("Error in verify intervals list location: ", e);
            }
        },
        verifyTypeOfRecalculate: async (travel, appVersion) => {
            const qConfig = await utils.findObject(Define.Config, null, true);

            if (qConfig.get("rulesToRecalculate").enabled)
                return Promise.resolve({distance: travel.get("distance")});
            const requiredAppVersion = conf.recalculateAppVersion || "4.0.12";
            const origin = travel.get("originJson") ? travel.get("originJson").location : travel.get("origin").get("location");
            const destiny = travel.get("finalLocation");
            const listLocationInTravel = travel.get("listLocationInTravel") || [];
            try {
                if (!conf.dontRecalculatePointToPoint && utils.verifyAppVersion(appVersion, requiredAppVersion) && listLocationInTravel.length > 2 && travel.get("sumDistance")) {
                    await _super.verifyIntervalsListLocation(listLocationInTravel, travel);
                    travel.set("isPointToPoint", true);
                    return Promise.resolve({distance: travel.get("sumDistance")});
                } else
                    return MapsInstance.getDistanceBetweenPoints(origin, destiny);
            } catch (e) {
                return MapsInstance.getDistanceBetweenPoints(origin, destiny);
            }
        },
        verifyIfNeedRecalculate: async (travel, offset, isAdmin, appVersion) => {
            let date = new Date;
            const qConfig = await utils.findObject(Define.Config, null, true);
            const rulesToRecalculate = qConfig ? qConfig.get("rulesToRecalculate") : {enabled: false};

            if ((!rulesToRecalculate.enabled) && !conf.chargeDriverStoppedTime && !conf.stops)
                return Promise.resolve({
                    value: travel.get('value'),
                    timeRecalculate: false,
                    distanceRecalculate: false,
                    endDateRecalculate: date,
                    originalFare: false
                });

            const {changeStoppedValue = false, stoppedValue = 0} = await _super.getAditionalValuesOfStops(travel);

            let diffTime = travel.get("expectedTime") ? utils.diffTimeinMinutes(travel.get("expectedTime"), date) : 0;
            let lastLocation = travel.get("locationWhenComplete") && travel.get("locationWhenComplete").location ? travel.get("locationWhenComplete").location : travel.get("finalLocation");
            let destinationLocation = travel.get("destinationJson") ? travel.get("destinationJson").location : travel.get("destination").get("location");
            let diffDistance = lastLocation.kilometersTo(destinationLocation);

            if ((isAdmin || (!rulesToRecalculate.enabled) || (diffDistance < rulesToRecalculate.minDiffKm && diffTime < rulesToRecalculate.minDiffMinutes)) && !changeStoppedValue) {
                return Promise.resolve({
                    value: travel.get('value'),
                    timeRecalculate: false,
                    distanceRecalculate: false,
                    endDateRecalculate: date,
                    originalFare: false
                })
            } else {
                return _super.verifyTypeOfRecalculate(travel, appVersion).then(async function (info) {
                    let time = utils.diffTimeinMinutes(travel.get("startDate"), date);
                    let value = rulesToRecalculate.enabled ?  Fare.calculateValue(travel.get("fare"), info.distance, time) : travel.get("value")
                    if (changeStoppedValue)
                        value += stoppedValue;
                    let result = {
                        value: value,
                        timeRecalculate: time,
                        distanceRecalculate: info.distance,
                        endDateRecalculate: date,
                        originalFare: travel.get("fare") ? travel.get("fare").toJSON() : undefined
                    };

                    if (conf.bonusLevel && conf.bonusLevel.addFeeValue) {
                        travel.set("fee", (value - (value / conf.bonusLevel.addFeeValue)));
                    }
                    let travelOldValues = {
                        time: travel.get('time'),
                        distance: travel.get('distance'),
                        originalValue: travel.get("originalValue"),
                        couponValue: travel.get("couponValue"),
                        expectedTime: travel.get("expectedTime"),
                        originalFare: travel.get("originalFare") || undefined,
                        fee: travel.get("fee"),
                        value: travel.get("value"),
                        failure: {},
                        oldPaymentId: travel.get("paymentId"),
                        rulesToRecalculate: rulesToRecalculate
                    };
                    if (value != travel.get("value")) {
                        travel.set('dataBeforeRecalculate', travelOldValues);
                    }
                    if (!travel.has("card")) {
                        return Promise.resolve(result);
                    } else if (value != travel.get("value")) {
                        let fValue = value;
                        if (travel.get('couponRelation')) {
                            if (travel.get('couponRelation').get('type') === 'value') {
                                fValue -= (travel.get('couponRelation').get('value') < fValue ? travel.get('couponRelation').get('value') : 0)
                            } else if (travel.get('couponRelation').get('type') === 'percent') {
                                fValue -= ((travel.get('couponRelation').get('value') / 100) * fValue)
                            }
                        }
                        let pagarmeTransaction = false;
                        let oldPaymentId = travel.get("paymentId");
                        travelOldValues.oldPaymentId = oldPaymentId;
                        try {
                            pagarmeTransaction = await PaymentModule.createCardTransaction({
                                travel: travel.id,
                                installments: 1,
                                userId: travel.get("user").id,
                                cardId: travel.get("card").get("paymentId"),
                                value: fValue,
                                customerId: travel.get("user").get("paymentId"),
                                cpf: travel.get("user").get("cpf"),
                                phone: travel.get("user").get("phone"),
                                name: UserClass.instance().formatNameToPayment(travel.get("user")),
                                email: travel.get("user").get("email"),
                                destination: Address.formatAddressToPayment(travel.get("destinationJson"), travel.get("destination")),
                            });
                        } catch (e) {
                            travelOldValues.failure = e;
                            travel.set('dataBeforeRecalculate', travelOldValues);
                            value = travel.get("value");
                            await travel.save();
                            return Promise.resolve(result);
                        }
                        if (pagarmeTransaction) {
                            travel.set("paymentId", pagarmeTransaction.id.toString());
                            let promises = [PaymentModule.refund({id: oldPaymentId}), travel.save()];
                            try {
                                let responses = await Promise.all(promises);
                            } catch (e) {
                                if (e[0] && e[0].code === 700) {
                                    value = travel.get("value");
                                }
                            }
                        }
                        return Promise.resolve(result);
                    } else {
                        return Promise.resolve(result);
                    }
                });
            }
        },
        getPaymentMethodOfTravel: function (travel) {
            if (!travel)
                return "";
            const lang = _language || null;
            if (travel.get("paidWithBonus") && travel.get("paidWithBonus") > 0 && travel.get("valueDriver") > 0)
                return Messages(lang).paymentMethod.cashAndBonus;
            if (travel.get("usingBonus") && travel.get("paidWithBonus") > 0)
                return Messages(lang).paymentMethod.bonus;
            if (!travel.get("coupon") && travel.get("value") === 0)
                return Messages(lang).paymentMethod.coupon;
            if (travel.get("coupon") && travel.get("value") === 0)
                return Messages(lang).paymentMethod.coupon;
            return travel.get("card") ? Messages(lang).paymentMethod.card : Messages(lang).paymentMethod.cash;
        },
        cancelTravel: async function (travel, user, offset, cancelByAdmin, cancelRefund, canCallAgain) {
            let promises = [];
            let driver = travel.get("driver");

            if (driver) {
                await FirebaseClass.instance().removeTravelOfUser(driver.id, travel.id);
                _super.travelInDismissArray(driver, travel.id);
                if (travel.get("status") === "completed" && !travel.get("card")) {
                    let inDebt = (travel.get("fee") || 0) + (travel.get("planFee") || 0);
                    if (driver.get("inDebt") == null) driver.set("inDebt", 0);
                    driver.increment("inDebt", -inDebt);
                    if (driver.get("balance") == null) driver.set("balance", 0);
                    driver.increment("balance", -travel.get("totalValue"));
                }
                driver.set("inTravel", false);

            }
            let date = new Date();

            let driverToSendDimissPush = [], mapLogs = travel.get("logDriversCall");
            for (let i = 0; i < (travel.get("driversReceivePush") && travel.get("driversReceivePush").length); i++) {
                let idDriver = travel.get("driversReceivePush")[i];
                if (mapLogs[idDriver] && !mapLogs[idDriver].dismiss) {
                    driverToSendDimissPush.push(idDriver);
                    let driver = await utils.getObjectById(idDriver, Parse.User);
                    _super.travelInDismissArray(driver, travel.id);
                }
            }
            if (canCallAgain && user.id !== travel.get("user").id && conf.recallAfterCancellation && new Date().getTime() < new Date(travel.get('acceptedDate').getTime() + conf.recallAfterCancellation.maxTime * 60 * 1000)) {
                let dCall = travel.get('logDriversCall');
                let _pushQuery = await PushNotificationClass.instance().queryToDriversNext(travel.get("fare").get("category"), travel.get("originJson").location, travel.get("user").get("womenOnly"), travel.get("user").get("gender"), 5, travel.get("offset"), null, travel.get("points") ? true : false);
                FirebaseClass.instance().removeTravelCopyOfUser(driver.id);
                let dCallAgain = [];
                const qConfig = await utils.findObject(Define.Config, null, true);
                if (!qConfig.get("splitCall") || true) {
                    for (let key in dCall) {
                        if (!dCall[key].dismiss && key !== user.id) dCallAgain.push(key);
                        if (key === user.id) dCall[key].dismiss = true
                    }
                }
                let qUser = utils.createQuery({Class: Parse.User, contained: {objectId: dCallAgain}});
                _pushQuery.matchesQuery('user', qUser);
                let json = await _super.formatPushRequestTravel(travel);
                try {
                    let _user = travel.get("driver") && user.id === travel.get("driver").id ? "user" : "driver";

                    /* Salvando logs de novas chamadas*/
                    if (dCallAgain.length > 0) {
                        _super.updateStatus(travel, "waiting");
                        FirebaseClass.instance().saveTravelStatus(travel.id, "waiting", null);
                        const logDriversCallAgain = travel.get("logDriversCallAgain") || [];
                        logDriversCallAgain.push({
                            date: new Date(),
                            currLogDriversCall: dCall
                        });
                        travel.set("logDriversCallAgain", [...logDriversCallAgain]);
                        io.emit("update", JSON.stringify({
                            type: Define.realTimeEvents.travelStatusChange,
                            id: travel.get("user").id,
                            status: "waiting",
                            isWaitingPassenger: travel.get("isWaitingPassenger"),
                            code: travel.get("errorCode"),
                            message: travel.get("errorMessage")
                        }));
                    } else {
                        if (user.id !== travel.get("user").id) {
                            io.emit("update", JSON.stringify({
                                type: Define.realTimeEvents.travelStatusChange,
                                id: travel.get("user").id,
                                status: "cancelled",
                                isWaitingPassenger: travel.get("isWaitingPassenger"),
                                code: Messages(_language).error.ERROR_NO_DRIVERS.code,
                                message: Messages(_language).error.ERROR_NO_DRIVERS.message
                            }));
                        }
                    }

                    if (travel.get('driver') && user.id === travel.get("user").id) {
                        io.emit("update", JSON.stringify({
                            type: Define.realTimeEvents.travelStatusChange,
                            id: travel.get('driver').id,
                            status: "cancelled",
                            isWaitingPassenger: travel.get("isWaitingPassenger"),
                            code: travel.get("errorCode"),
                            message: travel.get("errorMessage")
                        }));
                    }

                    if (driver) {
                        travel.unset("driver");
                        await travel.save(null, {useMasterKey: true});
                        driver.unset('current_travel');
                        promises.push(driver.save(null, {useMasterKey: true}));
                        if (user.id !== travel.get("user").id && conf.recallAfterCancellation) {
                            let _user = travel.get('user');
                            _user.unset('current_travel');
                            promises.push(_user.save(null, {useMasterKey: true}));
                        }
                    } else {
                        promises.push(travel.save(null, {useMasterKey: true}));
                    }

                    await PushNotificationClass.instance().sendPushOfRequestTravelToDrivers(
                        Messages(_language).push.requestTravel,
                        travel.get("originJson").location,
                        json,
                        travel.get("user").id,
                        travel, travel.get("fare").get("category"),
                        null,
                        travel.get("user").get("gender"),
                        _pushQuery,
                        50,
                        travel.get("offset"),
                        user.get("language"),
                        user && user.get("isDriverApp") ? "driver" : "passenger"
                    );
                    return Promise.all(promises);
                } catch (e) {
                    return Promise.reject(e)
                }

            } else {


                if (travel.get('driver') && user.id === travel.get("user").id) {
                    io.emit("update", JSON.stringify({
                        type: Define.realTimeEvents.travelStatusChange,
                        id: travel.get('driver').id,
                        status: "cancelled",
                        isWaitingPassenger: travel.get("isWaitingPassenger"),
                        code: travel.get("errorCode"),
                        message: travel.get("errorMessage")
                    }));
                } else {
                    io.emit("update", JSON.stringify({
                        type: Define.realTimeEvents.travelStatusChange,
                        id: travel.get("user").id,
                        status: "cancelled",
                        isWaitingPassenger: travel.get("isWaitingPassenger"),
                        code: travel.get("errorCode"),
                        message: travel.get("errorMessage")
                    }));
                }
                delete userInTravel[user.id];
                client.set('userInTravel', JSON.stringify(userInTravel));
                _super.updateStatus(travel, "cancelled");
                FirebaseClass.instance().saveTravelStatus(travel.id, "cancelled", null);
                FirebaseClass.instance().removeTravelOfUser(travel.get("user").id);
                travel.set("cancelDate", date);
                if (travel.get("user") && user.id === travel.get("user").id) {
                    FirebaseClass.instance().removeTravelCopyOfUser(travel.get("user").id);
                } else if (travel.get("driver") && user.id === travel.get("driver").id) {
                    FirebaseClass.instance().removeTravelCopyOfUser(travel.get("driver").id);
                }
                travel.set("cancelBy", user.id === travel.get("user").id ? "passenger" : "driver");
                //Add verificação de estorno para a 2 fatura gerada pela iugu
                if (travel.get("card") && !cancelRefund) {
                    if (conf.payment.module === "iugu" && travel.get("secondPaymentId") && travel.get("driver")) {
                        const driverRecipientId = await _super.getLiveApiTokenDriverIugu(travel.get("driver").id);
                        promises.push(PaymentModule.refundWhenAlreadyCapture({
                            id: travel.get("secondPaymentId"),
                            driverRecipientId
                        }));
                    } else
                        promises.push(PaymentModule.refund({
                            id: travel.get("paymentId"),
                            amount: travel.get('originalValue')
                        }));
                }
                promises.push(PushNotificationClass.instance().sendPush(null, "Corrida cancelada pelo usuário", {
                    objectId: travel.id,
                    type: Define.pushTypes.travelDismiss
                }, null, driverToSendDimissPush));
                promises.push(UserDiscountInstance.markUserDiscount(travel.get("user"), travel.get("coupon"), false));
                FirebaseClass.instance().saveTravelStatus(travel.id, "cancelled", null, {cancelBy: travel.get("cancelBy")});
                if (cancelByAdmin)
                    travel.set("cancelBy", "admin");
                promises.push(travel.save(null, {useMasterKey: true}));


                let _user = travel.get("driver") && user.id === travel.get("driver").id ? "user" : "driver";
                if (!cancelByAdmin && travel.get(_user))
                    promises.push(PushNotificationClass.instance().sendPush(travel.get(_user).id, Messages(travel.get(_user).get("language")).push.travelCancelledByDriver.replace("{{driver}}", user.get("name")), {
                        objectId: travel.id,
                        type: Define.pushTypes.travelCancel,
                        client: user.id === travel.get("user").id ? "passenger" : "driver"
                    }));


                if (driver) {
                    driver.unset('current_travel');
                    promises.push(driver.save(null, {useMasterKey: true}));
                }
                if (travel.get('user')) {
                    let _user = travel.get('user');
                    _user.unset('current_travel');
                    promises.push(_user.save(null, {useMasterKey: true}));
                }
                return Promise.all(promises);
            }
        },
        getDistanceToPassenger: function (location, originLocation) {
            if (!location) return Promise.resolve();
            return MapsInstance.getDistanceBetweenPoints(location, originLocation).then(function (info) {
                return Promise.resolve(info ? info.distance : null);
            });
        },
        formatTravelForDriver: function (travel, log, distanceToPassenger) {
            let obj = utils.formatPFObjectInJson(travel, ["distance", "time", "status", "cancelBy", "map", "fee", "cancellationFee", "apiVersion"]);
            obj.distance = parseFloat((obj.distance).toFixed(2)) || 0;
            obj.apiVersion = obj.apiVersion || null;
            obj.distanceToPassenger = distanceToPassenger;
            obj.hidePayment = (conf.payment && conf.payment.hidePayment) || false;
            obj.receipt = travel.get("receiptDriver");
            obj.origin = travel.get("originJson") ? travel.get("originJson") : utils.formatPFObjectInJson(travel.get("origin"), ["address", "number", "complement", "neighborhood", "city", "location"]);
            obj.destination = travel.get("destinationJson") ? travel.get("destinationJson") : utils.formatPFObjectInJson(travel.get("destination"), ["address", "number", "complement", "neighborhood", "city", "location"]);
            obj.client = utils.formatPFObjectInJson(travel.get("user"), ["lastName", "rate", "profileImage", "phone"]);
            obj.client.name = UserClass.instance().formatName(travel.get("user"));
            obj.payment = _super.getPaymentMethodOfTravel(travel);
            obj.isWaitingPassenger = travel.get("isWaitingPassenger") || false;
            obj.value = (conf.appName.toLowerCase() === "letsgo" && obj.status === "cancelled") ? 0 : obj.value;
            obj.paidWithBonus = parseFloat((travel.get("paidWithBonus") || 0).toFixed(2));
            obj.creditDriverBonus = parseFloat((travel.get("creditDriverBonus") || 0).toFixed(2));
            obj.valueDriver = (conf.appName.toLowerCase() === "letsgo" && obj.status === "cancelled") ? 0 : (travel.get("valueDriver") ? parseFloat(travel.get("valueDriver").toFixed(2)) : obj.value) + (travel.get("debtCharged") || 0);
            obj.type = travel.get("fare") && travel.get("fare").get("category") ? travel.get("fare").get("category").get("name") : "";
            obj.fee = parseFloat((travel.get("fee") + travel.get("planFee")).toFixed(2));
            obj.userRate = parseInt(travel.get("userRate"));
            obj.driverRate = parseInt(travel.get("driverRate") || 0);
            obj.serviceOrder = travel.get("serviceOrder") || null;
            obj.points = travel.get("points") || [];
            if (log) {
                obj.startDate = travel.has("startDate") ? travel.get("startDate") : (travel.get("cancelDate") || new Date());
                obj.driverRate = parseInt(travel.get("driverRate"));
                obj.userRate = parseInt(travel.get("userRate"));
                obj.valueDriver = (conf.appName.toLowerCase() === "letsgo" && obj.status === "cancelled") ? 0 : parseFloat((travel.get("valueDriver")).toFixed(2));
                obj.totalValue = parseFloat((travel.get("totalValue") || obj.value - obj.fee).toFixed(2));
            }
            if (conf.appName === "LetsGo") {
                let feeOfDay = travel.get("originalValue") || travel.get("value");
                feeOfDay -= (travel.get("fee") + (travel.get("networkPassengerValue") || 0) + (travel.get("networkDriverValue") || 0));
                feeOfDay -= travel.get("valueDriver");
                obj.feeDetails = [
                    {name: "VALOR DA CORRIDA: ", value: travel.get("originalValue") || travel.get("value")},
                    {
                        name: "CUSTOS FIXOS",
                        value: utils.toFloat(travel.get("fee") + (travel.get("networkPassengerValue") || 0))
                    },
                    {name: "TAXA DE GANHO COMP", value: utils.toFloat(travel.get("networkDriverValue") || 0)},
                    {
                        name: "TARIFA DIÁRIA",
                        value: utils.toFloat(travel.get("debitOfDriver") !== null ? travel.get("debitOfDriver") : feeOfDay)
                    },
                    {name: "VOCÊ RECEBE", value: travel.get("valueDriver")}];
            } else
                obj.feeDetails = ReceiptClass.formatReceiptMobileToDriver(travel, _language);
            return obj;
        },
        formatTravelToFirebase: async function (travel, initTravel, edited, toJsonResponse) {
            try {
                let obj = utils.formatPFObjectInJson(travel, ["currentStep", "points", "distance", "time", "valueDriver", "debtCharged", "status", "cancelBy", "errorReason", "errorCode", "map", "card"]);
                obj.origin = travel.get("originJson") ? travel.get("originJson") : utils.formatPFObjectInJson(travel.get("origin"), ["address", "number", "complement", "neighborhood", "city", "location"]);
                obj.destination = travel.get("destinationJson") ? travel.get("destinationJson") : utils.formatPFObjectInJson(travel.get("destination"), ["address", "number", "complement", "neighborhood", "city", "location"]);
                if (conf.stops) obj.maxStopedTime = conf.stops.maxStopedTime;
                if (edited) obj.edited = edited;
                obj.payment = _super.getPaymentMethodOfTravel(travel);
                if (initTravel && travel.get("driver")) {
                    obj.driver = utils.formatPFObjectInJson(travel.get("driver"), ["lastName", "rate", "profileImage", "phone", "enrollment"]);
                    obj.driver.name = UserClass.instance().formatName(travel.get("driver"));
                    if (obj.driver.phone && obj.driver.phone.length !== 8)
                        obj.driver.phone = "0" + obj.driver.phone;
                }
                obj.isWaitingPassenger = travel.get("isWaitingPassenger") || false;
                const oldVersionDriver = travel.get("driver") ? await utils.oldVersion(travel.get("driver")) : true;
                const oldVersionPassenger = travel.get("user") ? await utils.oldVersion(travel.get("user")) : false;
                if (travel.get("receiptPassenger"))
                    obj.receipt = travel.get("receiptPassenger");
                if (!oldVersionDriver && !oldVersionPassenger && !toJsonResponse)
                    return Promise.resolve(obj);

                obj.value = parseFloat(travel.get("value") ? travel.get("value").toFixed(2) : 0);
                obj.showDestiny = conf.showDestiny || false;
                obj.callUntil = travel.get("nextTimeToCall") ? new Date(travel.get("nextTimeToCall").getTime() + (conf.safeTimeSplit || 25000)).toISOString() : (new Date(new Date().getTime() + (conf.defaultInterval || 120000))).toISOString();
                obj.serviceOrder = travel.get("serviceOrder") || null;
                obj.hidePayment = (conf.payment && conf.payment.hidePayment) || false;
                let fare = travel.get("fare");
                if (initTravel && fare && fare.get("category") && fare.get("category").get("name")) {
                    obj.type = fare && fare.get("category") ? fare.get("category").get("name") : "";
                }
                if (initTravel && travel.get("user")) {
                    obj.client = utils.formatPFObjectInJson(travel.get("user"), ["lastName", "rate", "profileImage", "phone"]);
                    obj.client.name = UserClass.instance().formatName(travel.get("user"));
                    if (obj.client.phone && obj.client.phone.length !== 8)
                        obj.client.phone = "0" + obj.client.phone;

                }
                if (initTravel && travel.get("vehicle")) {
                    obj.vehicle = utils.formatPFObjectInJson(travel.get("vehicle"), ["brand", "model", "color", "plate"]);
                    obj.vehicle.category = (travel.get("vehicle").get("category") && travel.get("vehicle").get("category").get("type")) ? travel.get("vehicle").get("category").get("type") : "common";
                }
                if (travel.get("userRate"))
                    obj.userRate = parseInt(travel.get("userRate"));
                if (travel.get("driverRate"))
                    obj.driverRate = parseInt(travel.get("driverRate"));
                if (travel.get("fee"))
                    obj.fee = parseFloat(((travel.get("fee"))).toFixed(2));
                if (initTravel && obj.payment === "Cartão" && travel.get("card")) {
                    obj.card = utils.formatPFObjectInJson(travel.get("card"), ["brand", "numberCrip"]);
                }
                if (travel.get("startDate")) {
                    obj.startDateFormatted = travel.get("startDate").toISOString();
                }

                if (travel.get("paidWithBonus") || travel.get('couponValue'))
                    obj.forceDisplayValue = true;

                if (travel.has("status") && travel.get("status") === "completed") {
                    let lang = conf.appIsMultilingual ? _language : null;
                    obj.passengerFeeDetails = JSON.stringify(ReceiptClass.formatReceiptMobileToPassenger(travel, lang));
                    obj.driverFeeDetails = JSON.stringify(ReceiptClass.formatReceiptMobileToDriver(travel, lang));
                    if (!travel.get('driverFeeDetails') || !travel.get('passengerFeeDetails')) {
                        travel.set("driverFeeDetails", obj.driverFeeDetails)
                    }
                    if (!travel.get('passengerFeeDetails') || !travel.get('passengerFeeDetails')) {
                        travel.set("passengerFeeDetails", obj.passengerFeeDetails)
                    }
                    await travel.save(null, {useMasterKey: true})
                }
                if (conf.hasCancellation && obj.debtCharged)
                    obj.value = parseFloat((parseFloat(travel.get("value").toFixed(2)) + obj.debtCharged || 0).toFixed(2));
                if (conf.hasCancellation && obj.debtCharged && !obj.card)
                    obj.valueDriver = obj.valueDriver + obj.debtCharged;
                return Promise.resolve(obj);
            } catch (error) {
                return Promise.reject(error);
            }
        },
        formatTravelToFirebaseWhenComplete: function (travel) {
            let obj = utils.formatPFObjectInJson(travel, ["valueDriver", "debtCharged", "status", "driverFeeDetails", "passengerFeeDetails"]);
            obj.payment = _super.getPaymentMethodOfTravel(travel);
            obj.value = parseFloat(travel.get("value").toFixed(2));
            obj.passengerFeeDetails = JSON.stringify(ReceiptClass.formatReceiptMobileToPassenger(travel, _language));
            obj.driverFeeDetails = JSON.stringify(ReceiptClass.formatReceiptMobileToDriver(travel, _language));
            obj.serviceOrder = travel.get("serviceOrder") || null;
            if (travel.get("driver")) {
                obj.driver = utils.formatPFObjectInJson(travel.get("driver"), ["lastName", "rate", "profileImage", "phone", "enrollment"]);
                obj.driver.name = UserClass.instance().formatName(travel.get("driver"));
                if (obj.driver.phone)
                    obj.driver.phone = "0" + obj.driver.phone;
            }
            if (travel.get("user")) {
                obj.client = utils.formatPFObjectInJson(travel.get("user"), ["lastName", "rate", "profileImage", "phone"]);
                obj.client.name = UserClass.instance().formatName(travel.get("user"));
                if (obj.client.phone)
                    obj.client.phone = "0" + obj.client.phone;

            }
            return obj;
        },
        formatCardName: function (card) {
            let number = card.get("numberCrip");
            return card.get("brand").toUpperCase() + " " + number.substr(number.length - 4);
        },
        formatTravelForPassenger: function (travel, log) {
            let obj = utils.formatPFObjectInJson(travel, ["distance", "value", "time", "valueDriver", "status", "cancelBy", "errorReason", "map", "cancellationFee", "apiVersion", "appointmentDate"]);
            obj.distance = parseFloat((obj.distance).toFixed(2)) || 0;
            if (travel.get("receiptPassenger"))
                obj.receipt = travel.get("receiptPassenger");
            obj.apiVersion = obj.apiVersion || null;
            obj.value = (conf.appName.toLowerCase() === "letsgo" && obj.status === "cancelled") ? 0 : obj.value + (travel.get("debtCharged") || 0);
            obj.hidePayment = (conf.payment && conf.payment.hidePayment) || false;
            obj.origin = travel.get("originJson") ? travel.get("originJson") : utils.formatPFObjectInJson(travel.get("origin"), ["address", "number", "complement", "neighborhood", "city", "location"]);
            obj.destination = travel.get("destinationJson") ? travel.get("destinationJson") : utils.formatPFObjectInJson(travel.get("destination"), ["address", "number", "complement", "neighborhood", "city", "location"]);
            obj.payment = _super.getPaymentMethodOfTravel(travel);
            obj.isWaitingPassenger = travel.get("isWaitingPassenger") || false;
            obj.paidWithBonus = parseFloat((travel.get("paidWithBonus") || 0).toFixed(2));
            obj.creditDriverBonus = parseFloat((travel.get("creditDriverBonus") || 0).toFixed(2));
            obj.type = travel.get("fare") && travel.get("fare").get("category") ? travel.get("fare").get("category").get("name") : "";
            obj.serviceOrder = travel.get("serviceOrder") || null;
            obj.points = travel.get("points") || [];
            if (travel.get("fare") && travel.get("fare").get("category") && travel.get("fare").get("category").get("name"))
                obj.type = travel.get("fare") && travel.get("fare").get("category") ? travel.get("fare").get("category").get("name") : "";
            if (travel.get("driver")) {
                obj.driver = utils.formatPFObjectInJson(travel.get("driver"), ["lastName", "rate", "profileImage", "phone", "enrollment"]);
                obj.driver.name = UserClass.instance().formatName(travel.get("driver"));
            }
            if (travel.get("user")) {
                obj.client = utils.formatPFObjectInJson(travel.get("user"), ["lastName", "rate", "profileImage", "phone"]);
                obj.client.name = UserClass.instance().formatName(travel.get("user"));
            }
            if (travel.get("vehicle")) {
                obj.vehicle = utils.formatPFObjectInJson(travel.get("vehicle"), ["brand", "model", "color", "plate"]);
            }
            if (travel.get("userRate"))
                obj.userRate = parseInt(travel.get("userRate"));
            if (travel.get("driverRate"))
                obj.driverRate = parseInt(travel.get("driverRate"));
            if (travel.get("startDate") || travel.get("cancelDate"))
                obj.startDate = travel.get("startDate") || travel.get("cancelDate");
            if (log) {
                obj.fee = (travel.get("fee") ? parseFloat(((travel.get("fee"))).toFixed(2)) : 0);
                if (obj.payment === "Cartão" && travel.get("card")) {
                    obj.card = utils.formatPFObjectInJson(travel.get("card"), ["brand", "numberCrip"]);
                }
            }
            obj.feeDetails = ReceiptClass.formatReceiptMobileToPassenger(travel, _language);
            return obj;
        },
        createReceiptHtml: function (travel, fees, isDriverReceipt, file, offset) {
            let date = travel.get('endDate') || new Date();
            date = utils.setTimezone(date, offset);
            let timePeriod = date.getHours() >= 0 && date.getHours() < 12 ? "am" : "pm";
            let payment = _super.getPaymentMethodOfTravel(travel);
            let paymentDataHtml = "";
            let month = date.getMonth() + 1;
            let sum = parseFloat((fees.fee + fees.planFee).toFixed(2));
            let valuesHtml = isDriverReceipt ? _super.getValueByTypeDriver(travel) : _super.getValueByTypePassenger(travel);
            paymentDataHtml = utils.formatPaymentData(travel, date, month, _language);
            let originJson = travel.get("originJson");
            let destinationJson = travel.get("destinationJson");
            let data = {
                date: date.getDate() + "." + month + "." + date.getFullYear(),
                time: date.getHours() + ":" + (date.getMinutes() < 10 ? '0' + date.getMinutes().toString() : date.getMinutes()) + " " + timePeriod,
                payment: payment,
                streetOrigin: originJson ? originJson.address || "-" : "-",
                numberOrigin: originJson ? originJson.number || "-" : "-",
                neighborhoodOrigin: originJson ? originJson.neighborhood || "-" : "-",
                cityOrigin: originJson ? originJson.city || "-" : "-",
                streetDestination: destinationJson ? destinationJson.address || "-" : "-",
                numberDestination: destinationJson ? destinationJson.number || "-" : "-",
                neighborhoodDestination: destinationJson ? destinationJson.neighborhood || "-" : "-",
                cityDestination: destinationJson ? destinationJson.city || "-" : "-",
                valueWithoutFee: fees.valueWithoutFee,
                values: valuesHtml,
                paymentData: paymentDataHtml,
                valueWithFee: conf.hasCancellation && travel.get('debtCharged') ? fees.valueWithFee + travel.get('debtCharged') : fees.valueWithFee,
                objectId: travel.id
            };
            let filepath = './mails/' + file + ".html";
            let promise = new Promise((resolve, reject) => {
                fs.readFile(filepath, "utf8", async function (err, htmlBody) {
                    if (err) {
                        reject(err);
                    }
                    data = await Mail.addCustomFields(data);
                    for (let key in data) {
                        htmlBody = htmlBody.replace(new RegExp("{{" + key + "}}", "g"), data[key]);
                    }
                    resolve(htmlBody);
                });
            });

            return promise;
        },
        notifyUserForBadRate: function (dateField, rateField, isDriver) {
            let userType = isDriver ? "driver" : "user";
            let date = new Date();
            let yesterday = new Date(date.setHours(date.getHours() - 24));
            date = new Date();
            let query = new Parse.Query(Define.Travel);
            query.lessThanOrEqualTo(dateField, date);
            query.greaterThanOrEqualTo(dateField, yesterday);
            query.lessThan(rateField, 3);
            query.include(["driver", "user", "driver.email", "user.email"]);
            query.limit(9999);
            return query.find({useMasterKey: true}).then(function (travels) {
                let users2Email = {};
                for (let i = 0; i < travels.length; i++) {
                    let user = travels[i].get(userType);
                    let data = {name: UserClass.instance().formatName(user)};
                    if (!users2Email[user.id]) {
                        users2Email[user.id] = {
                            data: data,
                            email: user.get("email")
                        }
                    }
                }
                let users = [];
                for (let key in users2Email) {
                    users.push(users2Email[key]);
                }
                return utils.readHtmlMultipleTimes(Define.emailHtmls.review.html, users);
            }).then(function (usersHtml) {
                let promises = [];
                for (let i = 0; i < usersHtml.length; i++) {
                    promises.push(Mail.sendEmail(usersHtml[i].email, Define.emailHtmls.review.subject, usersHtml[i].html));
                }
                return Promise.all(promises);
            }).finally(function () {
                return Promise.resolve('ok');
            })
        },
        notifyPassengerForBadRate: function () {
            return _super.notifyUserForBadRate("driverRateDate", "driverRate", false);
        },
        notifyDriversForBadRate: function () {
            return _super.notifyUserForBadRate("userRateDate", "userRate", true);
        },
        calculeTravelValues: function (travel, _plan) {
            let price = travel.get("value"); //discount was already considered
            let fee = parseFloat(travel.get("fee").toFixed(2));
            let planFee = 0, companyAmount = 0;
            let withouFee = 0;
            let driver = travel.get("driver");
            if (conf.calculateFinalValueWithoutFee) {
                price -= fee;
                withouFee = fee;
                fee = 0;
            }
            planFee = parseFloat((price * (_plan.get("percent") / 100)).toFixed(2)); //Free fee
            travel.set("planFee", planFee);
            companyAmount = fee + planFee;
            let valueDriver = travel.has("card") ? (price + withouFee - companyAmount) : price + withouFee;
            travel.set("valueDriver", valueDriver);
            travel.set("totalValue", price - fee - planFee);
            let inDebt = parseFloat((travel.has("card") ? driver.get("inDebt") : (driver.get("inDebt") || 0) + fee + planFee).toFixed(2));

            if (conf.chargeDebitInCard && travel.has('card')) {
                if (inDebt > 0 && inDebt >= travel.get("totalValue")) {
                    companyAmount += travel.get("totalValue");
                    inDebt = inDebt - travel.get("totalValue");
                    travel.set("totalValue", 0);
                } else if (inDebt > 0 && inDebt < travel.get("totalValue")) {
                    travel.set("totalValue", travel.get("totalValue") - inDebt);//18.91
                    companyAmount += parseFloat(inDebt.toFixed(2));//5.04
                    inDebt = 0;
                }
                if (inDebt != null) {
                    driver.set("inDebt", inDebt);
                    travel.set("driver", driver);
                }
            }
            driver.set("inDebt", inDebt);
            let balance = travel.has("card") ? (driver.get("balance") || 0) + travel.get("totalValue") : (driver.get("balance") || 0) + travel.get("value");
            driver.set("balance", balance);
            if (!driver.get("totalTravelsAsDriver")) {
                driver.set("totalTravelsAsDriver", 0);
            }
            driver.increment("totalTravelsAsDriver");
            let user = travel.get("user");
            if (!user.get("totalTravelsAsUser")) {
                user.set("totalTravelsAsUser", 0);
            }
            user.increment("totalTravelsAsUser");
            user.set("totalSpent", user.get("totalSpent") || 0 + travel.get("value"));

            if (travel.get("discountObj")) {
                travel.get("discountObj").set("used", true);
            }
            travel.set("driver", driver);
            travel.set("user", user);
            return travel;
        },
        verifyTravelsInNew: function () {
            let query = new Parse.Query(Define.Travel);
            query.equalTo("status", "new");
            query.select([]);
            return query.find().then(function (travels) {
                for (let i = 0; i < travels.length; i++) {
                    RedisJobInstance.addJob("Travel", "createTravelWithRedis", {objectId: travels[i].id});
                }
                return Promise.resolve();
            });
        },
        formatPushRequestTravel: async function (travel) {
            let categoryName = "";
            if (travel.get("fare") && travel.get("fare").get("category") && travel.get("fare").get("category").get("name"))
                categoryName = travel.get("fare").get("category").get("name");
            let date = new Date();
            const qConfig = await utils.findObject(Define.Config, null, true);
            const timeInSeconds = qConfig.get("splitCall") && qConfig.get("splitCall").splitTimeInSeconds ? qConfig.get("splitCall").splitTimeInSeconds : 0;
            let obj = {
                timeInSeconds: timeInSeconds || 0,
                objectId: travel.id,
                callUntil: travel.get("nextTimeToCall") ? new Date(travel.get("nextTimeToCall").getTime() + (conf.safeTimeSplit || 25000)).toISOString() : (new Date(new Date().getTime() + (timeInSeconds ? timeInSeconds * 10000 : 120000)).toISOString()),
                showDestiny: conf.showDestiny || false,
                hidePayment: (conf.payment && conf.payment.hidePayment) || false,
                hidePaymentType: conf.hidePaymentType || false,
                client: "driver",
                type: Define.pushTypes.travelRequest,
                origin: _super.formatAddress(travel.get("originJson") || null),
                destination: _super.formatAddress(travel.get("destinationJson") || null),
                name: UserClass.instance().formatName(travel.get("user") || null),
                profileImage: travel.get("user") ? travel.get("user").get("profileImage") || "" : "",
                payment: _super.getPaymentMethodOfTravel(travel),
                rate: travel.get("user") ? travel.get("user").get("rate") || "" : "",
                category: categoryName,
                inicialTime: date.getTime(),
                finalTime: date.getTime() + (qConfig.get("splitCall").splitTimeInSeconds ? qConfig.get("splitCall").splitTimeInSeconds : 10) * 1000,
            };
            if (qConfig.get("splitCall") && qConfig.get("splitCall").countReceivers === 1) {
                obj.inicialTime = date.getTime();
                obj.finalTime = obj.inicialTime + ((qConfig.get("splitCall") && qConfig.get("splitCall").splitTimeInSeconds) ? qConfig.get("splitCall").splitTimeInSeconds : 10) * 1000;
            } else if (conf.splitCall && conf.splitCall.countReceivers === 1) {
                obj.inicialTime = date.getTime();
                obj.finalTime = obj.inicialTime + conf.splitCall.splitTimeInSeconds * 1000;
            }
            return obj;
        },

        createTravelWithRedis: async function (id) {
            travelInitializing = await getAsync('travelInitializing') || travelInitializing;
            travelInitializing = JSON.parse(travelInitializing);
            if (travelInitializing[id]) return Promise.resolve();
            travelInitializing[id] = true;
            client.set('travelInitializing', JSON.stringify(travelInitializing));
            let query = new Parse.Query(Define.Travel);
            query.include(["category", "fare", "fare.category", "user", "card"]);
            let _travel, _maxDistance, _pushQuery, _user;
            let status = "waiting";
            query.equalTo("status", "new");
            return query.get(id, {useMasterKey: true}).then(function (travel) {
                _travel = travel;
                io.emit("update", JSON.stringify({
                    type: Define.realTimeEvents.travelStatusChange,
                    id: _travel.get('user').id,
                    status: "waiting",
                    isWaitingPassenger: _travel.get("isWaitingPassenger")
                }));
                _user = travel.get("user");
                return RadiusClass.instance().findRadiusByLocation(travel.get("originJson").state, travel.get("originJson").city);
            }).then(function (maxDistance) {
                _maxDistance = maxDistance;
                return PushNotificationClass.instance().queryToDriversNext(_travel.get("fare").get("category"), _travel.get("originJson").location, _travel.get("user").get("womenOnly"), _travel.get("user").get("gender"), _maxDistance, _travel.get("offset"), null, (_travel && _travel.get("points")) ? true : false);
            }).then(function (query) {
                _pushQuery = query;
                return _pushQuery.count({useMasterKey: true})
            }).then(async function (count) {
                if (count === 0) {
                    _user.unset('current_travel');
                    await _user.save(null, {useMasterKey: true});
                    FirebaseClass.instance().removeTravelCopyOfUser(_travel.get('user').id);
                    FirebaseClass.instance().removeTravelOfUser(_travel.get('user').id);
                    status = "cancelled";
                    _travel.set("cancelBy", "noDrivers");
                    io.emit("update", JSON.stringify({
                        type: Define.realTimeEvents.travelStatusChange,
                        id: _travel.get("user").id,
                        status: "cancelled",
                        isWaitingPassenger: _travel.get("isWaitingPassenger"),
                        code: Messages(_user.get("language")).error.ERROR_NO_DRIVERS.code,
                        message: Messages(_user.get("language")).error.ERROR_NO_DRIVERS.message
                    }));
                    return Promise.reject(Messages(_user.get("language")).error.ERROR_NO_DRIVERS);
                }
                return _travel.get("card") ? PaymentModule.createCardTransaction(
                    {
                        cardId: _travel.get("card").get("paymentId"),
                        userId: _travel.get("user").id,
                        customerId: _travel.get("user").get("paymentId"),
                        cpf: _travel.get("user").get("cpf"),
                        phone: _travel.get("user").get("phone"),
                        name: UserClass.instance().formatNameToPayment(_travel.get("user")),
                        email: _travel.get("user").get("email"),
                        installments: 1,
                        travel: _travel.id,
                        showDestiny: conf.showDestinyInformations || false,
                        destination: Address.formatAddressToPayment(_travel.get("destinationJson")),
                        value: _travel.get("value"),
                    }) : Promise.resolve(null);
            }).then(async function (pagarmeTransaction) {
                if (pagarmeTransaction)
                    _travel.set("paymentId", pagarmeTransaction.id.toString());
                let json;
                try {
                    json = await _super.formatPushRequestTravel(_travel);
                } catch (e) {
                    console.log(e)
                }
                let promises = [];
                promises.push(PushNotificationClass.instance().sendPushOfRequestTravelToDrivers(Messages(_user.get("language")).push.requestTravel, _travel.get("originJson").location, json, _travel.get("user").id, _travel, _travel.get("fare").get("category"), null, _travel.get("user").get("gender"), _pushQuery, _maxDistance, _travel.get("offset"), _user.get("language")));
                promises.push(Activity.createActivity(Define.activities.travelRequest, {
                    id: _travel.get("user").id,
                    name: _travel.get("user").get("name"),
                    photo: _travel.get("user").get("profileImage")
                }, Define.activityMessage.travelRequest));
                return Promise.all(promises);
            }).then(async function () {
                _travel.set("status", status);
                travelInitializing[id] = null;
                client.set('travelInitializing', JSON.stringify(travelInitializing));
                FirebaseClass.instance().saveTravelStatus(id, status, null, await _super.formatTravelToFirebase(_travel));
                return _travel.save();
            }, async function (error) {
                const userTravel = _travel.get("user")
                if (userTravel) {
                    userTravel.unset('current_travel')
                    await userTravel.save(null, {useMasterKey: true})
                }
                console.log("error", error);
                _travel.set("errorReason", error.message);
                _travel.set("errorCode", error.code);
                if (!_travel.get("cancelBy"))
                    _travel.set("cancelBy", "byError");
                _travel.set("status", "cancelled");
                if (!_travel.get("isScheduled"))
                    _travel.set("deleted", true);
                UserDiscountInstance.markUserDiscount(_travel.get("user"), _travel.get("coupon"), false);
                travelInitializing[id] = null;
                client.set('travelInitializing', JSON.stringify(travelInitializing));
                io.emit("update", JSON.stringify({type: Define.realTimeEvents.travelStatusChange, id: _travel.get('user').id, status: "cancelled", isWaitingPassenger:  _travel.get("isWaitingPassenger"), code: _travel.get("errorCode"), message: _travel.get("errorMessage")}));

                FirebaseClass.instance().removeTravelOfUser(_travel.get("user").id);
                FirebaseClass.instance().removeTravelCopyOfUser(_travel.get("user").id);
                FirebaseClass.instance().saveTravelStatus(id, "cancelled", null, await _super.formatTravelToFirebase(_travel));

                delete userInTravel[_travel.get("user").id];
                client.set('userInTravel', JSON.stringify(userInTravel));
                return _travel.save();
            });
        },
        acceptTravelWithRedis: function (travelId) {
            let _travel, _vehicle;

            return utils.getObjectById(travelId, Define.Travel, ["user", "driver"], {"status": "waiting"}).then(function (travel) {
                _travel = travel;
                if (_travel.get("user").id === _travel.get("driver").id) {
                    return Promise.reject(Messages(_travel.get("driver").get("language")).error.ERROR_SAME_USER);
                }
                let promises = [];
                promises.push(FirebaseClass.instance().getDriverLocation(_travel.get("driver").id, _travel.get("driver")));
                promises.push(PlanClass.instance().getDefaultPlan(_travel.get("driver").get("plan")));
                promises.push(utils.findObject(Define.Vehicle, {
                    "primary": true,
                    "user": _travel.get("driver")
                }, true, ["user", "category"]));
                let i = 0;

                let pushToDrivers = _travel.get("driversReceivePush") || [];
                for (; i < pushToDrivers.length; i++) {
                    if (pushToDrivers[i] === _travel.get("driver").id) {
                        break;
                    }
                }
                pushToDrivers.splice(i, 1);
                promises.push(PushNotificationClass.instance().sendPushToDismissTravel(_travel.id, pushToDrivers, _travel.get("user").get("language")));
                promises.push(Activity.travelAccept(_travel.get("driver").id, _travel.get("driver").get("name"), _travel.get("driver").get("profileImage"), _travel.id));
                return Promise.all(promises);
            }).then(function (promisesResult) {
                _travel.set("locationWhenAccept", promisesResult[0]);
                if (conf.usePlanRetention) {
                    _travel.set("fee", promisesResult[1].get("retention") || 0);
                }
                _vehicle = promisesResult[2];
                // let promises = [];
                _travel.set("vehicle", _vehicle);
                _travel.set("status", "onTheWay");
                _travel.set("acceptedDate", new Date());

                let promises = [];
                promises.push(_travel.save(null, {useMasterKey: true}));
                promises.push(PushNotificationClass.instance().sendTravelAcceptedPush(_travel.get("user").id, _travel.id, _travel.get("driver").get("name"), _vehicle, _travel.get("user").get("language")));
                return Promise.all(promises);
            }).then(function () {
                FirebaseClass.instance().startTravel(_travel.id, _travel.get("driver"), _travel.get("user"));
                FirebaseClass.instance().saveTravelStatus(_travel.id, "onTheWay", null, _super.formatTravelToFirebase(_travel, true));
                delete travelsWaiting[travelId];
                client.set('travelsWaiting', JSON.stringify(travelsWaiting));
                return _response.success(Messages(_travel.get("driver").get("language")).success.EDITED_SUCCESS);
            }, function (error) {
                delete travelsWaiting[travelId];
                client.set('travelsWaiting', JSON.stringify(travelsWaiting));
                let _error;
                if (error.code === 101) {
                    _error = Messages(_travel.get("driver").get("language")).error.ERROR_INVALID_TRAVEL;
                } else _error = error;
                _response.error(_error.code, _error.message);
            });
        },
        completeTravelWithRedis: function (id) {
            let travel, companyAmount = 0, driver, _plan;
            let promises = [];
            return utils.getObjectById(id, Define.Travel, ["user", "driver", "driver.plan", "user.whoReceiveBonusInvite", "fare", "discountObj", "card"]).then(function (t) {
                travel = t;
                driver = travel.get("driver");
                promises.push(PlanClass.instance().getDefaultPlan(driver.get("plan")));
                promises.push(FirebaseClass.instance().getDriverLocation(travel.get("driver").id, travel.get("driver")));
                promises.push(_super.verifyIfNeedRecalculate(travel, travel.get("offset")));
                return Promise.all(promises);
            }).then(function (resultPromises) {
                _plan = resultPromises[0];
                travel.set("locationWhenComplete", resultPromises[1]);
                travel.set("plan", _plan);
                travel.set("value", resultPromises[2]);
                let date = new Date;
                travel.set("duration", Math.abs((date.getTime() - travel.get("startDate").getTime()) / 1000));
                travel.set("endDate", date);
                travel = _super.calculeTravelValues(travel, _plan);
                travel.get("driver").set("inTravel", false);
                let totalValue = parseFloat(travel.get("totalValue").toFixed(2));
                promises = [];
                let finalValue = parseFloat(travel.get("value").toFixed(2));

                promises.push(travel.has("card") ? PaymentModule.captureTransaction({
                    userId: driver.id,
                    id: travel.get("paymentId"),
                    destination: travel.get("destination"),
                    cardId: travel.get("card").get("paymentId"),
                    driverId: travel.get("driver").id,
                    recipientId: travel.get("driver").get("recipientId"),
                    isDriver: travel.get("driver").get("isDriverApp"),
                    email: travel.get("user").get("email"),
                    cpf: travel.get("user").get("cpf"),
                    name: UserClass.instance().formatNameToPayment(travel.get("user")),
                    driverAmount: totalValue,
                    totalAmount: finalValue,
                    travelId: travel.id,
                    driverCpf: travel.get("driver").get("cpf")
                }) : Promise.resolve());
                promises.push(BonusInstance.setBonusToUser(travel));
                promises.push(travel.get("driver").save(null, {useMasterKey: true}));
                let origin = travel.get("locationWhenInit").location;
                let destiny = travel.get("locationWhenComplete").location;
                if (origin && destiny)
                    promises.push(utils.generateMapImage(origin.latitude, origin.longitude, destiny.latitude, destiny.longitude));
                return Promise.all(promises);
            }).then(function (resultPromises) {
                if (resultPromises[0] == true) {
                    if (travel.get('user').has('clientDebt')) {
                        let _client = travel.get('user');
                        _client.increment('clientDebt', -1 * travel.get('debtCharged'))
                    }
                    driver.set("inDebt", _currentUser.get("inDebt") - (travel.get("valueDriver")));
                    travel.set("driver", driver);
                    _currentUser.set("inDebt", _currentUser.get("inDebt") - (travel.get("valueDriver")));
                }
                if (resultPromises.length > 3) {
                    let images = travel.get("map") || {};
                    images.bigMap = resultPromises[3];
                    travel.set("map", images)
                }
                travel.set("status", "completed");
                promises.push(PushNotificationClass.instance().sendPushToCompleteTravel(travel.get("user").id, travel.id, travel.get("user").get("language")));
                promises.push(travel.save(null, {useMasterKey: true}));
                promises.push(Activity.completeTravel(travel.id, travel.get("user").id, travel.get("user").get("name"), travel.get("user").get("profileImage"), travel.get("driver").id, travel.get("driver").get("name"), travel.get("driver").get("profileImage")));
                return Promise.all(promises);
            }).then(async function () {
                FirebaseClass.instance().saveTravelStatus(travel.id, "completed", null, await _super.formatTravelToFirebase(travel));
                FirebaseClass.instance().removeTravelOfUser(travel.get("user").id);
                FirebaseClass.instance().removeTravelOfUser(travel.get("driver").id);
                return _response.success({valueDriver: parseFloat(travel.get("valueDriver").toFixed(2))});
            }, function (error) {
                _response.error(error.code, error.message);
            });
        },
        formatAddress: function (json) {
            json = json || {};
            return {
                number: json.number || "",
                address: json.address || "",
                city: json.city || "",
                state: json.state || "",
                neighborhood: json.neighborhood || "",
            };
        },
        formatSubject: function (id) {
            let subject;
            if (conf.appIsMultilingual) {
                subject = !_language || _language === "pt" ? Define.emailHtmls.receipt.subject : Define.emailHtmls.receipt.subject_en
            } else {
                subject = Define.emailHtmls.receipt.subject;
            }

            return subject + " - " + id.toUpperCase();
        },
        getValueByTypePassenger: (travel) => {
            return ReceiptClass.formatReceiptWebToPassenger(travel, _language);
        },
        getValueByTypeDriver: (travel) => {
            let driverValues = "";
            if (conf.appName === "LetsGo") {
                let feeOfDay = travel.get("originalValue") || travel.get("value");
                feeOfDay -= (travel.get("fee") + (travel.get("networkPassengerValue") || 0) + (travel.get("networkDriverValue") || 0));
                feeOfDay -= travel.get("valueDriver");
                driverValues +=
                    " <div style=\"float: left;\">VALOR DA CORRIDA:</div>" +
                    " <div style=\"float: right; margin-right: 20px;\">R$" + (travel.get("originalValue") || travel.get("value")).toFixed(2) + "</div>\n <br>" +
                    " <div style=\"float: left;\">CUSTOS FIXOS:</div>" +
                    " <div style=\"float: right; margin-right: 20px;\">R$" + utils.toFloat(travel.get("fee") + (travel.get("networkPassengerValue") || 0)) + "</div>\n <br>" +
                    " <div style=\"float: left;\">TAXA DE GANHO COMPARTILHADOS:</div>" +
                    " <div style=\"float: right; margin-right: 20px;\">R$" + utils.toFloat(travel.get("networkDriverValue") || 0) + "</div>\n <br>" +
                    " <div style=\"float: left;\">CUSTOS FIXOS:</div>" +
                    " <div style=\"float: right; margin-right: 20px;\">R$" + utils.toFloat(travel.get("fee") + (travel.get("networkPassengerValue") || 0)) + "</div>\n <br>" +
                    " <div style=\"float: left;\">TARIFA DIÁRIA:</div>" +
                    " <div style=\"float: right; margin-right: 20px;\">R$" + travel.get("debitOfDriver") ? travel.get("debitOfDriver") : feeOfDay + "</div>\n <br><br>" +
                        " <div style=\"float: left; color: #333;\"><b>VOCÊ RECEBE </b></div>\n" +
                        " <div style=\"float: right; margin-right: 20px; color: #333;\"><b>R$" + travel.get("valueDriver").toFixed(2) + "</b></div>";

            } else
                driverValues = ReceiptClass.formatReceiptWebToDriver(travel, _language);
            return driverValues;
        },
        sendTravelReceiptToUserJob: async (id, data) => {
            try {
                let {objectId, admin} = data;
                let _travel, fees, passenger, driver, paymentDataHtml = "";
                let travel = await utils.getObjectById(objectId, Define.Travel, ["user", "driver", "driver.plan", "fare", "discountObj", "origin", "destination", "card"]);
                if (travel) {
                    passenger = travel.get("user");
                    driver = travel.get("driver");
                    if (travel.get("status") !== "completed") {
                        return Promise.reject({code: 400, message: "Esta viagem não possui recibo."});
                    }
                    let price = travel.get("value");
                    let payment = _super.getPaymentMethodOfTravel(travel);
                    let month = travel.get("endDate").getMonth() + 1;
                    let fee = parseFloat((travel.get("fee") || 0).toFixed(2));
                    let endDate = utils.setTimezone(travel.get("endDate"), conf.timezoneDefault || -180);
                    let timePeriod = endDate.getHours() >= 0 && endDate.getHours() < 12 ? "am" : "pm";
                    let planFee = parseFloat((travel.get("planFee") || 0).toFixed(2));
                    fees = {
                        fee: parseFloat(fee.toFixed(2)),
                        planFee: planFee,
                        valueWithFee: parseFloat(price.toFixed(2)),
                        valueWithoutFee: parseFloat((price - fee - planFee).toFixed(2))
                    };
                    let sum = parseFloat((fees.fee + fees.planFee).toFixed(2));
                    let originJson = travel.get("originJson");
                    let destinationJson = travel.get("destinationJson");
                    let data = {
                        date: endDate.getDate() + "." + month + "." + endDate.getFullYear(),
                        time: endDate.getHours() + ":" + endDate.getMinutes() + " " + timePeriod,
                        payment: payment,
                        streetOrigin: originJson ? originJson.address || "-" : "-",
                        numberOrigin: originJson ? originJson.number || "-" : "-",
                        neighborhoodOrigin: originJson ? originJson.neighborhood || "-" : "-",
                        cityOrigin: originJson ? originJson.city || "-" : "-",
                        streetDestination: destinationJson ? destinationJson.address || "-" : "-",
                        numberDestination: destinationJson ? destinationJson.number || "-" : "-",
                        neighborhoodDestination: destinationJson ? destinationJson.neighborhood || "-" : "-",
                        cityDestination: destinationJson ? destinationJson.city || "-" : "-",
                        valueWithoutFee: fees.valueWithoutFee.toFixed(2),
                        values: "",
                        paymentData: paymentDataHtml,
                        valueWithFee: fees.valueWithFee,
                        objectId: travel.id
                    };
                    //Enviando para o passageiro
                    data.values = _super.getValueByTypePassenger(travel);
                    await Mail.sendTemplateReceiptEmail(passenger.get("username"), Define.emailHtmls.receipt.html, data, _super.formatSubject(objectId));
                    //Enviando para motorista
                    //data.values = _super.getValueByTypeDriver( travel);
                    //await Mail.sendTemplateReceiptEmail(driver.get("username"), Define.emailHtmls.receipt.html, data, _super.formatSubject(objectId));
                }

            } catch (e) {
                console.log(e);
            }
        },
        compareDatesOfScheduled: function (oldDate, newDate, oldTime, newTime) {
            oldTime = oldTime || 0;
            newTime = newTime || 0;
            oldTime = oldTime + ((oldTime * 15) / 100);
            newTime = newTime + ((newTime * 15) / 100);
            let oldDateCopy = new Date(oldDate);
            let newDateCopy = new Date(newDate);
            let oldBegin = new Date(oldDateCopy);
            let oldEnd = new Date(oldDateCopy.setMinutes(oldDateCopy.getMinutes() + oldTime));
            let newBegin = new Date(newDateCopy);
            let newEnd = new Date(newDateCopy.setMinutes(newDateCopy.getMinutes() + newTime));

            if ((newBegin >= oldBegin && newBegin <= oldEnd) || (newEnd >= oldBegin && newEnd <= oldEnd))
                return true;
            else
                return false;
        },
        verifyAvailableScheduleTravel: function (user, newAppointmentDate, newTime) {
            let error = false;
            let appointmentDateString = newAppointmentDate.getDate() + "-" + (newAppointmentDate.getMonth() + 1) + "-" + newAppointmentDate.getFullYear();
            let query = new Parse.Query(Define.Travel);
            query.equalTo("user", user);
            query.equalTo("isScheduled", true);
            query.equalTo("status", "newScheduled");
            query.doesNotExist("deletedDate");
            query.equalTo("appointmentDateString", appointmentDateString);
            query.descending("appointmentDate");
            query.select(["appointmentDate", "time"]);
            return query.find().then(function (travels) {
                if (travels.length === 0) return Promise.resolve();
                for (let i = 0; i < travels.length; i++) {
                    if (_super.compareDatesOfScheduled(travels[i].get("appointmentDate"), newAppointmentDate, travels[i].get("time"), newTime)) {
                        error = true;
                        break;
                    }
                }
                if (error)
                    return Promise.reject(Messages(_language).error.ERROR_AVAILABLE_SCHEDULE_TRAVEL);
                else
                    return Promise.resolve();
            });
        },
        requestScheduledTravel: async function (travel) {
            FirebaseClass.instance().saveTravelStatus(travel.id, "new", null, await _super.formatTravelToFirebase(travel, true));
            FirebaseClass.instance().saveTravelInUser(travel.get("user").id, travel.id);
            RedisJobInstance.addJob("Travel", "createTravelWithRedis", {objectId: travel.id});
            return PushNotificationClass.instance().sendPushToInformScheduledTravelInit(travel.get("user").id, travel.id, travel.get("user").get("language"));
        },
        callScheduledTravel: function () {
            let promises = [];
            let _travels;
            return ConfigInstance.getConfig("callBeforeScheduled", 10).then(function (minutes) {
                let date = new Date();
                date.setMinutes(date.getMinutes() + minutes);
                const query = new Parse.Query(Define.Travel);
                query.containedIn("status", ["newScheduled"]);
                query.equalTo("isScheduled", true);
                query.lessThanOrEqualTo("appointmentDate", date);
                query.limit(100);
                query.include(["nextDriversToCall", "category", "fare", "fare.category", "user", "card"]);
                query.select(["user", "destination", "origin", "card", "distance", "fare", "location", "originalValue", "time", "value"]);
                return query.find();
            }).then(function (travels) {
                _travels = travels;
                for (let i = 0; i < travels.length; i++) {
                    travels[i].set("status", "new");
                    promises.push(travels[i].save(null, {useMasterKey: true}));
                }
                return Promise.all(promises);
            }).then(function (travels) {
                _travels = travels;
                for (let i = 0; i < _travels.length; i++) {
                    promises.push(_super.requestScheduledTravel(travels[i]));
                }
                return Promise.all(promises);
            });
        },
        formatFareForTravel: (fare) => {
            const {value, valueKm, valueTime, minValue, active} = fare;
            return {value, valueKm, valueTime, minValue, active};
        },
        calculateStoppedTimeDriver: (waitingDate, startDate, fare) => {
            try {
                if (!fare || !waitingDate || !startDate)
                    return {timeStopped: 0, valueStopped: 0, change: false};
                const diffTime = utils.diffTimeinMinutes(waitingDate, startDate);
                const maxStoppedTime = fare.get("maxStoppedTime") || 0;
                const valueStoppedTime = fare.get("valueStoppedTime") || 0;
                if (diffTime > maxStoppedTime)
                    return {timeStopped: diffTime, valueStopped: valueStoppedTime, change: true};
                return {timeStopped: diffTime, valueStopped: 0, change: false};
            } catch (e) {
                console.log(e);
                return {timeStopped: 0, valueStopped: 0, change: false};
            }
        },
        compareEqualLocations: (obj1, obj2) => {
            if (obj1.latitude !== obj2.latitude)
                return false;
            if (obj1.longitude !== obj2.longitude)
                return false;
            return true;
        },
        callSaveLocationsInTravel: () => {
            let promises = [];
            let queryDriver = new Parse.Query(Parse.User);
            queryDriver.equalTo("isDriverApp", true);
            queryDriver.equalTo("isDriver", true);
            queryDriver.equalTo("inTravel", true);
            queryDriver.limit(1000);
            let queryTravels = new Parse.Query(Define.Travel);
            queryTravels.matchesQuery("driver", queryDriver);
            queryTravels.equalTo("status", "onTheDestination");
            queryTravels.include(["driver"]);
            queryTravels.select(["driver.location", "listLocationInTravel", "sumDistance"]);
            return queryTravels.find().then(function (travels) {
                for (let i = 0; i < travels.length; i++) {
                    promises.push(_super.saveLocationsInTravel(travels[i]));
                }
                return Promise.all(promises)
            });
        },
        saveLocationsInTravel: (travel) => {
            const newLocation = travel.get("driver").get("location") || undefined;
            const oldLocationsInTravel = travel.get("listLocationInTravel") || false;
            if (oldLocationsInTravel && newLocation) {
                let diff = oldLocationsInTravel[oldLocationsInTravel.length - 1].kilometersTo(newLocation);
                let minDistance = conf.minDistanceSaveLocations || 0.005;
                if (diff >= minDistance) {
                    let sumDistance = travel.get("sumDistance") || 0;
                    let newLocationsInTravel = [...(oldLocationsInTravel ? oldLocationsInTravel : [])];
                    newLocationsInTravel.push(newLocation);
                    travel.set("listLocationInTravel", newLocationsInTravel);
                    travel.set("sumDistance", sumDistance + diff);
                    return travel.save(null, {useMasterKey: true});
                }
            }
            return Promise.resolve();
        },
        cleanFirebaseWhenCompleteTravel: async (travel) => {
            try {
                if (!travel) throw "Travel not found";
                FirebaseClass.instance().saveTravelStatus(travel.id, "completed", null, await _super.formatTravelToFirebase(travel));
                FirebaseClass.instance().removeTravelOfUser(travel.get("user").id);
                FirebaseClass.instance().removeTravelOfUser(travel.get("driver").id);
                if (travel.get("userRate"))
                    FirebaseClass.instance().removeTravelCopyOfUser(travel.get("user").id);
                if (travel.get("driverRate"))
                    FirebaseClass.instance().removeTravelCopyOfUser(travel.get("driver").id);
            } catch (e) {
                console.error(e);

            }
        },
        travelInDismissArray: async (driver, idTravel) => {
            try {
                if (idTravel && driver) {
                    let dismissArray = driver.get("dismissArray") || [];
                    if (driver.get("receivedTravelId") === idTravel) {
                        driver.set("receivedTravelId", null);
                        driver.set("receivedTravel", null);
                    }
                    if (!dismissArray.includes(idTravel)) {
                        dismissArray.push(idTravel);
                        driver.set("dismissArray", dismissArray);
                    }
                    await driver.save(null, {useMasterKey: true});
                    FirebaseClass.instance().updateDriver(driver.id, null, null, dismissArray);
                }
                return Promise.resolve();
            } catch (error) {
                return Promise.reject({code: error.code, message: error.message});
            }
        },

        setReceivedTravel: async (driver, travelId, json) => {
            try {
                driver.set("receivedTravelId", travelId);
                driver.set("receivedTravel", json);
                await driver.save(null, {useMasterKey: true});
                // await FirebaseClass.instance().updateDriver(driver.id, travelId, json, null);
                io.emit("update", JSON.stringify({
                    type: Define.realTimeEvents.receivedTravel,
                    id: driver.id,
                    travelId: travelId
                }));
                return Promise.resolve();
            } catch (error) {
                return Promise.reject({code: error.code, message: error.message});
            }
        },
        formatOutputCompleteTravel: (travel, returnTravelDB) => {
            let value = (travel.get("valueDriver") || 0);
            return {
                valueDriver: parseFloat(value.toFixed(2)),
                travel: returnTravelDB === true ? _super.formatTravelToFirebaseWhenComplete(travel) : undefined
            };
        },
        cleanFirebaseForVerifyTravelStatus: async (travel, travelInfoUser, travelInfoDriver, user, driver, isCompleted = true) => {
            let promises = [];
            if (travelInfoUser.travelId && travelInfoUser.travelId === travel.id)
                FirebaseClass.instance().removeTravelOfUser(user.id);
            if (driver && travelInfoDriver && travelInfoDriver.travelId && travelInfoDriver.travelId === travel.id)
                FirebaseClass.instance().removeTravelOfUser(driver.id);
            let eqUserTravelIdCopy = travelInfoUser.travelIdCopy && travelInfoUser.travelIdCopy === travel.id;
            let eqDriverTravelIdCopy = travelInfoDriver && travelInfoDriver.travelIdCopy && travelInfoDriver.travelIdCopy === travel.id;
            // Caso a corrida esteja completa
            if (isCompleted) {
                if (user && travel.get("userRate") && eqUserTravelIdCopy)
                    FirebaseClass.instance().removeTravelCopyOfUser(user.id);
                if (driver && travel.get("driverRate") && eqDriverTravelIdCopy)
                    FirebaseClass.instance().removeTravelCopyOfUser(driver.id);
            } else {
                if (user && travel.get("cancelBy") === "passenger" && eqUserTravelIdCopy)
                    FirebaseClass.instance().removeTravelCopyOfUser(user.id);
                else if (driver && travel.get("cancelBy") === "driver" && eqDriverTravelIdCopy)
                    FirebaseClass.instance().removeTravelCopyOfUser(driver.id);
                else {
                    if (user && eqUserTravelIdCopy)
                        FirebaseClass.instance().removeTravelCopyOfUser(user.id);
                    if (driver && eqDriverTravelIdCopy)
                        FirebaseClass.instance().removeTravelCopyOfUser(driver.id);
                }
            }
            // Limpando current_travel no BD
            if (user && user.get("current_travel") && user.get("current_travel").id === travel.id) {
                user.unset('current_travel');
                user.set("inTravel", false);
                promises.push(user.save(null, {useMasterKey: true}));
            }
            if (driver && driver.get("current_travel") && driver.get("current_travel").id === travel.id) {
                driver.unset('current_travel');
                driver.set("inTravel", false);
                promises.push(driver.save(null, {useMasterKey: true}));
            }
            await Promise.all(promises);
        },
        checkStatusOfTravel: async (travel, _user) => {
            try {
                if (!travel) return;
                const status = travel.get("status") || null;
                if (status === "new" && _user.get("isPassenger") && !_user.get("isDriverApp")) {
                    const {weekdays = 0, days = 0, hours = 0, minutes = 0} = utils.getDuration(new Date(travel.createdAt), new Date());
                    if (weekdays > 0 || days > 0 || hours > 0 || minutes >= 30) {
                        if (_user.has("current_travel") && _user.get("current_travel").id === travel.id) {
                            _user.unset('current_travel');
                            _user.set('inTravel', false);
                            await _user.save(null, {useMasterKey: true});
                            await FirebaseClass.instance().removeTravelCopyOfUser(_user.id);
                            await FirebaseClass.instance().removeTravelOfUser(_user.id);
                        }
                        travel.set("status", "cancelled");
                        travel.set("cancelDate", new Date());
                        travel.set("cancelBy", "noDrivers");
                        await travel.save(null, {useMasterKey: true});
                    }
                }
            } catch (e) {
                console.log("Error at checkStatusOfTravel: ", e);
            }
        },
        verifyStatusOfTravelJob: async (id, data, user) => {
            _currentUser = _currentUser ? _currentUser : user;
            try {
                const {travelId, stopTime} = data;
                const selectFields = ["status", "user", "driver", "userRate", "driverRate", "cancelBy"];
                const objectId = id || travelId;
                let travel = null;
                if (objectId)
                    travel = await utils.findObject("Travel", {objectId}, true, ["user", "driver"], null, null, null, null, null, null, null, null, selectFields);
                else if (_currentUser && _currentUser.has("inTravel") && _currentUser.get("current_travel"))
                    travel = await utils.findObject("Travel", {objectId: _currentUser.get("current_travel").id || ""}, true, ["user", "driver"], null, null, null, null, null, null, null, null, selectFields);
                else if (!_currentUser.get('isDriverApp'))
                    travel = await utils.findObject("Travel", {user: _currentUser}, true, ["user", "driver"], null, null, {status: ['waiting', 'onTheWay', 'onTheDestination']}, null, null, null, null, null, selectFields);

                if (travel && !conf.realTime && !conf.realTime.realTimeUrl) {
                    const passenger = travel.get("user") || undefined;
                    const driver = travel.get("driver") || undefined;
                    if (passenger && driver && _currentUser && _currentUser.id !== passenger.id && _currentUser.id !== driver.id)
                        throw(Messages().error.USER_DOES_NOT_BELONG_TRAVEL);
                    await _super.checkStatusOfTravel(travel, _currentUser);
                    const statusDB = travel.get("status") || undefined;
                    const statusFirebase = await FirebaseClass.instance().getStatusOfTravel(objectId);
                    if (statusDB && statusFirebase && statusDB !== statusFirebase) {
                        const travelInfoUser = await FirebaseClass.instance().getUserTravelInfo(passenger);
                        const travelInfoDriver = await FirebaseClass.instance().getUserTravelInfo(driver);
                        await FirebaseClass.instance().saveTravelStatus(travel.id, statusDB, null, statusDB === "cancelled" ? {cancelBy: travel.get("cancelBy")} : null);
                        if (["completed", "cancelled", "deleted"].includes(statusDB)) {
                            const isCompleted = statusDB === "completed";
                            await _super.cleanFirebaseForVerifyTravelStatus(travel, travelInfoUser, travelInfoDriver, passenger, driver, isCompleted);
                        } else
                            await FirebaseClass.instance().saveTravelStatus(travel.id, statusDB, null, null);
                    }
                }

                if (stopTime) {
                    return Promise.resolve({
                        status: "OK",
                        travel: travel,
                        stopTime: (conf.stops && conf.stops.maxStopedTime ? conf.stops.maxStopedTime : 0)
                    });
                } else return Promise.resolve("OK");
            } catch (error) {
                console.log(error)
            }
        },
        savingSecondInvoice: (data, travel) => {
            const module = conf.payment && conf.payment.module ? conf.payment.module.toLowerCase() : "";
            const oldPaymentId = travel.get("paymentId") || "";
            let secondPaymentId, secondPaymentUrls;
            switch (module) {
                case "iugu":
                    const {invoice_id, pdf, url} = data;
                    if (oldPaymentId !== invoice_id) {
                        secondPaymentId = invoice_id;
                        secondPaymentUrls = {pdf, url};
                    }
                    break;
                case "pagarme":
                    const {id, boleto_url} = data;
                    if (oldPaymentId !== id.toString()) {
                        secondPaymentId = id;
                        secondPaymentUrls = {url: boleto_url};
                    }
                    break;
                default:
                    return;
            }
            if (secondPaymentId)
                travel.set("secondPaymentId", secondPaymentId);
            if (secondPaymentUrls)
                travel.set("secondPaymentUrls", secondPaymentUrls);
        },
        getLiveApiTokenDriverIugu: async (id) => {
            try {
                let query = new Parse.Query(Define.PaymentModule);
                query.equalTo("userID", id);
                query.equalTo("isDriver", true);
                query.select(["auth_data"]);
                let user = await query.first({useMasterKey: true});
                if (user) {
                    return user.get("auth_data") ? user.get("auth_data").live_api_token : "";
                }
            } catch (e) {
                console.log(e);
            }
        },
        createCancellationActivity: (travel, user) => {
            try {
                const cancelBy = travel.get("cancelBy") || null;
                if (cancelBy && ["driver", "passenger"].includes(cancelBy)) {
                    const cancelledByUser = cancelBy === "driver" ? Define.activities.travelCancelByDriver : Define.activities.travelCancelByPassenger;
                    return Activity.createActivity(cancelledByUser, {
                        id: user.id,
                        name: user.get("name"),
                        photo: user.get("profileImage"),
                        travelId: travel.id
                    }, Define.activityMessage.travelCancel);
                } else
                    return Promise.resolve();
            } catch (e) {
                return Promise.resolve();
            }
        },
        publicMethods: {
            verifyStatusOfTravel: async () => {
                if (utils.verifyAccessAuth(_currentUser, ["driver", "passenger"], _response)) {
                    try {
                        const result = await _super.verifyStatusOfTravelJob(null, _params);
                        return _response.success(result);
                    } catch (error) {
                        _response.error(error.code, error.message);
                    }
                }
            },
            setReceivedTravel: async function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["travelId"], _response)) {
                        try {
                            await _super.setReceivedTravel(_currentUser, _params.travelId);
                            return _response.success("OK");
                        } catch (error) {
                            _response.error(error);
                        }
                    }
                }
            },

            travelInDismissArray: async function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["travelId"], _response)) {
                        try {
                            await _super.travelInDismissArray(_currentUser, _params.travelId);
                            return _response.success("OK");
                        } catch (error) {
                            _response.error(error);
                        }
                    }
                }
            },

            testEmails: function () {
                return _super.notifyPassengerForBadRate().then(function () {
                    return _super.notifyDriversForBadRate();
                }).then(function () {
                    return _response.success('ok');
                }, function (error) {
                    _response.error(error);
                });
            },
            testDistanceLocation: async function () {
                let sum = 0;
                let count = 0;
                let locations = _params.locations;

                for (let i = 0; i < locations.length; i++) {
                    if (locations[i + 1]) {
                        let info = await MapsInstance.getDistanceBetweenPoints(locations[i], locations[i + 1]);
                        sum += info.distance;
                        console.log("Interval: " + i + " Distance: " + sum);
                        count++;
                    }
                }

                return _response.success({value: sum, total: count})
            },
            deleteTravel: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["travelId", "offset"], _response)) {
                        let _travel, _oldInfo, _newTravel;
                        let {travelId, offset} = _params;
                        return utils.getObjectById(travelId, Define.Travel, ["driver", "user"]).then(function (travel) {
                            _travel = travel;
                            _oldInfo = travel.toJSON();
                            return _super.cancelTravel(travel, _currentUser, offset, true);
                        }).then(function () {
                            _travel.set("deleted", true);
                            _travel.set("status", "deleted");
                            _travel.set("deletedDate", new Date(new Date().setMinutes(new Date().getMinutes() + offset)));
                            return _travel.save();
                        }).then(function (newTravel) {
                            _newTravel = newTravel;
                            if (conf.blockDriversInDebt && newTravel.get("driver")) {
                                const driver = newTravel.get("driver");
                                const inDebt = (driver.get("inDebt") || 0);
                                const blockedByDebt = driver.get("blockedByDebt") || false;
                                if (inDebt >= ((conf.payment && conf.payment.maxDebt) ? conf.payment.maxDebt : 10) && !blockedByDebt)
                                    return UserClass.instance().blockUserPromise(driver, undefined, Messages(null).reasons.BLOCK_USER_IN_DEBT.message, true);
                                else if (inDebt <= 0 && blockedByDebt)
                                    return UserClass.instance().unBlockUserPromise(driver, true);
                            }
                            return Promise.resolve();
                        }).then(function () {
                            RedisJobInstance.addJob("Logger", "logDeleteTravel", {
                                objectId: travelId,
                                admin: _currentUser.id,
                                oldInfo: _oldInfo,
                                newInfo: _newTravel.toJSON()
                            });
                            if ((conf.appName.toLowerCase() === "yesgo")) {
                                RedisJobInstance.addJob("Bonus", "chargebackBonusJob", {
                                    objectId: travelId
                                });
                            }
                            return _response.success(Messages(_language).success.DELETED_SUCCESS);
                        }, function (error) {
                            _response.error(error);
                        });
                    }
                }
            },
            deleteScheduledTravel: function () {
                if (utils.verifyAccessAuth(_currentUser, ["passenger"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["travelId", "offset"], _response)) {
                        let _travel, _oldInfo;
                        let {travelId, offset} = _params;
                        return utils.getObjectById(travelId, Define.Travel, ["driver", "user"]).then(function (travel) {
                            if (!travel.get("isScheduled"))
                                return Promise.reject(Messages(_language).error.ERROR_NOT_SCHEDULE_TRAVEL);
                            if (!travel.get("user") || travel.get("user").id !== _currentUser.id)
                                return Promise.reject(Messages(_language).error.ERROR_ACCESS_REQUIRED);
                            _travel = travel;
                            _oldInfo = travel.toJSON();
                            _travel.set("cancelBy", "passenger");
                            _travel.set("deleted", true);
                            _travel.set("status", "deleted");
                            _travel.set("deletedDate", new Date(new Date().setMinutes(new Date().getMinutes() + offset)));
                            return _travel.save();
                        }).then(function (newTravel) {
                            return _response.success(Messages(_language).success.DELETED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            cancelTravelByAdmin: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["travelId", "offset"], _response)) {
                        let _travel;
                        let {travelId, offset} = _params;
                        return utils.getObjectById(travelId, Define.Travel, ["driver", "user"]).then(function (travel) {
                            _travel = travel;
                            return _super.cancelTravel(travel, _currentUser, offset, true);
                        }).then(function (resultsPromises) {
                            RedisJobInstance.addJob("Logger", "logCancelTravelByAdmin", {
                                objectId: travelId,
                                admin: _currentUser.id
                            });
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error);
                        });
                    }
                }
            },
            empty: function () {

                if (utils.verifyAccessAuth(_currentUser, ["driver", "passenger"], _response)) {
                    let _origin, _destination, _travel, _coupon, _card, _fare;
                    if (_params.origin.zip)
                        _params.origin.zip = _params.origin.zip.replace(/\D/g, '');
                    if (_params.destination.zip)
                        _params.destination.zip = _params.destination.zip.replace(/\D/g, '');
                    let addressPromises = [];
                    let offset = _params.offset || -180;
                    let discount = 0, _discountObj = null, obj, _pushQuery, _maxDistance;
                    addressPromises.push(Address.createAddress("origin", _params.originId, _currentUser, _params.origin.address, _params.origin.latitude, _params.origin.longitude, _params.origin.number, _params.origin.complement, _params.origin.neighborhood, _params.origin.city, _params.origin.state, _params.origin.zip, false, _params.origin.placeId));
                    addressPromises.push(Address.createAddress("destination", _params.destinationId, _currentUser, _params.destination.address, _params.destination.latitude, _params.destination.longitude, _params.destination.number, _params.destination.complement, _params.destination.neighborhood, _params.destination.city, _params.destination.state, _params.destination.zip, false, _params.destination.placeId));
                    addressPromises.push((_super.verifyIsFakeCard(_params.cardId) ? utils.getObjectById(_params.cardId, Define.Card) : Promise.resolve()));
                    return Promise.all(addressPromises).then(function (addresses) {

                        return _response.success({objectId: ""});
                    });
                }
            },
            requestTravelFlow: async function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver", "passenger"], _response)) {
                    let _travelPoinsts;
                    userInTravel = await getAsync('userInTravel') || userInTravel;
                    userInTravel = JSON.parse(userInTravel);
                    return _super.travelStatus(_currentUser).then(function (travel) {
                        if (_currentUser.get("blocked")) {
                            return _response.error(Messages(_language).error.ERROR_USER_BLOCKED.code, Messages(_language).error.ERROR_USER_BLOCKED.message);
                        }
                        if (conf.IdWall && _currentUser.get("idWallStatus") !== "VALID") {
                            return _response.error(Messages(_language).error.ERROR_GENDER_PERMISSION.code, Messages(_language).error.ERROR_GENDER_PERMISSION.message);
                        }


                        if (travel) {
                            if (['completed', 'cancelled'].indexOf(travel.get('status')) < 0) {
                                FirebaseClass.instance().saveTravelInUser(_currentUser.id, travel.id);
                                return _response.success({objectId: travel.id});
                                return;
                            } else {
                                FirebaseClass.instance().removeTravelCopyOfUser(_currentUser.id, null, true)
                            }
                        }
                        if (userInTravel[_currentUser.id]) {
                            return setTimeout(function () {
                                if (userInTravel[_currentUser.id] === true) {
                                    userInTravel[_currentUser.id] = 1;
                                }
                                userInTravel[_currentUser.id]++;
                                if (userInTravel[_currentUser.id] == 5) {
                                    delete userInTravel[_currentUser.id];
                                }
                                client.set('userInTravel', JSON.stringify(userInTravel));
                                _super.publicMethods.requestTravelFlow();
                            }, 2000);
                        }

                        userInTravel[_currentUser.id] = true;
                        client.set('userInTravel', JSON.stringify(userInTravel));
                        return DeviceInfoClass.instance().verifyIfOldVersion(_currentUser, _params.originalValue, _params.coupon, _params.value).then(async function (res) {
                            if (!res.valid)
                                return _response.error(Messages(_language).error.ERROR_OLD_VERSION.code, Messages(_language).error.ERROR_OLD_VERSION.message);
                            if (res.value && !_params.originalValue) {
                                _params.originalValue = res.value;
                            }
                            if ((_params.value === undefined || _params.value === null) || (_params.value <= 0 && !_params.coupon && !conf.payment.hidePayment)) {
                                return _response.error(Messages(_language).error.ERROR_VALUE_NOT_VALID.code, Messages(_language).error.ERROR_VALUE_NOT_VALID.message);
                            }
                            let _origin, _destination, _travel, _coupon, _card, _fare;
                            let requiredFields = ["value", "fareId", "distance", "time"];
                            if (_params.origin && typeof _params.origin == "string") {
                                _params.origin = JSON.parse(_params.origin);
                            }
                            if (_params.destination && typeof _params.destination == "string") {
                                _params.destination = JSON.parse(_params.destination);
                            }
                            _params.origin = _params.origin || {};
                            _params.destination = _params.destination || {};
                            let addressPromises = [];
                            let discount = 0, _discountObj = null, obj, _pushQuery, _maxDistance;
                            _params.value = parseFloat(_params.value.toFixed(2));
                            if (_params.originalValue)
                                _params.originalValue = parseFloat(_params.originalValue.toFixed(2));
                            let offset = _params.offset || -180;
                            let jsonTravel = {};
                            if (utils.verifyRequiredFields(_params, requiredFields, _response)) {
                                if (_params.origin && _params.origin.zip)
                                    _params.origin.zip = _params.origin.zip.replace(/\D/g, '');
                                if (_params.destination && _params.destination.zip)
                                    _params.destination.zip = _params.destination.zip.replace(/\D/g, '');
                                if (_params.origin && _params.origin.city && _params.origin.state) {
                                    _currentUser.set("passenger_last_city", _params.origin.city);
                                    _currentUser.set("passenger_last_state", _params.origin.state)
                                }
                                if (_params.points) {
                                    let addPromises = [];
                                    for (let i = 0; i < _params.points.length; i++) {
                                        let type;
                                        if (i === 0) {
                                            type = 'origin'
                                        } else if (i === _params.points.length - 1) {
                                            type = 'destination'
                                        } else {
                                            type = 'point'
                                        }
                                        addPromises.push(Address.createAddress(type, _params.points[i].address.id, _currentUser, _params.points[i].address.address, _params.points[i].address.location.latitude, _params.points[i].address.location.longitude, _params.points[i].address.number, _params.points[i].address.complement, _params.points[i].address.neighborhood, _params.points[i].address.city, _params.points[i].address.state, _params.points[i].address.zip, false, _params.points[i].address.placeId))
                                    }
                                    try {
                                        _travelPoinsts = await Promise.all(addPromises)
                                    } catch (e) {
                                        return _response.error(e)
                                    }
                                }
                                if (!_params.points) {
                                    addressPromises.push(Address.createAddress("origin", _params.originId, _currentUser, _params.origin.address, _params.origin.latitude, _params.origin.longitude, _params.origin.number, _params.origin.complement, _params.origin.neighborhood, _params.origin.city, _params.origin.state, _params.origin.zip, false, _params.origin.placeId));
                                    addressPromises.push(Address.createAddress("destination", _params.destinationId, _currentUser, _params.destination.address, _params.destination.latitude, _params.destination.longitude, _params.destination.number, _params.destination.complement, _params.destination.neighborhood, _params.destination.city, _params.destination.state, _params.destination.zip, false, _params.destination.placeId));
                                    _params.points = [];
                                    _params.points[0] = {
                                        address: _params.origin
                                    };
                                    _params.points[1] = {
                                        address: _params.destination
                                    };

                                } else {
                                    addressPromises.push(Address.createAddress("origin", _params.points[0].address.id, _currentUser, _params.points[0].address.address, _params.points[0].address.location.latitude, _params.points[0].address.location.longitude, _params.points[0].address.number, _params.points[0].address.complement, _params.points[0].address.neighborhood, _params.points[0].address.city, _params.points[0].address.state, _params.points[0].address.zip, false, _params.points[0].address.placeId));
                                    addressPromises.push(Address.createAddress("destination", _params.points[_params.points.length - 1].address.id, _currentUser, _params.points[_params.points.length - 1].address.address, _params.points[_params.points.length - 1].address.location.latitude, _params.points[_params.points.length - 1].address.location.longitude, _params.points[_params.points.length - 1].address.number, _params.points[_params.points.length - 1].address.complement, _params.points[_params.points.length - 1].address.neighborhood, _params.points[_params.points.length - 1].address.city, _params.points[_params.points.length - 1].address.state, _params.points[_params.points.length - 1].address.zip, false, _params.points[_params.points.length - 1].address.placeId))
                                }
                                addressPromises.push((_super.verifyIsFakeCard(_params.cardId) ? utils.getObjectById(_params.cardId, Define.Card) : Promise.resolve()));
                                addressPromises.push(FareInstance.getFareById(_params.fareId));
                                addressPromises.push(UserDiscountInstance.markUserDiscount(_currentUser, _params.coupon, true));
                                return Promise.all(addressPromises).then(function (addresses) {

                                    if (addresses[0].type === "origin") {
                                        _origin = addresses[0];
                                        _destination = addresses[1];
                                    } else {
                                        _origin = addresses[1];
                                        _destination = addresses[0];
                                    }
                                    _card = addresses[2];
                                    let paidWithBonus = false;
                                    if (!_card && conf.bonusLevel && conf.bonusLevel.verifyValueOfBonusToUseInTravel) {
                                        if (((_currentUser.get("travelBonusTotal") || 0) < _params.value)) {
                                            return Promise.reject(Messages(_language).error.ERROR_NO_BONUS_TO_USE);
                                        } else {
                                            paidWithBonus = true;
                                        }
                                    }
                                    if (conf.appName === "YesGo" && _params.cardId === 'bonus') {
                                        paidWithBonus = true;
                                    }
                                    _fare = addresses[3];
                                    let pagarmeTransaction = null;
                                    let passengerLocation = null;
                                    if (_params.location && _params.location.latitude && _params.location.longitude) {
                                        passengerLocation = {
                                            latitude: _params.location.latitude,
                                            longitude: _params.location.longitude
                                        };
                                    }
                                    return _super.createTravel(_origin, _destination, _currentUser, "new", _params.value, _params.cardId ? _card : null, _params.originInfo, _params.destinationInfo, discount, _fare, _discountObj, null, _params.distance, _params.time, pagarmeTransaction ? pagarmeTransaction.id : null, _currentUser.get("womenOnly"), passengerLocation, _params.coupon, offset, paidWithBonus, _params.originalValue, false, _params.points);
                                }).then(async function (travel) {
                                    _travel = travel;
                                    travel.set("user", _currentUser);
                                    travel.set("fare", _fare);
                                    _currentUser.set('current_travel', _travel)
                                    await _currentUser.save(null, {useMasterKey: true})
                                    await FirebaseClass.instance().saveTravelStatus(_travel.id, "new", null, await _super.formatTravelToFirebase(travel, true));

                                    FirebaseClass.instance().saveTravelInUser(_currentUser.id, _travel.id);
                                    RedisJobInstance.addJob("Travel", "createTravelWithRedis", {objectId: _travel.id});
                                    return _response.success({objectId: _travel.id});
                                }, function (error) {
                                    console.log("errror", error);
                                    error = utils.formatErrorsList(error);
                                    delete userInTravel[_currentUser.id];
                                    client.set('userInTravel', JSON.stringify(userInTravel));
                                    _response.error(error.code || 400, error.message || "");
                                });
                            } else {
                                _response.error(error.code || 400, error.message || "");
                            }
                        });
                    });
                }
            },
            editTravelPoints: async () => {
                if (utils.verifyAccessAuth(_currentUser, ["passenger"], _response) && utils.verifyRequiredFields(_params, ['travelId', 'points'], _response)) {
                    try {
                        let travel = await utils.getObjectById(_params.travelId, Define.Travel, false, false, {status: ["new", "waiting", "onTheWay", "onTheDestination"]}, ['user', 'points']);
                        if (_currentUser.id !== travel.get('user').id) {
                            return _response.error(Messages(_language).error.ERROR_UNAUTHORIZED)
                        }
                        travel.set('points', _params.points);
                        await travel.save(null, {useMasterKey: true});
                        return _response.success(Messages(_language).success.EDITED_SUCCESS)
                    } catch (e) {
                        return _response.error(e)
                    }
                }
            },
            scheduleTravel: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["driver", "passenger"], _response)) {
                        if (_currentUser.get("blocked")) {
                            return _response.error(Messages(_language).error.ERROR_USER_BLOCKED.code, Messages(_language).error.ERROR_USER_BLOCKED.message);
                        }
                        if (conf.IdWall && _currentUser.get("idWallStatus") !== "VALID") {
                            return _response.error(Messages(_language).error.ERROR_GENDER_PERMISSION.code, Messages(_language).error.ERROR_GENDER_PERMISSION.message);
                        }
                        let _origin, _destination, travel, _card, _fare, addresses;
                        let discount = 0, _discountObj = null;
                        let offset = -(_params.offset);
                        let appointmentDate = new Date(_params.appointmentDate);
                        appointmentDate = utils.setTimezone(appointmentDate, offset);
                        if (appointmentDate <= new Date())
                            return _response.error(Messages(_language).error.ERROR_DATE_SCHEDULE_TRAVEL.code, Messages(_language).error.ERROR_DATE_SCHEDULE_TRAVEL.message);
                        appointmentDate = new Date(appointmentDate.setSeconds(0));
                        await _super.verifyAvailableScheduleTravel(_currentUser, appointmentDate, _params.time);
                        const res = await DeviceInfoClass.instance().verifyIfOldVersion(_currentUser, _params.originalValue, _params.coupon, _params.value);
                        if (!res.valid)
                            return _response.error(Messages(_language).error.ERROR_OLD_VERSION.code, Messages(_language).error.ERROR_OLD_VERSION.message);
                        if (res.value && !_params.originalValue) {
                            _params.originalValue = res.value;
                        }
                        let requiredFields = ["value", "distance", "time", "appointmentDate", "offset"];
                        requiredFields.concat((!_params.originId && _params.originId !== "") ? ["origin"] : ["originId"]);
                        requiredFields.concat((!_params.destinationId && _params.destinationId !== "") ? ["destination"] : ["destinationId"]);
                        if (_params.origin && typeof _params.origin == "string") {
                            _params.origin = JSON.parse(_params.origin);
                        }
                        if (_params.destination && typeof _params.destination == "string") {
                            _params.destination = JSON.parse(_params.destination);
                        }
                        _params.origin = _params.origin || {};
                        _params.destination = _params.destination || {};
                        let addressPromises = [];
                        if (_params.value)
                            _params.value = parseFloat(_params.value.toFixed(2));
                        if (_params.originalValue)
                            _params.originalValue = parseFloat(_params.originalValue.toFixed(2));

                        if (utils.verifyRequiredFields(_params, requiredFields, _response)) {
                            if (_params.origin.zip)
                                _params.origin.zip = _params.origin.zip.replace(/\D/g, '');
                            if (_params.destination.zip)
                                _params.destination.zip = _params.destination.zip.replace(/\D/g, '');
                            if (!_params.points) {
                                addressPromises.push(Address.createAddress("origin", _params.originId, _currentUser, _params.origin.address, _params.origin.latitude, _params.origin.longitude, _params.origin.number, _params.origin.complement, _params.origin.neighborhood, _params.origin.city, _params.origin.state, _params.origin.zip, false, _params.origin.placeId));
                                addressPromises.push(Address.createAddress("destination", _params.destinationId, _currentUser, _params.destination.address, _params.destination.latitude, _params.destination.longitude, _params.destination.number, _params.destination.complement, _params.destination.neighborhood, _params.destination.city, _params.destination.state, _params.destination.zip, false, _params.destination.placeId));
                                _params.points = [];
                                _params.points[0] = {
                                    address: _params.origin
                                };
                                _params.points[1] = {
                                    address: _params.destination
                                };
                            } else {
                                addressPromises.push(Address.createAddress("origin", _params.points[0].address.id, _currentUser, _params.points[0].address.address, _params.points[0].address.location.latitude, _params.points[0].address.location.longitude, _params.points[0].address.number, _params.points[0].address.complement, _params.points[0].address.neighborhood, _params.points[0].address.city, _params.points[0].address.state, _params.points[0].address.zip, false, _params.points[0].address.placeId));
                                addressPromises.push(Address.createAddress("destination", _params.points[_params.points.length - 1].address.id, _currentUser, _params.points[_params.points.length - 1].address.address, _params.points[_params.points.length - 1].address.location.latitude, _params.points[_params.points.length - 1].address.location.longitude, _params.points[_params.points.length - 1].address.number, _params.points[_params.points.length - 1].address.complement, _params.points[_params.points.length - 1].address.neighborhood, _params.points[_params.points.length - 1].address.city, _params.points[_params.points.length - 1].address.state, _params.points[_params.points.length - 1].address.zip, false, _params.points[_params.points.length - 1].address.placeId))
                            }
                            addressPromises.push((_params.cardId && _params.cardId !== Define.fakeCard.objectId ? utils.getObjectById(_params.cardId, Define.Card) : Promise.resolve()));
                            addressPromises.push(_params.fareId ? FareInstance.getFareById(_params.fareId) : Promise.resolve());
                            addressPromises.push(UserDiscountInstance.markUserDiscount(_currentUser, _params.coupon, true));
                            addresses = await Promise.all(addressPromises);
                        }
                        if (addresses[0].type === "origin") {
                            _origin = addresses[0];
                            _destination = addresses[1];
                        } else {
                            _origin = addresses[1];
                            _destination = addresses[0];
                        }
                        _card = addresses[2];
                        let paidWithBonus = false;
                        if (!_card && conf.bonusLevel && conf.bonusLevel.verifyValueOfBonusToUseInTravel) {
                            if (((_currentUser.get("travelBonusTotal") || 0) < _params.value)) {
                                return Promise.reject(Messages(_language).error.ERROR_NO_BONUS_TO_USE);
                            } else {
                                paidWithBonus = true;
                            }
                        }
                        _fare = addresses[3];
                        let pagarmeTransaction = null;
                        let passengerLocation = null;
                        if (_params.location && _params.location.latitude && _params.location.longitude) {
                            passengerLocation = {
                                latitude: _params.location.latitude,
                                longitude: _params.location.longitude
                            };
                        }
                        travel = await _super.createTravel(_origin, _destination, _currentUser, "newScheduled", _params.value, _params.cardId ? _card : null, _params.originInfo, _params.destinationInfo, discount, _fare, _discountObj, null, _params.distance, _params.time, pagarmeTransaction ? pagarmeTransaction.id : null, _currentUser.get("womenOnly"), passengerLocation, _params.coupon, _params.offset, paidWithBonus, _params.originalValue, appointmentDate, _params.points);
                        travel.set("user", _currentUser);
                        travel.set("fare", _fare);
                        return _response.success({objectId: travel.id});
                    }
                } catch (error) {
                    console.log("errror", error);
                    error = utils.formatErrorsList(error);
                    delete userInTravel[_currentUser.id];
                    _response.error(error.code || 400, error.message || "");
                }
            },
            requestTravel: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver", "passenger"], _response)) {

                    return _super.travelStatus(_currentUser).then(function (travel) {
                        if (_currentUser.get("blocked")) {
                            return Promise.reject(Messages(_language).error.ERROR_USER_BLOCKED);
                        }
                        if (travel) {
                            // _response.error(Messages.error.ERROR_ALREADY_IN_TRAVEL.code, Messages.error.ERROR_ALREADY_IN_TRAVEL.message);
                            delete userInTravel[_currentUser.id];
                            return _response.success({objectId: travel.id});
                            return;
                        } else {
                            if (userInTravel[_currentUser.id]) {
                                if (userInTravel[_currentUser.id] === true) {
                                    userInTravel[_currentUser.id] = 1;
                                }
                                userInTravel[_currentUser.id]++;
                                if (userInTravel[_currentUser.id] == 3)
                                    delete userInTravel[_currentUser.id];
                                return setTimeout(function () {
                                    _super.publicMethods.requestTravel();
                                }, 2000);
                            }
                            userInTravel[_currentUser.id] = true;
                            let requiredFields = ["value", "fareId", "distance", "time"];
                            requiredFields.concat((!_params.originId && _params.originId != "") ? ["origin"] : ["originId"]);
                            requiredFields.concat((!_params.destinationId && _params.destinationId != "") ? ["destination"] : ["destinationId"]);
                            if (_params.origin && typeof _params.origin == "string") {
                                _params.origin = JSON.parse(_params.origin);
                            }
                            if (_params.destination && typeof _params.destination == "string") {
                                _params.destination = JSON.parse(_params.destination);
                            }
                            _params.origin = _params.origin || {};
                            _params.destination = _params.destination || {};
                        }
                        let discount = 0, _discountObj = null, obj, _pushQuery, _maxDistance;
                        let paidWithBonus = false;
                        _params.value = parseFloat(_params.value.toFixed(2));
                        let offset = _params.offset || -180;
                        if (utils.verifyRequiredFields(_params, requiredFields, _response)) {

                            let _origin, _destination, _travel, _coupon, _card, _fare;
                            if (_params.origin.zip)
                                _params.origin.zip = _params.origin.zip.replace(/\D/g, '');
                            if (_params.destination.zip)
                                _params.destination.zip = _params.destination.zip.replace(/\D/g, '');
                            let addressPromises = [];
                            addressPromises.push(Address.createAddress("origin", _params.originId, _currentUser, _params.origin.address, _params.origin.latitude, _params.origin.longitude, _params.origin.number, _params.origin.complement, _params.origin.neighborhood, _params.origin.city, _params.origin.state, _params.origin.zip, false, _params.origin.placeId));
                            addressPromises.push(Address.createAddress("destination", _params.destinationId, _currentUser, _params.destination.address, _params.destination.latitude, _params.destination.longitude, _params.destination.number, _params.destination.complement, _params.destination.neighborhood, _params.destination.city, _params.destination.state, _params.destination.zip, false, _params.destination.placeId));
                            addressPromises.push((_super.verifyIsFakeCard(_params.cardId) ? utils.getObjectById(_params.cardId, Define.Card) : Promise.resolve()));
                            addressPromises.push(FareInstance.getFareById(_params.fareId));
                            addressPromises.push(RadiusClass.instance().findRadiusByLocation(_params.origin.state, _params.origin.city));
                            addressPromises.push(UserDiscountInstance.markUserDiscount(_currentUser, _params.coupon, true));
                            return Promise.all(addressPromises).then(function (addresses) {
                                if (addresses[0].type == "origin") {
                                    _origin = addresses[0];
                                    _destination = addresses[1];
                                } else {
                                    _origin = addresses[1];
                                    _destination = addresses[0];
                                }
                                _card = addresses[2];
                                _fare = addresses[3];
                                _maxDistance = addresses[4];
                                if (!_card && conf.bonusLevel && conf.bonusLevel.verifyValueOfBonusToUseInTravel) {
                                    if (((_currentUser.get("travelBonusTotal") || 0) < _params.value)) {
                                        return Promise.reject(Messages(_language).error.ERROR_NO_BONUS_TO_USE);
                                    } else {
                                        paidWithBonus = true;
                                    }
                                }
                                if (!_fare.get("active")) {
                                    return Promise.reject(Messages(_language).error.ERROR_INVALID_CATEGORY);
                                }
                                return PushNotificationClass.instance().queryToDriversNext(_fare.get("category"), _origin.location, _currentUser.get("womenOnly"), _currentUser.get("gender"), _maxDistance, offset, null, travel.get("points") ? true : false);
                            }).then(function (query) {
                                _pushQuery = query;
                                return _pushQuery.count({useMasterKey: true})
                            }).then(function (count) {
                                if (count === 0) {
                                    return Promise.reject(Messages(_language).error.ERROR_NO_DRIVERS);
                                }
                                if (_params.coupon) {
                                    return utils.findObject(Define.UserDiscount, {
                                        "code": _params.coupon,
                                        "user": _currentUser,
                                        "used": false
                                    }, true);
                                } else {
                                    return Promise.resolve();
                                }
                            }).then(function (userDiscount) {
                                if (userDiscount) {
                                    _discountObj = userDiscount;
                                    discount = userDiscount.get("discount").type === Define.typeOfValue.indicationCode ? userDiscount.get("discount").discount : userDiscount.get("discount").discount * _params.value;
                                    discount = parseFloat(discount.toFixed(2));
                                }
                                obj = {
                                    originLatitude: _origin.location.latitude,
                                    originLongitude: _origin.location.longitude,
                                    destinationLatitude: _destination.location.latitude,
                                    destinationLongitude: _destination.location.longitude
                                };
                                return _super.verifyIsFakeCard(_params.cardId) ? PaymentModule.createCardTransaction(
                                    {
                                        cardId: _card.get("paymentId"),
                                        userId: _currentUser.id,
                                        customerId: _currentUser.get("paymentId"),
                                        cpf: _currentUser.get("cpf"),
                                        phone: _currentUser.get("phone"),
                                        name: UserClass.instance().formatNameToPayment(_currentUser),
                                        email: _currentUser.get("email"),
                                        installments: 1,
                                        travel: true,
                                        destination: Address.formatAddressToPayment(_destination),
                                        value: _params.value,
                                    })
                                    : Promise.resolve(null);
                            }).then(function (pagarmeTransaction) {

                                let passengerLocation = null;
                                if (_params.location && _params.location.latitude && _params.location.longitude) {
                                    passengerLocation = {
                                        latitude: _params.location.latitude,
                                        longitude: _params.location.longitude
                                    };
                                }
                                return _super.createTravel(_origin, _destination, _currentUser, "waiting", _params.value, _params.cardId ? _card : null, _params.originInfo, _params.destinationInfo, discount, _fare, _discountObj, obj, _params.distance, _params.time, pagarmeTransaction ? pagarmeTransaction.id : null, _currentUser.get("womenOnly"), passengerLocation, _params.coupon, _params.offset, paidWithBonus, _params.originalValue);
                            }).then(async function (travel) {
                                _currentUser.set('current_travel', travel);
                                _travel = travel;
                                if (_params.location && _params.location.latitude && _params.location.longitude) {
                                    _travel.set("passengerLocation", {
                                        latitude: _params.location.latitude,
                                        longitude: _params.location.longitude
                                    });
                                }
                                let json = await _super.formatPushRequestTravel(_travel);
                                let finalPromises = [];
                                finalPromises.push(PushNotificationClass.instance().sendPushOfRequestTravelToDrivers(Messages(_language).push.requestTravel, _origin.location, json, _currentUser.id, _travel, _fare.get("category"), null, _currentUser.get("gender"), _pushQuery, _maxDistance, offset, _language));
                                finalPromises.push(Activity.createActivity(Define.activities.travelRequest, {
                                    id: _currentUser.id,
                                    name: _currentUser.get("name"),
                                    photo: _currentUser.get("profileImage")
                                }, Define.activityMessage.travelRequest));
                                if (_discountObj && _discountObj.has("owner")) {
                                    let objectId = _discountObj.get("owner").id;
                                    finalPromises.push(PushNotificationClass.instance().sendPush(objectId, Messages(_language).push.indication_code, {
                                        code: _params.coupon,
                                        friend: _currentUser.toJSON(),
                                        type: Define.pushTypes.userCode
                                    }, null));
                                } else {
                                    finalPromises.push(Promise.resolve());
                                }
                                return Promise.all(finalPromises);
                            }).then(async function () {
                                FirebaseClass.instance().saveTravelStatus(_travel.id, "waiting", null, await _super.formatTravelToFirebase(_travel, true));
                                FirebaseClass.instance().saveTravelInUser(_currentUser.id, _travel.id);
                                return _response.success({objectId: _travel.id});
                            }, function (error) {
                                delete userInTravel[_currentUser.id];
                                UserDiscountInstance.markUserDiscount(_currentUser, _params.coupon, false).then(function () {
                                    _response.error(error.code, error.message);
                                });
                            });
                        }
                    }, function (error) {
                        delete userInTravel[_currentUser.id];
                        UserDiscountInstance.markUserDiscount(_currentUser, _params.coupon, false).then(function () {
                            _response.error(error.code, error.message);
                        });
                    });

                }
            },
            acceptTravel: async function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["objectId", "offset"], _response)) {
                        if (!_params.objectId || _params.objectId === "null") return _response.error(Messages(_language).error.INVALID_TRAVEL_ID);
                        blockedTravels[_params.objectId] = true;
                        const offset = conf.timezoneDefault || _params.offset || -180;
                        let _driverIdCopy;
                        travelsWaiting = await getAsync('travelsWaiting') || travelsWaiting;
                        travelsWaiting = JSON.parse(travelsWaiting);
                        if (travelsWaiting[_params.objectId] || _currentUser.get('current_travel')) {
                            _response.error(Messages(_language).error.ERROR_DRIVER_ALREADY.code, Messages(_language).error.ERROR_DRIVER_ALREADY.message);
                            return;
                        }
                        travelsWaiting[_params.objectId] = true;
                        client.set('travelsWaiting', JSON.stringify(travelsWaiting));
                        let _travel, _vehicle;
                        return utils.getObjectById(_params.objectId, Define.Travel, ["user"], {"status": "waiting"}).then(function (travel) {
                            _travel = travel;
                            if (_travel.get("user") && _travel.get("user").id === _currentUser.id) {
                                return Promise.reject(Messages(_language).error.ERROR_SAME_USER);
                            }
                            let promises = [];
                            promises.push(FirebaseClass.instance().getDriverLocation(_currentUser.id, _currentUser));
                            promises.push(PlanClass.instance().getDefaultPlan(_currentUser.get("plan")));
                            promises.push(utils.findObject(Define.Vehicle, {
                                "primary": true,
                                "user": _currentUser
                            }, true, ["user", "category"]));
                            return Promise.all(promises);
                        }).then(function (promisesResult) {

                            _currentUser.set('current_travel', _travel);
                            _travel.set("locationWhenAccept", promisesResult[0]);
                            if (conf.usePlanRetention && promisesResult[1] && promisesResult[1].get("retention")) {
                                _travel.set("fee", promisesResult[1].get("retention") || 0);
                            }
                            _vehicle = promisesResult[2];
                            let promises = [];
                            _currentUser.set("inTravel", true);
                            promises.push(_currentUser.save(null, {useMasterKey: true}));
                            _travel.set("vehicle", _vehicle);
                            _travel.set("driver", _currentUser);
                            _travel.set("status", "onTheWay");
                            const data = {
                                travelId: _travel.id,
                                travelIdCopy: _travel.id
                            };
                            _super.travelInDismissArray(_currentUser, _travel.id, null, data);
                            _travel.set("acceptedDate", new Date());
                            promises.push(_travel.save(null, {useMasterKey: true}));
                            promises.push(PushNotificationClass.instance().sendTravelAcceptedPush(_travel.get("user").id, _travel.id, _currentUser.get("name"), _vehicle, _travel.get("user").get("language")));
                            let i = 0;
                            let pushToDriversCopy = _travel.get("driversReceivePush") || [];
                            let pushToDrivers = [...pushToDriversCopy];
                            for (; i < pushToDrivers.length; i++) {
                                if (pushToDrivers[i] === _currentUser.id) {
                                    break;
                                }
                            }
                            pushToDrivers.splice(i, 1);
                            promises.push(PushNotificationClass.instance().sendPushToDismissTravel(_travel.id, pushToDrivers, _travel.get("user").get("language")));
                            promises.push(Activity.travelAccept(_currentUser.id, _currentUser.get("name"), _currentUser.get("profileImage"), _travel.id));
                            return Promise.all(promises);
                        }).then(async function () {
                            FirebaseClass.instance().startTravel(_travel.id, _currentUser, _travel.get("user"));
                            FirebaseClass.instance().saveTravelInUser(_currentUser.id, _travel.id);
                            io.emit("update", JSON.stringify({
                                type: Define.realTimeEvents.travelStatusChange,
                                id: _travel.get('user').id,
                                status: "onTheWay",
                                isWaitingPassenger: _travel.get("isWaitingPassenger"),
                                currentStep: _travel.get('currentStep'),
                                driver: _currentUser.id
                            }));
                            await FirebaseClass.instance().saveTravelStatus(_travel.id, "onTheWay", null, await _super.formatTravelToFirebase(_travel, true));
                            delete travelsWaiting[_params.objectId];
                            if (_travel.get("user")) delete userInTravel[_travel.get("user").id];
                            client.set('userInTravel', JSON.stringify(userInTravel));
                            client.set('travelsWaiting', JSON.stringify(travelsWaiting));
                            delete blockedTravels[_travel.id];
                            _currentUser.set("countDriverRefusals", 0);
                            await _currentUser.save(null, {useMasterKey: true});
                            return _response.success(_travel.get('status'));
                        }, function (error) {
                            delete travelsWaiting[_params.objectId];
                            client.set('travelsWaiting', JSON.stringify(travelsWaiting));
                            let _error;
                            if (error.code === 101) {
                                _error = Messages(_language).error.ERROR_INVALID_TRAVEL;
                                RedisJobInstance.addJob("Travel", "verifyStatusOfTravelJob", {
                                    objectId: _travel.id
                                });
                            } else _error = error;
                            if (_travel && _travel.get("user")) {
                                delete userInTravel[_travel.get("user").id];
                                client.set('userInTravel', JSON.stringify(userInTravel))
                            }
                            _response.error(_error.code, _error.message);
                        });
                    }
                }
            },
            acceptTravelFlow: function () {
                return _super.publicMethods.acceptTravel();
            },
            informArrival: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["objectId", "offset"], _response)) {
                        let _travel;

                        let promises = [];
                        promises.push(utils.getObjectById(_params.objectId, Define.Travel, ["user"], {
                            "status": "onTheWay",
                            "driver": _currentUser
                        }));
                        promises.push(FirebaseClass.instance().getDriverLocation(_currentUser.id, _currentUser));
                        return Promise.all(promises).then(function (travel) {
                            let driverLocation = travel[1];
                            travel = travel[0];
                            _travel = travel;
                            _travel.set("isWaitingPassenger", true);
                            _travel.set("driverLocationWhenArrived", driverLocation);
                            _travel.set("waitingDate", new Date());
                            if (_travel.get('points')) {
                                _travel.get('points')[0].visitedAt = new Date().toISOString();
                                _travel.get('points')[0].visited = true
                            }
                            let promises = [];
                            promises.push(_travel.save(null, {useMasterKey: true}));
                            promises.push(PushNotificationClass.instance().sendPushToInformArrival(_travel.id, _travel.get("user").id, _currentUser.get("name"), _language));
                            promises.push(Activity.driverWaitingPassenger(_currentUser.id, _currentUser.get("name"), _currentUser.get("profileImage"), _travel.id));
                            return Promise.all(promises);
                        }).then(async function (promisesRes) {
                            try {
                                const formatedTravel = await _super.formatTravelToFirebase(promisesRes[0]);
                                const formatedTravelJson = await _super.formatTravelToFirebase(promisesRes[0], true, false, true);
                                await FirebaseClass.instance().saveTravelStatus(promisesRes[0].id, null, null, formatedTravel);
                                io.emit("update", JSON.stringify({
                                    type: Define.realTimeEvents.travelStatusChange,
                                    id: _travel.get('user').id,
                                    status: "onTheWay",
                                    isWaitingPassenger: _travel.get("isWaitingPassenger"),
                                    currentStep: _travel.get('currentStep'),
                                    visitedAt: (_travel.get('points') && _travel.get('points')[0]) ? _travel.get('points')[0].visitedAt : undefined
                                }));
                                return _params.returnTravel ? _response.success(formatedTravelJson) : _response.success(formatedTravel.status);

                            } catch (e) {
                                console.log(e)
                                e.code ? _response.error(e.code, e.message) : _response.error(e);
                            }
                        }, function (error) {
                            error = utils.formatErrorsList(error);
                            let _error;
                            if (error.code === 101) {
                                _error = Messages(_language).error.ERROR_INVALID_TRAVEL;
                                RedisJobInstance.addJob("Travel", "verifyStatusOfTravelJob", {
                                    objectId: _params.objectId
                                });
                            } else _error = error;
                            _response.error(_error.code, _error.message);
                        });
                    }
                }
            },
            informStop: async () => {
                if (utils.verifyAccessAuth(_currentUser, ["driver"], _response) && utils.verifyRequiredFields(_params, ["objectId", "offset", "point"], _response)) {
                    try {
                        let travel = await utils.getObjectById(_params.objectId, Define.Travel, false, false, false);
                        let points = travel.get('points');
                        if (!points || _params.point > points.length - 1) return _response.error(Messages(_language).error.INVALID_POINT);
                        points[_params.point].visited = true;
                        points[_params.point].visitedAt = new Date().toISOString();
                        travel.set('points', points);
                        await travel.save(null, {useMasterKey: true});
                        io.emit("update", JSON.stringify({
                            type: Define.realTimeEvents.travelStatusChange,
                            id: travel.get('user').id,
                            status: "onTheDestination",
                            currentStep: travel.get("currentStep"),
                            visitedAt: points[_params.point].visitedAt
                        }));
                        const _travel = await _super.formatTravelToFirebase(travel);
                        await FirebaseClass.instance().saveTravelStatus(travel.id, null, null, _travel);
                        return _response.success(_travel);
                    } catch (e) {
                        return _response.error(e)
                    }
                }
            },
            finishStop: async () => {
                if (utils.verifyAccessAuth(_currentUser, ["driver"], _response) && utils.verifyRequiredFields(_params, ["objectId", "offset", "point"], _response)) {
                    try {
                        let travel = await utils.getObjectById(_params.objectId, Define.Travel, false, false, false);
                        let points = travel.get('points');
                        const position = _params.point;
                        if (!points || position > points.length - 1)
                            return _response.error(Messages(_language).error.INVALID_POINT);
                        const {visitedAt, leftedAt} = points[position];
                        if (!utils.verifyIsoDate(visitedAt) && !utils.verifyIsoDate(leftedAt))
                            return _response.error(Messages(_language).error.INVALID_DATE_IN_STOP);
                        points[position].visited = true;
                        points[position].leftedAt = new Date().toISOString();
                        travel.set('currentStep', position + 1);
                        const date1 = new Date(points[position].visitedAt);
                        const date2 = new Date(points[position].leftedAt);
                        points[position].diffms = date2.getTime() - date1.getTime();
                        const duration = utils.getDuration(date1, date2);
                        const {hours = 0, minutes = 0, seconds = 0} = duration;
                        let durationFormatted = "";
                        durationFormatted += (hours < 10 ? "0" : "") + hours.toString() + ":";
                        durationFormatted += (minutes < 10 ? "0" : "") + minutes.toString() + ":";
                        durationFormatted += (seconds < 10 ? "0" : "") + seconds.toString();
                        points[position].duration = durationFormatted;
                        travel.set('points', points);

                        await travel.save(null, {useMasterKey: true});
                        io.emit("update", JSON.stringify({
                            type: Define.realTimeEvents.travelStatusChange,
                            id: travel.get('user').id,
                            status: "onTheDestination",
                            currentStep: travel.get("currentStep"),
                            visitedAt: points[_params.point].visitedAt,
                            leftedAt: points[_params.point].leftedAt
                        }));
                        const travelFormatted = await _super.formatTravelToFirebase(travel);
                        await FirebaseClass.instance().saveTravelStatus(travel.id, null, null, travelFormatted);
                        return _response.success(travelFormatted);
                    } catch (e) {
                        return _response.error(e)
                    }
                }
            },
            editPoints: async () => {
                if (utils.verifyAccessAuth(_currentUser, ["passenger"], _response) && utils.verifyRequiredFields(_params, ["travelId", "offset", "points", "distance", "time"], _response)) {
                    try {
                        let travel = await utils.getObjectById(_params.travelId, Define.Travel, ['fare', 'couponRelation'], {'user': _currentUser});
                        // let value = 0;
                        let value = Fare.calculateValue(travel.get('fare'), _params.distance, _params.time, _currentUser);
                        if (travel.get("couponRelation")) {
                            let newValues = CouponInstance.calculateDiscount(travel.get("couponRelation"), value);
                            value = newValues.value;
                            travel.set("couponValue", newValues.couponValue);
                        }
                        _params.points[0].type = 'origin';
                        _params.points[_params.points.length - 1].type = 'destination';
                        for (let i = 0; i < _params.points.length; i++) {
                            if (i > 0 && i < _params.points.length - 1) _params.points[i].type = 'points'
                        }
                        travel.set('points', [..._params.points]);
                        travel.set('value', value);
                        travel = await travel.save(null, {useMasterKey: true});
                        io.emit("update", JSON.stringify({
                            type: Define.realTimeEvents.travelStatusChange,
                            id: travel.get('driver').id,
                            status: "stopEdited",
                            points: {..._params.points},
                            currentStep: travel.get('currentStep')
                        }));
                        // let jsonTravel = await _super.formatTravelToFirebase(travel, false, true);
                        let jsonTravelRes = await _super.formatTravelToFirebase(travel, false, true, true);
                        // await FirebaseClass.instance().saveTravelStatus(travel.id, null, null, jsonTravel);
                        PushNotificationClass.instance().sendPush(travel.get("driver").id, Messages(_language).push.editedPoint, {
                            client: "driver",
                            type: "edited",
                            travel: jsonTravelRes
                        });
                        return _response.success(jsonTravelRes)
                    } catch (e) {
                        return _response.error(e)
                    }
                }
            },
            removeEdited: async () => {
                if (utils.verifyAccessAuth(_currentUser, ["driver"], _response) && utils.verifyRequiredFields(_params, ["objectId"], _response)) {
                    FirebaseClass.instance().removeEdited(_params.objectId);
                }
                return _response.success(Messages(_language).success.EDITED_SUCCESS)
            },
            cancelWithCharge: () => {
                if (utils.verifyAccessAuth(_currentUser, ["passenger", "driver"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["objectId"], _response)) {
                        let _travel, locationCancell, cancelRefund = false;
                        return utils.getObjectById(_params.objectId, Define.Travel, ["driver", "user", "card", "fare", "vehicle", "vehicle.category"], null).then((travel) => {
                            _travel = travel;
                            if (travel.get('status') === 'completed' || travel.get('status') === 'cancelled') {
                                return Promise.reject({
                                    code: 401,
                                    message: _travel.get("status") === "completed" ? "Esta corrida já foi concluida anteriormente." : "Esta corrida já foi cancelada anteriormente."
                                });
                            }
                            if (!_currentUser.get("isDriverApp") && ["waiting", "onTheWay"].indexOf(_travel.get("status")) < 0) {
                                return Promise.reject({
                                    code: 400,
                                    message: "Não é possível cancelar uma ocorrida em andamento."
                                });
                            }
                            return travel.has('driver') && _currentUser.id === travel.get('driver').id ? FirebaseClass.instance().getDriverLocation(_currentUser.id, _currentUser) : Promise.resolve()
                        }).then((lc) => {
                            locationCancell = lc;
                            return conf.hasCancellation ? _super.applyCancellationRules(_travel, _currentUser.get('isDriverApp') ? conf.cancellationDriver : conf.cancelationClient, _currentUser.id === _travel.get('driver').id ? "driver" : "user", true) : Promise.resolve()
                        }).then(async (cancelRes) => {
                            await _super.travelInDismissArray(_travel.get('driver'), _params.objectId);
                            return _super.finishCancellation(locationCancell, _travel, _currentUser, _params.offset, false, _params.reallyCanCallAgain)
                        }).then(function () {
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            if (error.code === 401)
                                RedisJobInstance.addJob("Travel", "verifyStatusOfTravelJob", {
                                    objectId: _travel.id
                                });
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            cancelTravelCharge: function () {
                if (utils.verifyAccessAuth(_currentUser, ["passenger", "driver"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["objectId"], _response)) {
                        let _travel, locationCancell;
                        console.log('in cancelTravelCharge cancel by ', _currentUser.id, _params.objectId);
                        return utils.getObjectById(_params.objectId, Define.Travel, ["driver", "user", "card", "fare"], null).then((travel) => {
                            _travel = travel;
                            return travel.has('driver') && _currentUser.id === travel.get('driver').id ? FirebaseClass.instance().getDriverLocation(_currentUser.id, _currentUser) : Promise.resolve()
                        }).then((lc) => {
                            locationCancell = lc;
                            return conf.hasCancellation ? _super.applyCancellationRules(_travel, _currentUser.get('isDriverApp') ? conf.cancellationDriver : conf.cancelationClient, (_travel.get('driver') && _currentUser.id === _travel.get('driver').id) ? "driver" : "user") : Promise.resolve()
                        }).then((payTax) => {
                            if (payTax) return Promise.resolve({
                                code: 667,
                                message: payTax
                            });
                            return _super.finishCancellation(locationCancell, _travel, _currentUser, _params.offset, false, _params.reallyCanCallAgain)
                        }).then(function (res) {
                            return (res && res.code === 667) ? _response.success(res) : _response.success({
                                code: 666,
                                message: Messages(_language).success.EDITED_SUCCESS
                            });
                        }, function (error) {
                            if (error.code === 401)
                                RedisJobInstance.addJob("Travel", "verifyStatusOfTravelJob", {
                                    objectId: _travel.id
                                });
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            cancelTravel: function () {
                if (utils.verifyAccessAuth(_currentUser, ["passenger", "driver"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["objectId", "offset"], _response)) {
                        let _travel;
                        return utils.getObjectById(_params.objectId, Define.Travel, ["driver", "user", "card"], null).then((travel) => {
                            _travel = travel;
                            return travel.has('driver') && _currentUser.id === travel.get('driver').id ? FirebaseClass.instance().getDriverLocation(_currentUser.id, _currentUser) : Promise.resolve()
                        }).then(async function (locationCancell) {
                            if (locationCancell) {
                                _travel.set('driverLocationWhenCancell', locationCancell)
                            }
                            if (["cancelled", "completed"].indexOf(_travel.get("status")) >= 0) {
                                FirebaseClass.instance().removeTravelOfUser(_travel.get("user").id);
                                if (_travel.get("driver"))
                                    FirebaseClass.instance().removeTravelOfUser(_travel.get("driver").id);
                                FirebaseClass.instance().saveTravelStatus(_travel.id, "cancelled", null, {cancelBy: _travel.get("cancelBy")});
                                return Promise.reject({
                                    code: 400,
                                    message: "Esta corrida já foi concluida ou cancelada anteriormente."
                                });
                            }
                            if (!_currentUser.get("isDriverApp") && ["waiting", "onTheWay"].indexOf(_travel.get("status")) < 0) {
                                return Promise.reject({
                                    code: 400,
                                    message: "Não é possível cancelar uma ocorrida em andamento."
                                });
                            }
                            return _super.cancelTravel(_travel, _currentUser, _params.offset);
                        }).then(function (res) {
                            return _super.createCancellationActivity(_travel, _currentUser);
                        }).then(function () {
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            initTravel: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["objectId", "offset"], _response)) {
                        let _travel;

                        let promises = [];
                        promises.push(utils.getObjectById(_params.objectId, Define.Travel, ["user", "driver"], {
                            "driver": _currentUser,
                            "status": "onTheWay"
                        }));
                        promises.push(FirebaseClass.instance().getDriverLocation(_currentUser.id, _currentUser));
                        return Promise.all(promises).then(function (resultPromises) {
                            _travel = resultPromises[0];
                            _travel.set("isWaitingPassenger", false);
                            _travel.set("locationWhenInit", resultPromises[1]);
                            _travel.set("status", "onTheDestination");
                            _travel.set('currentStep', 1);
                            if (_travel.get('points')) {
                                _travel.get('points')[0].leftedAt = new Date().toISOString();
                            }
                            _travel.set('currentStep', 1);
                            let date = new Date;
                            date = new Date();
                            _travel.set("startDate", date);
                            date = new Date;
                            date = new Date(date.setMinutes(date.getMinutes() + _params.offset + _travel.get("time")));
                            _travel.set("expectedTime", date);
                            promises = [];
                            promises.push(_travel.save(null, {useMasterKey: true}));
                            promises.push(PushNotificationClass.instance().sendPushToInformTravelInit(_travel.get("user").id, _travel.id, _travel.get("user").get("language")));
                            promises.push(Activity.travelInit(_currentUser.id, _currentUser.get("name"), _currentUser.get("profileImage"), _travel.id));
                            return Promise.all(promises);
                        }).then(async function () {
                            const _travelFormated = await _super.formatTravelToFirebase(_travel);
                            const _travelFormatedJson = await _super.formatTravelToFirebase(_travel, true, false, true);
                            io.emit("update", JSON.stringify({
                                type: Define.realTimeEvents.travelStatusChange,
                                id: _travel.get('user').id,
                                status: "onTheDestination",
                                isWaitingPassenger: _travel.get("isWaitingPassenger"),
                                currentStep: 0,
                                leftedAt: _travel.get('points')[0].leftedAt
                            }));
                            FirebaseClass.instance().saveTravelStatus(_travel.id, null, null, _travelFormated);
                            return _params.returnTravel ? _response.success(_travelFormatedJson) : _response.success(_travelFormated.status);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            payTravel: function () {
                let pay = Payzen.instance({});
                pay.go({});
                return pay.createPaymentRequest(11111111, "0025", "99375f20e04241438cb1c4cf2163eddd", "335").then(function (result) {
                    return _response.success(resutl);
                }, function (error) {
                    return _response.error(error);
                });
            },
            getTravelReceiptByUser: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["travelId", "type"], _response)) {
                        let offset = _params.offset || conf.timezoneDefault || -180;
                        return _super.generateReceipt(_params.travelId, _params.type, offset).then(function (url) {
                            return _response.success(url);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            getTravelReceipt: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver", "passenger"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["objectId"], _response)) {
                        let offset = _params.offset || conf.timezoneDefault || -180;
                        return _super.generateReceipt(_params.objectId, _currentUser.get("isDriverApp") ? "driver" : "user", offset).then(function (url) {
                            return _response.success(url);
                        }, function (error) {
                            return _response.success(error.code, error.message);
                        });
                    }
                }
            },
            completeTravelFlow: function () {
                return _super.publicMethods.completeTravel();
            },
            getCurrentValueOfTravel: async () => {
                if (utils.verifyRequiredFields(_params, ["objectId"], _response) && utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                    try {
                        let {value} = await _super.getValueOfTravelEalier(_params);
                        const travel = await new Parse.Query(Define.Travel).get(_params.objectId, {useMasterKey: true});
                        const {changeStoppedValue = false, stoppedValue = 0} = await _super.getAditionalValuesOfStops(travel);
                        if (changeStoppedValue)
                            value += stoppedValue;
                        return _response.success({value: value.toFixed(2)});
                    } catch (e) {
                        return (e.code && e.message) ? _response.error(e.code, e.message) : _response.error(e)
                    }
                }
            },
            completeTravelEarlier: async function () {
                if (utils.verifyRequiredFields(_params, ["objectId"], _response) && utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                    try {
                        let {value, travel} = await _super.getValueOfTravelEalier(_params);
                        travel.set('value', value);
                        travel.set('valueDriver', value);
                        travel.set('originalValue', value);
                        await travel.save(null, {useMasterKey: true})
                        io.emit("update", JSON.stringify({
                            type: Define.realTimeEvents.travelStatusChange,
                            id: travel.get('user').id,
                            status: "completed",
                            isWaitingPassenger: travel.get("isWaitingPassenger")
                        }));
                    } catch (e) {
                        return (e.code && e.message) ? _response.error(e.code, e.message) : _response.error(e)
                    }
                }
                return _super.publicMethods.completeTravel(false, false);
            },
            completeTravelAsAdmin: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["objectId", "offset"], _response)) {
                        return _super.publicMethods.completeTravel(true);
                    }
                }
            },
            completeTravel: function (isAdmin, ignoreRecalculate) {
                let finalValue = 0;
                let travel, _travel;
                if (utils.verifyAccessAuth(_currentUser, ["driver", "admin"], _response)) {
                    let fieldsToVerify = ["objectId", "offset"];
                    let filterToDriver = null;

                    if (!isAdmin) {
                        fieldsToVerify.push("latitude");
                        fieldsToVerify.push("longitude");
                        filterToDriver = {"driver": _currentUser};
                    }

                    if (utils.verifyRequiredFields(_params, fieldsToVerify, _response)) {
                        let companyAmount = 0, driver, _plan, user, totalFeeTax;
                        let promises = [];
                        return utils.getObjectById(_params.objectId, Define.Travel, ["user", "driver", "couponRelation", "driver.plan", "origin", "destination", "user.whoReceiveBonusInvite", "driver.whoReceiveBonusInvite", "fare", "discountObj", "card", "vehicle.category"], filterToDriver).then(function (t) {
                            travel = _travel = t;
                            if (t.get("status") === "completed") {
                                _super.cleanFirebaseWhenCompleteTravel(t);
                                return _response.success(_super.formatOutputCompleteTravel(t, _params.returnTravelDB));
                            }
                            if (travelsFinalizing[_params.objectId]) {
                                _super.cleanFirebaseWhenCompleteTravel(t);
                                return _response.success(_super.formatOutputCompleteTravel(t, _params.returnTravelDB));
                            }
                            travelsFinalizing[_params.objectId] = true;
                            travel = t;
                            driver = travel.get("driver");
                            user = travel.get("user");
                            if (isAdmin) {
                                _params.latitude = travel.get("destinationJson").location.latitude;
                                _params.longitude = travel.get("destinationJson").location.longitude;
                                travel.set("completedByAdmin", true);
                            }
                            promises = [];
                            promises.push(PlanClass.instance().getDefaultPlan(driver.get("plan")));
                            promises.push(FirebaseClass.instance().getDriverLocation(driver.id, _currentUser));
                            return Promise.all(promises);
                        }).then(async function (resultPromises) {
                            _plan = resultPromises[0];
                            const {latitude, longitude, listLocationInTravel, sumDistance, offset, appVersion} = _params;
                            if (latitude && longitude) {
                                const location = new Parse.GeoPoint({latitude, longitude});
                                travel.set("locationWhenComplete", {data: new Date().toISOString, location});
                                travel.set("finalLocation", location);
                            }
                            if (listLocationInTravel && Array.isArray(listLocationInTravel) && typeof sumDistance === "number") {
                                travel.set("listLocationInTravel", listLocationInTravel);
                                travel.set("originalListLocationInTravel", JSON.parse(JSON.stringify(listLocationInTravel)));
                                travel.set("sumDistance", sumDistance);
                            }
                            return ignoreRecalculate ? {value: travel.get("value")} : _super.verifyIfNeedRecalculate(travel, offset, isAdmin, appVersion);
                        }).then(function ({value, timeRecalculate, distanceRecalculate, endDateRecalculate, originalFare}) {
                            travel.set("plan", _plan);
                            if (value !== travel.get("value")) {
                                travel.set("valueBeforeRecalculate", travel.get("value"));
                                travel.set("originalValue", value);
                                if (travel.get("couponRelation")) {
                                    let newValues = CouponInstance.calculateDiscount(travel.get("couponRelation"), value);
                                    value = newValues.value;
                                    travel.set("couponValue", newValues.couponValue);
                                }
                            }
                            travel.set("value", value);
                            if (!isAdmin) {
                                if (timeRecalculate) {
                                    travel.set("time", timeRecalculate);
                                } else {
                                    let diffTimeOfTravel = new Date();
                                    travel.set("time", utils.diffTimeinMinutes(travel.get("startDate"), diffTimeOfTravel));
                                }
                                if (distanceRecalculate) {
                                    travel.set("distance", distanceRecalculate);
                                    travel.set("sumDistance", distanceRecalculate);
                                }
                                if (originalFare) {
                                    travel.set("originalFare", originalFare);
                                }
                            }
                            let price = travel.get("originalValue") || travel.get("value"); //discount was already considered (in requestTravel)
                            let fee = travel.get("fee") ? parseFloat((travel.get("fee") || 0).toFixed(2)) : 0;
                            let planFee = 0;
                            let withoutFee = 0;
                            if (conf.calculateFinalValueWithoutFee) {
                                price -= fee;
                                withoutFee = fee;
                                fee = 0;
                            }
                            // Calcula tarifa cobrada pelo plano.
                            if (conf.usePlan)
                                planFee = parseFloat((price * (_plan.get("percent") / 100)).toFixed(2));
                            else {
                                const percentCompany = travel.get("vehicle").get("category").get("percentCompany") || _plan.get("percent");
                                planFee = parseFloat((price * (percentCompany / 100)).toFixed(2));
                            }
                            if (conf.customSplit && _currentUser.get('customSplit')) {
                                let splitValue = Number(_currentUser.get('customSplit').replace('%', ''));
                                planFee = parseFloat((price * (splitValue / 100)).toFixed(2));
                                fee = 0;
                            }
                            travel.set("planFee", planFee);
                            // Desconta tarifa fixa + tarifa do plano do motorista.
                            companyAmount = fee + planFee;
                            // Se pagamento for em cartão, valor do motorista é calculado com as tarifas.
                            let valueDriver = utils.toFloat(travel.has("card") ? (price - companyAmount) : price + withoutFee);

                            let totalFee = price - fee - planFee;
                            if (conf.bonusLevel && conf.bonusLevel.type === "letsgo" && conf.bonusLevel.addValueInTravel) {
                                let networkPassengerValue = (valueDriver - (valueDriver / conf.bonusLevel.addValueInTravel));
                                totalFee -= networkPassengerValue;
                                valueDriver -= networkPassengerValue;
                                travel.set("networkPassengerValue", utils.toFloat(networkPassengerValue));
                            }

                            if (conf.bonusLevel && conf.bonusLevel.feeStartCycle != null) {
                                if (!driver.get("dayValue")) {
                                    driver.set("dayValue", 0);
                                }
                                if (!driver.get("blockedValue")) {
                                    driver.set("blockedValue", 0);
                                }
                                if (driver.get("dayValue") === null) {
                                    driver.set("dayValue", !driver.get('sharedGain') ? -conf.bonusLevel.feeStartCycle : 0);
                                }
                                if (driver.get("dayValue") < 0) {
                                    let dayValue = driver.get("dayValue");
                                    travel.set("debitOfDriverBefore", dayValue);
                                    // driver.increment("dayValue", valueDriver);
                                    travel.set("debitOfDriver", Math.abs((valueDriver + dayValue <= 0 ? valueDriver : dayValue)));
                                    valueDriver += dayValue;
                                    driver.increment("dayValue", travel.get("debitOfDriver"));
                                    if (valueDriver < 0) {
                                        valueDriver = 0;
                                    }
                                } else {
                                    travel.set("debitOfDriverBefore", 0);
                                    travel.set("debitOfDriver", 0);
                                }
                                if (driver.get("sharedGain") && valueDriver >= 0) {
                                    travel.set("networkDriverValue", utils.toFloat(valueDriver * 0.1));
                                    RedisJobInstance.addJob("Bonus", "splitSharedGain", {
                                        objectId: travel.id,
                                        driverId: driver.id,
                                        value: travel.get("networkDriverValue")
                                    });
                                    valueDriver = utils.toFloat(valueDriver * 0.9);
                                }
                                if ((driver.get('dayValue') || driver.get('dayValue') === 0) && driver.get('dayValue') !== undefined && driver.get('dayValue') !== null) {
                                    driver.increment("dayValue", valueDriver);
                                } else {
                                    driver.set("dayValue", valueDriver);
                                }
                            }
                            if (conf.payment && conf.payment.removeSplitMethod) {
                                if (travel.get("value") < 1 && valueDriver > 0) {
                                    RedisJobInstance.addJob("Travel", "paidTravelWithCoupon", {
                                        objectId: driver.id,
                                        value: valueDriver
                                    });
                                } else {
                                    if ((driver.get('blockedValue')) >= 0) {
                                        driver.increment("blockedValue", valueDriver);
                                    } else {
                                        driver.set("blockedValue", valueDriver);
                                    }
                                }
                            }
                            totalFeeTax = fee + planFee + withoutFee;
                            // Se pagamento for em dinheiro, adiciona as tarifas no saldo devedor do motorista
                            let debtToAdd = parseFloat((travel.has("card") ? 0 : totalFeeTax).toFixed(2));

                            if (travel.get("usingBonus") && conf.bonusLevel && conf.bonusLevel.type === "letsgo") {
                                let bonus = user.get("travelBonusTotal");
                                let bonusUsed = bonus > travel.get("value") ? travel.get("value") : bonus;
                                if (user.get("travelBonusTotal")) {
                                    user.increment("travelBonusTotal", -travel.get("value"));
                                } else {
                                    user.set("travelBonusTotal", -travel.get("value"));
                                }
                                travel.set("paidWithBonus", bonusUsed);
                            }
                            if (conf.bonusLevel && conf.bonusLevel.type === "yesgo" && travel.get("usingBonus") && !travel.get("card")) {
                                let travelBonus = user.get("travelBonusTotal") || 0;
                                if (travelBonus && travelBonus > 0) {
                                    let bonusUsed = travelBonus > travel.get("value") ? travel.get("value") : travelBonus;
                                    user.increment("travelBonusTotal", bonusUsed > travelBonus ? (-travelBonus) : (-bonusUsed));
                                    travel.set("paidWithBonus", bonusUsed);
                                    let newValueDriver = valueDriver - bonusUsed;
                                    travel.set("valueDriver", newValueDriver);
                                    travel.set("driverCredit", bonusUsed - debtToAdd);
                                    travel.increment("value", -bonusUsed);
                                    valueDriver = newValueDriver;
                                    debtToAdd -= bonusUsed;
                                }
                            }
                            if (conf.bonusLevel && conf.bonusLevel.type === "uaimove" && !travel.get("coupon") && !travel.get("card")) {
                                // Verifica se possui sistema de bonus e saldo positivo
                                let travelBonus = user.get("travelBonusTotal") || 0;
                                if (travelBonus && travelBonus > 0) {
                                    let totalFees = (fee + planFee + withoutFee);
                                    let bonusUsed = travelBonus > travel.get("value") ? travel.get("value") : travelBonus;
                                    if (travelBonus > 0) {
                                        user.increment("travelBonusTotal", bonusUsed > travelBonus ? (-travelBonus) : (-bonusUsed));
                                    }
                                    travel.set("paidWithBonus", bonusUsed);
                                    if (!travel.get("card")) {
                                        let newValueDriver = valueDriver - bonusUsed;
                                        travel.set("valueDriver", newValueDriver);
                                        travel.set("driverCredit", bonusUsed - debtToAdd);
                                        travel.increment("value", -bonusUsed);
                                        valueDriver = newValueDriver;
                                        debtToAdd -= bonusUsed;
                                    } else {
                                        debtToAdd = (travel.get("value") - bonusUsed > totalFees) ? 0 : -(travel.get("value") - totalFees);
                                    }
                                }
                            }
                            if (conf.bonusLevel && conf.bonusLevel.type === "bigu") {
                                // Verifica se possui sistema de bonus e saldo positivo
                                let travelBonus = user.get("travelBonusTotal") || 0;
                                let shoppingBonus = user.get("shoppingBonus") || 0;
                                let bonus = travelBonus + shoppingBonus;
                                if (bonus && bonus > 0) {
                                    let totalFees = (fee + planFee + withoutFee);
                                    let bonusUsed = bonus > travel.get("value") ? travel.get("value") : bonus;
                                    let controlBonus = bonusUsed;
                                    if (travelBonus > 0) {
                                        if (controlBonus > travelBonus) {
                                            if (user.get("travelBonus")) {
                                                user.increment("travelBonus", -travelBonus);
                                            } else {
                                                user.set("travelBonus", -travelBonus);
                                            }
                                            controlBonus -= travelBonus;
                                        } else {
                                            if (user.get("travelBonus")) {
                                                user.increment("travelBonus", -controlBonus);
                                            } else {
                                                user.set("travelBonus", -controlBonus);
                                            }
                                            controlBonus = 0;
                                        }
                                    }
                                    if (shoppingBonus > 0) {
                                        if (shoppingBonus > 0 && controlBonus > shoppingBonus) {
                                            if (user.get("shoppingBonus")) {
                                                user.increment("shoppingBonus", -shoppingBonus);
                                            } else {
                                                user.set("shoppingBonus", -shoppingBonus);
                                            }
                                            controlBonus -= shoppingBonus;
                                        } else {
                                            if (user.get("shoppingBonus")) {
                                                user.increment("shoppingBonus", -controlBonus);
                                            } else {
                                                user.set("shoppingBonus", -controlBonus);
                                            }
                                            controlBonus = 0;
                                        }
                                    }
                                    travel.set("paidWithBonus", bonusUsed);
                                    if (!travel.get("card")) {
                                        travel.set("valueDriver", valueDriver - bonusUsed);
                                        debtToAdd -= bonusUsed;

                                    } else {
                                        debtToAdd = (travel.get("value") - bonusUsed > totalFees) ? 0 : -(travel.get("value") - totalFees);
                                    }
                                    travel.set("creditDriverBonus", bonusUsed);
                                }
                            }
                            travel.set("totalValue", totalFee);
                            let inDebt = driver ? parseFloat(((driver.get("inDebt") || 0) + debtToAdd).toFixed(2)) : 0;
                            if (conf.chargeDebitInCard && travel.has('card')) {
                                // Se corrida for no cartão, e meu saldo devedor for maior do que o total da corrida
                                // Debita o valor da corrida do saldo devedor e motorista não recebe valor da corrida.
                                if (inDebt > 0 && inDebt >= travel.get("totalValue")) {
                                    companyAmount += travel.get("totalValue");
                                    inDebt = inDebt - travel.get("totalValue");
                                    travel.set("inDebtUsed", travel.get("totalValue"));
                                    travel.set("totalValue", 0);
                                } else if (inDebt > 0 && inDebt < travel.get("totalValue")) {
                                    travel.set("totalValue", travel.get("totalValue") - inDebt);//18.91
                                    companyAmount += parseFloat(inDebt.toFixed(2));//5.04
                                    travel.set("inDebtUsed", inDebt);
                                    inDebt = 0;
                                }
                                if (inDebt != null) {
                                    driver.set("inDebt", inDebt);
                                }
                            }

                            if (travel.get("coupon") && travel.get("originalValue") && !(conf.payment && conf.payment.removeSplitMethod)) {
                                inDebt += utils.toFloat(travel.get("value") - travel.get("originalValue"));
                                if (travel.get("card")) inDebt += totalFeeTax;
                                valueDriver = travel.get("value");
                            }
                            if (inDebt != null) {
                                travel.set("inDebt", inDebt - driver.get("inDebt"));
                                driver.set("inDebt", inDebt);
                            }
                            travel.set("valueDriver", valueDriver);

                            driver.set("inTravel", false);
                            let balance = travel.has("card") ? (driver.get("balance") || 0) + travel.get("totalValue") : (driver.get("balance") || 0) + travel.get("value");
                            driver.set("balance", balance);
                            if (!driver.get("totalTravelsAsDriver")) {
                                driver.set("totalTravelsAsDriver", 0);
                            }
                            driver.increment("totalTravelsAsDriver");
                            if (!user.get("totalTravelsAsUser")) {
                                user.set("totalTravelsAsUser", 0);
                            }
                            user.increment("totalTravelsAsUser");
                            user.set("totalSpent", user.get("totalSpent") || 0 + travel.get("value"));
                            /*Atualizando status da corrida como completa no DB*/
                            _super.updateStatus(travel, "completed");
                            let date = endDateRecalculate || new Date;
                            travel.set("duration", (travel.get("startDate") ? Math.abs((date.getTime() - travel.get("startDate").getTime()) / 1000) : 0));
                            travel.set("endDate", date);
                            if (travel.get("discountObj")) {
                                travel.get("discountObj").set("used", true);
                            }
                            travel.set("user", user);
                            _travel = travel;
                            let totalValue = parseFloat(_travel.get("totalValue").toFixed(2));
                            finalValue = travel.get('value');
                            if (conf.hasCancellation) {
                                finalValue = parseFloat((travel.get("value") + (travel.get('user').has('clientDebt') ? travel.get('user').get('clientDebt') : 0)).toFixed(2));
                                travel.set('debtCharged', travel.get('user').get('clientDebt'))
                            } else if (conf.hasCancellation && conf.appName.toLowerCase() === "letsgo" && (driver.has('clientDebt') && driver.get('clientDebt') > 0)) {
                                if (driver.get('clientDebt') > valueDriver) {
                                    driver.increment('clientDebt', (-1 * valueDriver));
                                    travel.set("valueDriver", 0);
                                    travel.set('debtCharged', valueDriver);
                                } else {
                                    let fValueDriver = valueDriver - driver.get('clientDebt');
                                    if (driver.get('clientDebt')) {
                                        driver.increment('clientDebt', (-1 * driver.get('clientDebt')));
                                    } else {
                                        driver.set('clientDebt', (-1 * driver.get('clientDebt')));
                                    }
                                    travel.set("valueDriver", fValueDriver);
                                    travel.set('debtCharged', driver.get('clientDebt'));
                                }
                            }
                            return _travel.has("card") ? PaymentModule.captureTransaction({
                                userId: driver.id,
                                id: travel.get("paymentId"),
                                destination: travel.get("destinationJson"),
                                cardId: travel.get("card").get("paymentId"),
                                driverId: travel.get("driver").id,
                                isDriver: travel.get("driver").get("isDriverApp"),
                                recipientId: travel.get("driver").get("recipientId"),
                                drive: travel.get("driver").get("recipientId"),
                                email: travel.get("user").get("email"),
                                cpf: travel.get("user").get("cpf"),
                                name: UserClass.instance().formatNameToPayment(travel.get("user")),
                                driverAmount: totalValue,
                                totalAmount: parseFloat(finalValue),
                                toRefund: _travel.get("paidWithBonus"),
                                travelId: _travel.id,
                                driver: _travel.get('driver'),
                                originalvalue: parseFloat(finalValue),
                                debtValue: travel.get("inDebtUsed"),
                                driverCpf: travel.get("driver").get("cpf")
                            }) : ((conf.payment && conf.payment.db) ? PaymentModule.captureMoneyTransaction({
                                travelId: _travel.id,
                                userId: _travel.get('user').id,
                                targetId: driver.id,
                                request: {},
                                value: -_travel.get('inDebt'),
                                driver: _travel.get('driver'),
                                originalvalue: parseFloat(finalValue),
                            }) : Promise.resolve());

                        }).then(function (notReceived) {
                            promises = [];
                            promises.push(BonusInstance.setBonusToUser(_travel));
                            //salvando 2 fatura gerada para a corrida
                            if (travel.get("card") && notReceived) {
                                _super.savingSecondInvoice(notReceived, travel);
                            }
                            if (travel.get("locationWhenInit") && travel.get("locationWhenComplete")) {
                                let origin = travel.get("locationWhenInit").location;
                                let destiny = travel.get("locationWhenComplete").location;
                                if (origin && destiny)
                                    promises.push(utils.generateMapImage(origin.latitude, origin.longitude, destiny.latitude, destiny.longitude));
                                if (notReceived === true) {
                                    driver.set("inDebt", (driver.get("inDebt") - (travel.get("value") - totalFeeTax)));
                                    travel.set("driver", driver);
                                }
                                if (!travel.has('card') && conf.hasCancellation && travel.get('debtCharged')) {
                                    if (travel.get('user').has('clientDebt')) {
                                        let _client = travel.get('user');
                                        if (_client.get('clientDebt')) {
                                            _client.increment('clientDebt', -1 * travel.get('debtCharged'));
                                        } else {
                                            _client.set('clientDebt', -1 * travel.get('debtCharged'))
                                        }
                                        if (driver.get('inDebt')) {
                                            driver.increment('inDebt', travel.get('debtCharged'));
                                        } else {
                                            driver.set('inDebt', travel.get('debtCharged'));
                                        }
                                        promises.push(_client.save(null, {useMasterKey: true}));
                                        promises.push(driver.save(null, {useMasterKey: true}))
                                    }
                                } else if (travel.has('card') && conf.hasCancellation) {
                                    if (travel.get('user').has('clientDebt')) {
                                        let _client = travel.get('user');
                                        if (_client.has('clientDebt')) {
                                            _client.increment('clientDebt', -1 * travel.get('debtCharged'))
                                        } else {
                                            _client.set('clientDebt', -1 * travel.get('debtCharged'))
                                        }
                                        promises.push(_client.save(null, {useMasterKey: true}))
                                    }
                                }
                            }
                            return Promise.all(promises);
                        }).then(function (resultPromises) {
                            _travel = travel
                            if (resultPromises.length > 1 && typeof resultPromises[1] === "string") {
                                let images = travel.get("map") || {};
                                images.bigMap = resultPromises[1];
                                travel.set("map", images)
                            }
                            promises = [];

                            user.unset('current_travel');
                            driver.unset('current_travel');

                            promises.push(user.save(null, {useMasterKey: true}));
                            if (conf.bonusLevel) promises.push(UserClass.instance().formatUser(user));

                            let points = travel.get("points");
                            if (points) {
                                points[points.length - 1].visited = true;
                                points[points.length - 1].visitedAt = new Date().toISOString();
                            }
                            travel.set('points', points);
                            driver.set("dismissArray", []);

                            FirebaseClass.instance().updateDriver(_currentUser.id, null, null, []);
                            promises.push(travel.save(null, {useMasterKey: true}));
                            promises.push(driver.save(null, {useMasterKey: true}));
                            promises.push(PushNotificationClass.instance().sendPushToCompleteTravel(_travel.get("user").id, _travel.id, user.get("language")));
                            promises.push(Activity.completeTravel(_travel.id, _travel.get("user").id, _travel.get("user").get("name"), _travel.get("user").get("profileImage"), driver.id, driver.get("name"), driver.get("profileImage")));
                            return Promise.all(promises);
                        }).then(async function (responses) {
                            try {
                                delete travelsFinalizing[_travel.id];
                                io.emit("update", JSON.stringify({
                                    type: Define.realTimeEvents.travelStatusChange,
                                    id: _travel.get('user').id,
                                    status: "completed",
                                    isWaitingPassenger: _travel.get("isWaitingPassenger")
                                }));
                                FirebaseClass.instance().saveTravelStatus(_travel.id, "completed", null, await _super.formatTravelToFirebase(_travel));
                                FirebaseClass.instance().removeTravelOfUser(_travel.get("user").id);
                                FirebaseClass.instance().removeTravelOfUser(_travel.get("driver").id);
                                if (conf.bonusLevel) FirebaseClass.instance().updateUserInfo(responses[1]);
                                delete userInTravel[_travel.get("user").id];
                                if (client) client.set('userInTravel', JSON.stringify(userInTravel));
                                RedisJobInstance.addJob("PaymentManager", "requestInDebtPayment", {
                                    driverId: _travel.get("driver").id
                                });
                                RedisJobInstance.addJob("Bonus", "incrementGainMonthly", {
                                    driverId: _travel.get("driver").id,
                                    value: _travel.get("originalValue") || _travel.get("totalValue")
                                });
                                if (_currentUser.get("isAdmin")) {
                                    RedisJobInstance.addJob("Logger", "logCompleteTravelAsAdmin", {
                                        objectId: _travel.id,
                                        admin: _currentUser.id
                                    });
                                }
                                if (conf.sendTravelReceiptToUser)
                                    RedisJobInstance.addJob("Travel", "sendTravelReceiptToUserJob", {
                                        objectId: _travel.id,
                                        admin: _currentUser.id
                                    });
                                if (conf.blockDriversInDebt)
                                    RedisJobInstance.addJob("User", "blockDriverInDebt", {
                                        objectId: _travel.get("driver").id || ""
                                    });

                            } catch (e) {
                                console.error(e, "erro complete 3935")
                            }
                            const tResponse = _super.formatOutputCompleteTravel(_travel, _params.returnTravelDB)
                            if (travel.get("debtCharged"))
                                tResponse.valueDriver = tResponse.travel.valueDriver += travel.get("debtCharged");
                            console.log(tResponse)
                            return _response.success(tResponse);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            listTravels: function () {
                if (utils.verifyAccessAuth(_currentUser, ["passenger", "driver"], _response)) {
                    _params.offset = _params.offset || -180;
                    let userType = _currentUser.get("isDriverApp") ? "driver" : "user";

                    let query = new Parse.Query(Define.Travel);
                    query.include(["fare", "fare.category", "driver", "user"]);
                    query.notEqualTo("deleted", true);
                    query.descending("createdAt");
                    if (_params.startDate && _params.endDate && _params.offset) {
                        let startDate = new Date(_params.startDate.setHours(0, 0, 0));
                        startDate = new Date(startDate.setMinutes(startDate.getMinutes() + _params.offset));
                        let endDate = new Date(_params.endDate.setHours(23, 59, 59));
                        endDate = new Date(endDate.setMinutes(endDate.getMinutes() + _params.offset));
                        query.lessThanOrEqualTo("startDate", endDate);
                        query.greaterThanOrEqualTo("startDate", startDate);
                    }
                    if (_params.status) {
                        query.equalTo("status", _params.status);
                    }
                    if (_params.payment) {
                        if (_params.payment === "card") {
                            query.exists("card");
                        } else query.doesNotExist("card");
                    }
                    let limit = _params.limit || 2000;
                    let page = (_params.page || 0) * limit;
                    if (limit) query.limit(limit);
                    if (page) query.skip(page);
                    query.equalTo(userType, _currentUser);
                    if (conf.appName.toLowerCase() !== "2vs") {
                        query.containedIn("status", ["completed", "cancelled"]);
                    }
                    query.include(["user", "driver", "origin", "destination", "vehicle", "vehicle.category", "fare", "card", "fare.category"]);
                    query.select(["debtCharged", "serviceOrder", "card", "fee", "planFee", "couponValue", "value", "valueDriver", "status", "cancellationFee", "cancelBy", "originJson", "destinationJson", "driverRate", "cancelDate", "userRate", "startDate", "driver.name", "driver.lastName", "user.name", "user.lastName", "origin.address", "origin.number", "origin.complement", "origin.neighborhood", "destination.address", "destination.number", "destination.complement", "destination.neighborhood", "card", "apiVersion"]);
                    let _result;
                    return query.find().then(function (result) {
                        _result = result;
                        return utils.countObject(Define.Travel, userType === "driver" ? {"driver": _currentUser} : {"user": _currentUser});
                    }).then(function (count) {
                        let objs = [];
                        for (let i = 0; i < _result.length; i++) {
                            let obj = utils.formatPFObjectInJson(_result[i], ["value", "valueDriver", "cancelBy", "status", "driverRate", "userRate", "startDate", "cancelDate", "cancellationFee", "apiVersion"]);
                            obj.value = (conf.appName.toLowerCase() === "letsgo" && obj.status === "cancelled") ? 0 : obj.value;
                            obj.driver = utils.formatPFObjectInJson(_result[i].get("driver"), ["name", "lastName"]);
                            obj.passenger = utils.formatPFObjectInJson(_result[i].get("user"), ["name", "lastName"]);
                            obj.origin = _result[i].get("originJson") ? _result[i].get("originJson") : utils.formatPFObjectInJson(_result[i].get("origin"), ["address", "number", "complement", "city", "state", "neighborhood"]);
                            obj.destination = _result[i].get("destinationJson") ? _result[i].get("destinationJson") : utils.formatPFObjectInJson(_result[i].get("destination"), ["address", "number", "complement", "city", "state", "neighborhood"]);
                            obj.category = _result[i].get("vehicle") ? _result[i].get("vehicle").get("category").get("name") : null;
                            obj.hidePayment = (conf.payment && conf.payment.hidePayment) || false;
                            obj.payment = _super.getPaymentMethodOfTravel(_result[i]);
                            obj.startDate = obj.startDate || obj.cancelDate || new Date();
                            obj.apiVersion = obj.apiVersion || null;
                            obj.serviceOrder = _result[i].get("serviceOrder") || null;
                            if (conf.appName.toLowerCase() === "yesgo" && _result[i].get("card")) {
                                let fees = (_result[i].get("fee") ? _result[i].get("fee") : 0) + (_result[i].get("planFee") || 0);
                                obj.valueDriver = obj.valueDriver + (_result[i].get("couponValue") ? _result[i].get("couponValue") - fees : 0);
                            } else if (userType === 'user' && _result[i].get("debtCharged") && conf.appName.toLowerCase() === "cheguei") {
                                obj.value += (_result[i].get("debtCharged") || 0);
                            }
                            objs.push(obj);
                        }
                        return _response.success({totalTravels: count, travels: objs});
                    });
                }
            },
            listScheduleTravels: function () {
                if (utils.verifyAccessAuth(_currentUser, ["passenger", "driver"], _response)) {
                    _params.offset = _params.offset || -180;
                    let userType = _currentUser.get("isDriverApp") ? "driver" : "user";

                    let query = new Parse.Query(Define.Travel);
                    query.notEqualTo("deleted", true);
                    query.descending("createdAt");
                    query.equalTo("isScheduled", true);

                    if (_params.startDate && _params.endDate && _params.offset) {
                        let startDate = new Date(_params.startDate.setHours(0, 0, 0));
                        startDate = new Date(startDate.setMinutes(startDate.getMinutes() + _params.offset));
                        let endDate = new Date(_params.endDate.setHours(23, 59, 59));
                        endDate = new Date(endDate.setMinutes(endDate.getMinutes() + _params.offset));
                        query.lessThanOrEqualTo("startDate", endDate);
                        query.greaterThanOrEqualTo("startDate", startDate);
                    }
                    if (_params.status) {
                        query.equalTo("status", _params.status);
                    }
                    if (_params.payment) {
                        if (_params.payment === "card") {
                            query.exists("card");
                        } else query.doesNotExist("card");
                    }
                    let limit = _params.limit || 2000;
                    let page = (_params.page || 0) * limit;
                    if (limit) query.limit(limit);
                    if (page) query.skip(page);
                    query.equalTo(userType, _currentUser);
                    query.containedIn("status", ["new", "newScheduled"]);
                    query.include(["user", "driver", "origin", "destination", "vehicle", "vehicle.category", "fare", "card", "fare.category"]);
                    query.select(["value", "valueDriver", "status", "cancellationFee", "cancelBy", "originJson", "destinationJson", "driverRate", "cancelDate", "userRate", "startDate", "driver.name", "driver.lastName", "user.name", "user.lastName", "origin.address", "origin.number", "origin.complement", "origin.neighborhood", "destination.address", "destination.number", "destination.complement", "destination.neighborhood", "card", "apiVersion", "fare.category.name", "appointmentDate"]);
                    let _result;
                    return query.find().then(function (result) {
                        _result = result;
                        return utils.countObject(Define.Travel, userType === "driver" ? {"driver": _currentUser} : {"user": _currentUser});
                    }).then(function (count) {
                        let objs = [];
                        for (let i = 0; i < _result.length; i++) {
                            let obj = utils.formatPFObjectInJson(_result[i], ["value", "valueDriver", "cancelBy", "status", "driverRate", "userRate", "startDate", "cancelDate", "cancellationFee", "apiVersion", "appointmentDate"]);
                            obj.value = (conf.appName.toLowerCase() === "letsgo" && obj.status === "cancelled") ? 0 : obj.value;
                            obj.driver = utils.formatPFObjectInJson(_result[i].get("driver"), ["name", "lastName"]);
                            obj.passenger = utils.formatPFObjectInJson(_result[i].get("user"), ["name", "lastName"]);
                            obj.origin = _result[i].get("originJson") ? _result[i].get("originJson") : utils.formatPFObjectInJson(_result[i].get("origin"), ["address", "number", "complement", "city", "state", "neighborhood"]);
                            obj.destination = _result[i].get("destinationJson") ? _result[i].get("destinationJson") : utils.formatPFObjectInJson(_result[i].get("destination"), ["address", "number", "complement", "city", "state", "neighborhood"]);
                            obj.category = _result[i].get("fare") ? _result[i].get("fare").get("category").get("name") : null;
                            obj.hidePayment = (conf.payment && conf.payment.hidePayment) || false;
                            obj.payment = _super.getPaymentMethodOfTravel(_result[i]);
                            obj.startDate = obj.startDate || obj.cancelDate || new Date();
                            obj.apiVersion = obj.apiVersion || null;
                            objs.push(obj);
                        }
                        return _response.success({totalTravels: count, travels: objs});
                    });
                }
            },
            listAllTravels: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        let query = new Parse.Query(Define.Travel);
                        let local;
                        if (_params.search) {
                            _params.search = _params.search.toLowerCase().trim();
                            let queryId = new Parse.Query(Define.Travel);
                            queryId.matches("objectId", _params.search.toLowerCase(), "i");
                            let queryName = Parse.Query.or(new Parse.Query(Parse.User).matches("name", _params.search.toLowerCase(), "i"), new Parse.Query(Parse.User).matches("fullName", _params.search.toLowerCase(), "i"));
                            let queryPlate = new Parse.Query(Define.Vehicle);
                            queryPlate.matches("plate", _params.search.toLowerCase(), "i");
                            let queryTravelDriver = new Parse.Query(Define.Travel);
                            queryTravelDriver.matchesQuery("driver", queryName);
                            let queryTravelUser = new Parse.Query(Define.Travel);
                            queryTravelUser.matchesQuery("user", queryName);
                            let queryTravelPlate = new Parse.Query(Define.Travel);
                            queryTravelPlate.matchesQuery("vehicle", queryPlate);
                            query = Parse.Query.or(queryId, queryTravelDriver, queryTravelUser, queryTravelPlate);
                        }
                        let json = {totalTravels: 0, travels: []};
                        if (_params.status) {
                            switch (_params.status) {
                                case "deleted":
                                    if (_params.cancelBy) {
                                        if (_params.cancelBy !== "all") {
                                            if (_params.cancelBy === 'noDrivers') {
                                                query.containedIn("cancelBy", ["noDrivers", "byError"]);
                                                query.equalTo("errorCode", 618);
                                                query.containedIn("driversReceivePush", [[], undefined]);
                                                delete _params.status;
                                            } else {
                                                query.equalTo("cancelBy", _params.cancelBy);
                                                query.notEqualTo("errorCode", 618);
                                            }
                                        }
                                    } else {
                                        query.notContainedIn("cancelBy", ["noDrivers", "byError"]);
                                    }
                                    break;
                                case "cancelled":
                                    if (_params.cancelBy && _params.cancelBy !== "all")
                                        query.equalTo("cancelBy", _params.cancelBy);
                                    break;
                                case "notAttended":
                                    _params.status = "cancelled";
                                    query.equalTo("cancelBy", "system");
                                    break;
                                default:
                                    break;
                            }
                            if (_params.status) query.equalTo("status", _params.status);
                        }

                        if (_params.driverId && typeof _params.driverId === "string") {
                            let driver = new Parse.User();
                            driver.set("objectId", _params.driverId);
                            query.equalTo("driver", driver);
                        }
                        if (_params.userId && typeof _params.userId === "string") {
                            let driver = new Parse.User();
                            driver.set("objectId", _params.userId);
                            query.equalTo("user", driver);
                        }
                        if (_params.driverIdNotReceive) {
                            query.contains("driversReceivePush", _params.driverIdNotReceive);

                            let driver = new Parse.User();
                            driver.set("objectId", _params.driverIdNotReceive);
                            query.notEqualTo("driver", driver);
                        }
                        if (_params.category) {
                            let category = new Define.Category();
                            category.set("objectId", _params.category);
                            let fareQuery = new Parse.Query(Define.Fare);
                            fareQuery.equalTo("category", category);
                            query.matchesQuery("fare", fareQuery);
                        }
                        if (_params.order) {
                            let method = _params.order[0] === "+" ? "ascending" : "descending";
                            query[method](_params.order.substring(1) == 'date' ? 'createdAt' : _params.order.substring(1));
                        }
                        if (_params.startDate != null) {
                            query.greaterThanOrEqualTo("createdAt", _params.startDate)
                        }
                        if (_params.endDate != null) {
                            query.lessThanOrEqualTo("createdAt", _params.endDate)
                        }
                        let limit = _params.limit || 10;
                        let page = ((_params.page || 1) - 1) * limit;
                        if (limit) query.limit(limit);
                        if (page) query.skip(page);
                        query.include(["user", "driver", "couponRelation", "origin", "fare.category", "destination", "vehicle"]);
                        query.select(["driver.name", "fee", "planFee", "coupon", "card", "couponRelation.name", "cancelBy", "cancelDate", "fare.category.name", "originJson", "destinationJson", "driver.lastName", "user.name", "user.lastName", "origin.address", "origin.number", "origin.complement",
                            "destination.address", "destination.number", "destination.complement", "status", "time", "value", "valueDriver",
                            "startDate", "endDate", "vehicle.plate", "driverRate", "userRate", "driversReceivePush", "errorCode"]);
                        let objs = [];
                        local = _currentUser.get('admin_local');
                        if (_params.stateId) {
                            const state = await utils.getObjectById(_params.stateId, Define.State);
                            _params.state = state.get("name");
                            if (_params.cityId) {
                                const city = await utils.getObjectById(_params.cityId, Define.City);
                                _params.city = city.get("name");
                            }
                        }
                        if (!local && _params.state) {
                            local = {state: _params.state};
                            if (_params.city) local.city = _params.city;
                        }
                        let state;
                        // = local ?  : Promise.resolve();
                        if (local) {
                            const sQuery = new Parse.Query(Define.State);
                            if (local.state.length > 2) {
                                sQuery.equalTo('name', local.state)
                            } else
                                sQuery.equalTo('sigla', local.state);
                            state = await sQuery.first()
                        }
                        if (local && state) {
                            query.equalTo('originJson.state', state.get('name'));
                            if (local.city) query.equalTo('originJson.city', local.city)
                        }
                        json.totalTravels = await query.count();
                        const travels = await query.find();
                        for (let i = 0; i < travels.length; i++) {
                            let origin = Address.formatAddressToTravelDetails(travels[i].get("originJson"), travels[i].get("origin"));
                            let destination = Address.formatAddressToTravelDetails(travels[i].get("destinationJson"), travels[i].get("destination"));
                            objs.push({
                                fee: parseFloat(travels[i].get("fee") || 0 + travels[i].get("planFee") || 0).toFixed(2),
                                driver: utils.formatPFObjectInJson(travels[i].get("driver"), ["name", "lastName"]),
                                passenger: utils.formatPFObjectInJson(travels[i].get("user"), ["name", "lastName"]),
                                coupon: travels[i].get("couponRelation") ? travels[i].get("couponRelation").get("name") : "",
                                paymentMethod: _super.getPaymentMethodOfTravel(travels[i]),
                                origin: origin.fullAddress,
                                originCity: origin.city,
                                originState: origin.state,
                                destinationCity: destination.city,
                                destinationState: destination.state,
                                destination: destination.fullAddress,
                                status: travels[i].get("status"),
                                time: utils.convertMinToHHMMSS(travels[i].get("time")),
                                value: travels[i].get("value"),
                                valueDriver: travels[i].get("valueDriver"),
                                cancelBy: travels[i].get("cancelBy"),
                                cancelDate: travels[i].get("cancelDate"),
                                startDate: travels[i].get("startDate"),
                                endDate: travels[i].get("endDate"),
                                category: {name: travels[i].get("fare") ? travels[i].get("fare").get("category").get("name") : ""},
                                date: travels[i].createdAt,
                                vehicle: utils.formatPFObjectInJson(travels[i].get("vehicle"), ["plate"]),
                                driverRate: parseInt(travels[i].get("driverRate")),
                                userRate: parseInt(travels[i].get("userRate")),
                                objectId: travels[i].id,
                                noDrivers: (travels[i].get("errorCode") != 618 && travels[i].get("cancelBy") != "system") ? false : true
                            });
                        }
                        json.travels = objs;
                        return _response.success(json);
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            getTravel: () => {
                if (utils.verifyAccessAuth(_currentUser, ["driver", "passenger"], _response) && utils.verifyRequiredFields(_params, ["travelId"], _response)) {
                    let _travel;
                    let tQuery = new Parse.Query(Define.Travel);
                    tQuery.include(['user', 'vehicle', 'driver', 'map', 'card']);
                    return tQuery.get(_params.travelId).then((travel) => {
                        _travel = travel;
                        let err = new Define.ErrorWebSocket();
                        if (_params.error) {
                            err.set('travelError', _params.error);
                            return err.save()
                        }
                        return Promise.resolve()
                    }).then(async () => {
                        return _response.success(await _super.formatTravelToFirebase(_travel, true, false, true))
                    }, (err) => {
                        return _response.error(err)
                    });
                }
            },
            getTravelDetails: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["travelId"], _response)) {
                        let offset = (conf.timezoneDefault * -1) || 180;
                        let obj, travel, receivePush, nextToReceive;
                        return utils.getObjectById(_params.travelId, Define.Travel, ["origin", "destination", "user", "driver", "vehicle", "fare", "fare.category", "couponRelation"]).then(async function (_travel) {
                            travel = _travel;
                            obj = utils.formatPFObjectInJson(travel, ["originalFare", "couponValue", "cancellationFee", "paidCancellation", "pagarmeId", "errorReason", "paymentId", "debtCharged", "valueDriver", "cancelBy", "acceptedDate", "startDate", "time", "waitingDate", "status", "time", "value", "driverRate", "userRate", "driverReview", "userReview", "driverLocationWhenArrived", "driverLocationWhenCancell", "originalValue", "paidWithBonus", "errorCode"]);
                            obj.originalValue = obj.originalValue || obj.value;
                            obj.hidePayment = (conf.payment && conf.payment.hidePayment) || false;
                            obj.originalFare = obj.originalFare ? _super.formatFareForTravel(obj.originalFare) : undefined;
                            obj.hidePaymentType = conf.hidePaymentType || false;
                            obj.showDestiny = conf.showDestiny || false;
                            obj.fee = parseFloat((travel.get("fee") || 0) + (travel.get("planFee") || 0)).toFixed(2);
                            obj.createdAt = new Date(travel.createdAt + offset).toISOString();
                            obj.cancelDate = travel.get("cancelDate") ? new Date(travel.get("cancelDate")).toISOString() : undefined;
                            obj.map = travel.get("map") || null;
                            obj.paymentMethod = _super.getPaymentMethodOfTravel(travel);
                            obj.locationWhenComplete = travel.get("locationWhenComplete") ? travel.get("locationWhenComplete").location : null;
                            obj.locationWhenInit = travel.get("locationWhenInit") ? travel.get("locationWhenInit").location : null;
                            obj.locationWhenAccept = travel.get("locationWhenAccept") ? travel.get("locationWhenAccept").location : null;
                            obj.driverLocationWhenCancell = travel.get("driverLocationWhenCancell") || null;
                            obj.passengerLocation = travel.get("passengerLocation");
                            obj.distance = travel.get("distance");
                            obj.time = utils.convertMinToHHMMSS(obj.time);
                            obj.driverRate = parseInt(travel.get("driverRate"));
                            obj.userRate = parseInt(travel.get("userRate"));
                            obj.passenger = utils.formatPFObjectInJson(travel.get("user"), ["name", "lastName", "rate", "profileImage"]);
                            obj.startDate = travel.get("startDate");
                            obj.endDate = travel.get("endDate");
                            obj.origin = Address.formatAddressToTravelDetails(travel.get("originJson"), travel.get("origin"));
                            obj.destination = Address.formatAddressToTravelDetails(travel.get("destinationJson"), travel.get("destination"));
                            obj.category = travel.has("fare") && travel.get("fare").get("category") ? travel.get("fare").get("category").get('name') : undefined;
                            obj.fare = utils.formatPFObjectInJson(travel.get("fare"), ["name", "minValue", "value", "valueKm", "valueTime", "time"]);
                            obj.dataBeforeRecalculate = travel.get("dataBeforeRecalculate");
                            obj.coupon = travel.get("couponRelation") ? travel.get("couponRelation").get("name") : undefined;
                            obj.noDrivers = (_travel.has("driversReceivePush") && _travel.get("driversReceivePush").length > 0) || ((_travel.get("cancelBy") != 'noDrivers' && _travel.get("cancelBy") != 'byError')) ? false : true;
                            obj.isScheduled = travel.get("isScheduled") || false;
                            obj.hasTransactionDenied = travel.get("errorCode") === Messages().error.ERROR_REFUSED.code;
                            if (travel.has("vehicle")) {
                                obj.vehicle = utils.formatPFObjectInJson(travel.get("vehicle"), ["brand", "model", "plate"]);
                            }
                            if (travel.has("driver")) {
                                obj.driver = utils.formatPFObjectInJson(travel.get("driver"), ["name", "lastName", "rate", "profileImage", "enrollment"]);
                            }
                            receivePush = (travel.get("driversReceivePush") || []);
                            const qConfig = await utils.findObject(Define.Config, null, true);
                            obj.splitCall = qConfig.get("splitCall") !== null;
                            return UserClass.instance().getUsersByIdList(receivePush);
                        }).then(function (users) {
                            let usersArray = [];
                            let mapUsers = {};
                            for (let i = 0; i < receivePush.length; i++) {
                                mapUsers[receivePush[i]] = {
                                    order: i,
                                    location: travel.get("logDriversCall")[receivePush[i]] ? travel.get("logDriversCall")[receivePush[i]].location : undefined,
                                    distance: travel.get("logDriversCall")[receivePush[i]] ? travel.get("logDriversCall")[receivePush[i]].googleDistance : undefined,
                                    offset: travel.get("logDriversCall")[receivePush[i]] ? travel.get("logDriversCall")[receivePush[i]].offset : undefined || offset,
                                    date: new Date(travel.get("logDriversCall")[receivePush[i]] ? travel.get("logDriversCall")[receivePush[i]].date : 0 + offset).toISOString(),
                                    rawDate: new Date(travel.get("logDriversCall")[receivePush[i]] ? travel.get("logDriversCall")[receivePush[i]].date : 0)
                                };
                                usersArray.push(receivePush[i])
                            }
                            for (let i = 0; i < users.length; i++) {
                                let item = mapUsers[users[i].objectId];
                                users[i].location = item.location;
                                users[i].distance = parseFloat(item.distance ? item.distance.toFixed(3) : 0);
                                users[i].date = new Date(item.rawDate.setMinutes(item.rawDate.getMinutes() + (item.offset * -1))).toISOString();
                                usersArray[item.order] = users[i];
                            }

                            obj.driversReceivePush = usersArray;
                            nextToReceive = travel.get("nextDriversToCall") || [];
                            return UserClass.instance().getUsersByIdList(nextToReceive);
                        }).then(function (users) {
                            let usersArray = [];
                            let mapUsers = {};
                            for (let i = 0; i < nextToReceive.length; i++) {
                                mapUsers[nextToReceive[i]] = {
                                    order: i,
                                    location: travel.get("logDriversCall")[nextToReceive[i]].location,
                                    distance: travel.get("logDriversCall")[nextToReceive[i]].googleDistance,
                                    offset: travel.get("logDriversCall")[nextToReceive[i]].offset,
                                    date: travel.get("logDriversCall")[nextToReceive[i]].date
                                };
                                usersArray.push(nextToReceive[i])
                            }
                            for (let i = 0; i < users.length; i++) {
                                let item = mapUsers[users[i].objectId];
                                users[i].location = item.location;
                                users[i].distance = parseFloat(item.distance.toFixed(3));
                                users[i].date = new Date(item.date.setMinutes(item.date.getMinutes() + item.offset));
                                usersArray[item.order] = users[i];
                            }

                            obj.nextDriversToCall = usersArray;
                            return _response.success(obj);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            listDriversToReceiveCallInTravel: function () {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        if (utils.verifyRequiredFields(_params, ["travelId"], _response)) {
                            const limit = _params.limit || 10;
                            const page = ((_params.page || 1) - 1) * limit;
                            let arrayOfUsers = [], _travel;
                            const response = {total: 0, objects: []};
                            return utils.getObjectById(_params.travelId, Define.Travel, [], null, null, ["driversReceivePush", "logDriversCall"]).then(function (travel) {
                                _travel = travel;
                                let nextToReceive = _travel.get("driversReceivePush") || [];
                                response.total = nextToReceive.length;
                                arrayOfUsers = nextToReceive.splice(page * limit, limit);
                                return UserClass.instance().getUsersByIdList(arrayOfUsers);
                            }).then(function (users) {
                                let usersArray = [];
                                let mapUsers = {};
                                const logDriversCall = _travel.get("logDriversCall") || [];
                                for (let i = 0; i < arrayOfUsers.length; i++) {
                                    if (arrayOfUsers[i] && logDriversCall[arrayOfUsers[i]]) {
                                        mapUsers[arrayOfUsers[i]] = {
                                            order: i,
                                            location: logDriversCall[arrayOfUsers[i]].location,
                                            distance: logDriversCall[arrayOfUsers[i]].googleDistance,
                                            offset: logDriversCall[arrayOfUsers[i]].offset,
                                            date: logDriversCall[arrayOfUsers[i]].date,
                                            received: logDriversCall[arrayOfUsers[i]].received,
                                            dismiss: logDriversCall[arrayOfUsers[i]].dismiss
                                        };
                                        usersArray.push(arrayOfUsers[i])
                                    }
                                }
                                for (let i = 0; i < users.length; i++) {
                                    if (users[i] && users[i].objectId && mapUsers[users[i].objectId]) {
                                        const item = mapUsers[users[i].objectId];
                                        users[i].location = item.location;
                                        users[i].distance = parseFloat(item.distance.toFixed(3));
                                        users[i].date = item.date;
                                        users[i].received = item.received;
                                        users[i].dismiss = item.dismiss;
                                        usersArray[item.order] = users[i];
                                    }
                                }
                                response.objects = usersArray;
                                return _response.success(response);
                            });
                        }
                    }
                } catch (e) {
                    console.log("Error at method listDriversToReceiveCallInTravel: ", e);
                }
            },
            listNextToCallInTravel: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["travelId"], _response)) {
                        let limit = _params.limit || 10;
                        let page = ((_params.page || 1) - 1) * limit;
                        let nextToReceive, _travel;
                        const response = {total: 0, objects: []};
                        return utils.getObjectById(_params.travelId, Define.Travel, [], null, null, ["nextDriversToCall", "logDriversCall"]).then(function (travel) {
                            _travel = travel;
                            nextToReceive = _travel.get("nextDriversToCall") || [];
                            response.total = nextToReceive.length;
                            return UserClass.instance().getUsersByIdList(nextToReceive);
                        }).then(function (users) {
                            let usersArray = [];
                            let mapUsers = {};
                            for (let i = 0; i < nextToReceive.length; i++) {
                                mapUsers[nextToReceive[i]] = {
                                    order: i,
                                    location: _travel.get("logDriversCall")[nextToReceive[i]].location,
                                    distance: _travel.get("logDriversCall")[nextToReceive[i]].googleDistance || 0,
                                    offset: _travel.get("logDriversCall")[nextToReceive[i]].offset,
                                    date: _travel.get("logDriversCall")[nextToReceive[i]].date
                                };
                                usersArray.push(nextToReceive[i])
                            }
                            for (let i = 0; i < users.length; i++) {
                                let item = mapUsers[users[i].objectId];
                                users[i].location = item.location;
                                users[i].distance = parseFloat(item.distance.toFixed(3));
                                users[i].date = item.date;
                                usersArray[item.order] = users[i];
                            }
                            response.objects = usersArray.splice(page, limit);
                            return _response.success(response);
                        });
                    }
                }
            },
            getTravelById: function () {
                if (utils.verifyAccessAuth(_currentUser, ["passenger", "driver"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["objectId"], _response)) {
                        let _travel;
                        return utils.getObjectById(_params.objectId, Define.Travel, ["origin", "destination", "user", "driver", "vehicle", "fare", "card"]).then(function (travel) {
                            _travel = travel;
                            return MapsInstance.getDistanceBetweenPoints(_params.location, _travel.get("originJson") ? _travel.get("originJson").location : _travel.get("origin").get("location"))
                        }).then(function (distanceToPassenger) {
                            let obj = _super[_currentUser.get("isDriverApp") ? "formatTravelForDriver" : "formatTravelForPassenger"](_travel, true, distanceToPassenger.distance);
                            return _response.success(obj);
                        }, function (error) {
                            let _error;
                            if (error.code === 101) {
                                _error = Messages(_language).error.ERROR_OBJECT_NOT_FOUND;
                            } else _error = error;
                            _response.error(_error.code, _error.message);
                        });
                    }
                }
            },
            refundCancellation: async function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response) && utils.verifyRequiredFields(_params, ["travelId"], _response)) {
                    try {
                        const travel = await utils.getObjectById(_params.travelId, Define.Travel);
                        const user = travel.get("cancelBy") === "driver" ? travel.get("driver") : travel.get("user");
                        if (user.get('clientDebt')) {
                            user.increment('clientDebt', -1 * travel.get('cancellationFee'))
                        } else {
                            user.set('clientDebt', -1 * travel.get('cancellationFee'))
                        }
                        travel.unset('cancellationFee');
                        await travel.save(null, {useMasterKey: true});
                        await user.save(null, {useMasterKey: true});
                        return _response.success(Messages(_language).success.EDITED_SUCCESS)
                    } catch (e) {
                        return _response.error(e)
                    }
                }
            },
            getTravelDetail: async function () {
                if (utils.verifyAccessAuth(_currentUser, ["passenger", "driver"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["objectId"], _response)) {
                        let _travel;
                        let dismissReason = await Cancellation.getCancellation(_language);
                        return utils.getObjectById(_params.objectId, Define.Travel, ["user"]).then(function (travel) {
                            let promises = [];
                            _travel = travel;
                            if (_params.location && _params.location.latitude && _params.location.longitude)
                                promises.push(MapsInstance.getDistanceBetweenPoints(_params.location, _travel.get("originJson").location));
                            let logs = travel.get("logDriversCall");
                            logs !== undefined && logs[_currentUser.id] && (logs[_currentUser.id].received = true);
                            promises.push(travel.save());
                            return Promise.all(promises);
                        }).then(async function (resultPromises) {
                            let json;
                            json = await _super.formatTravelToFirebase(_travel);
                            json.distanceToPassenger = resultPromises[0].distance;
                            json.origin = _travel.get("originJson");
                            json.destination = _travel.get("destinationJson");
                            json.client = utils.formatPFObjectInJson(_travel.get("user"), ["lastName", "rate", "profileImage", "phone"]);
                            json.client.name = UserClass.instance().formatName(_travel.get("user"));
                            json.payment = _super.getPaymentMethodOfTravel(_travel);
                            json.showDestiny = conf.showDestiny || false;
                            json.dismissReason = dismissReason || [];
                            return _response.success(json);
                        }, function (error) {
                            let _error;
                            if (error.code === 101) {
                                _error = Messages(_language).error.ERROR_OBJECT_NOT_FOUND;
                            } else _error = error;
                            _response.error(_error.code, _error.message);
                        });
                    }
                }
            },
            confirmCancellment: function () {
                if (utils.verifyAccessAuth(_currentUser, ["passenger", "driver"], _response)) {
                    // if (utils.verifyRequiredFields(_params, ["objectId"], _response)) {
                    FirebaseClass.instance().removeTravelCopyOfUser(_currentUser.id);
                    FirebaseClass.instance().removeTravelOfUser(_currentUser.id);
                    return _response.success(Messages(_language).success.EDITED_SUCCESS);
                    // }
                }

            },
            rateTravel: function () {
                if (utils.verifyAccessAuth(_currentUser, ["passenger", "driver"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["objectId", "rate"], _response)) {
                        if (_params.rate < 1 || _params.rate > 5) {
                            _response.error(Messages(_language).error.ERROR_INVALID_RATE.code, Messages(_language).error.ERROR_INVALID_RATE.message);
                            return;
                        }
                        return utils.getObjectById(_params.objectId, Define.Travel, ["user", "driver"]).then(function (result) {
                            const isDriver = _currentUser.id === result.get("driver").id;
                            const field = isDriver ? "driverRate" : "userRate";
                            let rated = isDriver ? "user" : "driver";
                            let rateDateField = isDriver ? "driverRateDate" : "userRateDate";
                            if (conf.uniqueRate && result.get(field)) {
                                return Promise.reject(Messages(_language).error.ERROR_UNIQUE_RATE_TRAVEL);
                            }
                            result.set(field, _params.rate);
                            result.set(rated, UserClass.instance().updateRate(result.get(rated), _params.rate));
                            result.set(rateDateField, new Date());
                            if (_params.review) {
                                let fieldReview = _currentUser.id === result.get("driver").id ? "driverReview" : "userReview";
                                result.set(fieldReview, _params.review);
                            }
                            return result.save(null, {useMasterKey: true});
                        }).then(function () {
                            FirebaseClass.instance().removeTravelCopyOfUser(_currentUser.id);
                            FirebaseClass.instance().removeTravelOfUser(_currentUser.id);
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            getTravelStatus: function () {
                if (utils.verifyAccessAuth(_currentUser, ["passenger", "driver"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["offset"], _response)) {
                        let output = {};
                        return _super.travelStatus(_currentUser).then(function (travel) {
                            if (_currentUser.get("isDriverApp") && !_currentUser.get("isAvailable")) {
                                return UserClass.instance().getOffline(_params, _currentUser);
                            }
                            if (travel) {
                                output = _currentUser.get("isDriverApp") ? _super.formatTravelForDriver(travel) : _super.formatTravelForPassenger(travel);
                            }
                            return Promise.resolve(travel ? output : null);
                        }).then(function (result) {
                            return _response.success(result);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            listTravelOptions: async function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver", "passenger"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["distance", "time"], _response)) {
                        const qConfig = await utils.findObject(Define.Config, null, true);
                        let prices = {}, _mapDrivers;
                        let obj = {};
                        let offset = qConfig.get("timezoneDefault") || _params.offset;

                        return RadiusClass.instance().findRadiusByLocation(_params.state, _params.city).then(function (maxDistance) {
                            return UserClass.instance().getDriversByLocation(_params.location, _currentUser.get("womenOnly"), _currentUser.get("gender"), maxDistance, offset)
                        }).then(function (mapDrivers) {
                            _mapDrivers = mapDrivers;
                            let promises = [FareInstance.listFares(_params.location, _currentUser.get("isDriverApp"), offset)]; //remove offset because the time is saved as utc in our db
                            if (_currentUser.get('travelBonusTotal') && conf.bonusLevel) {
                                obj.bonusAvailable = _currentUser.get('travelBonusTotal');
                                if (!_currentUser.get('bonusMsgReaded')) {
                                    obj.showBonusMessage = true;
                                    _currentUser.set('bonusMsgReaded', true);
                                    promises.push(_currentUser.save(null, {useMasterKey: true}))
                                }
                            }
                            return Promise.all(promises);
                        }).then(function (fares) {
                            fares = fares[0];
                            prices = _super.calculateValue(fares, _params.distance, _params.time, _mapDrivers, _currentUser);
                            return conf.payment && conf.payment.blockCardPayment ? Promise.resolve(null) : (_params.allCards ? utils.findObject(Define.Card, {
                                "owner": _currentUser,
                                "deleted": false
                            }) : utils.findObject(Define.Card, {
                                "owner": _currentUser,
                                "primary": true,
                                "deleted": false
                            }, true));
                        }).then(function (cards) {
                                let money = (!conf.bonusLevel || (conf.bonusLevel && conf.bonusLevel.type !== 'yesgo')) ? Define.getfakeCard(_language) : Define.getYesFakeCard(_language);
                                if (Array.isArray(cards)) {
                                    obj.fares = prices;
                                    obj.clientDebt = _currentUser.has('clientDebt') && conf.hasCancellation ? _currentUser.get('clientDebt') : undefined;
                                    obj.cards = utils.formatObjectArrayToJson(cards, ["numberCrip", "brand", "primary"]);
                                    if (conf.bonusLevel && conf.bonusLevel.type !== 'yesgo') {
                                        money.primary = !(cards.length > 0);
                                        obj.cards.push(money);
                                    } else {
                                        money[0].primary = !(cards.length > 0);
                                        obj.cards.concat(money);
                                    }
                                } else {
                                    obj.fares = prices;
                                    obj.clientDebt = _currentUser.has('clientDebt') && conf.hasCancellation ? _currentUser.get('clientDebt') : undefined;
                                    if (cards) {
                                        obj.primaryCard = {
                                            card: cards.get("numberCrip") || "",
                                            brand: cards.get("brand") || "",
                                            objectId: cards.id || ""
                                        }
                                    } else if (conf.bonusLevel && conf.bonusLevel.type === 'yesgo') {
                                        money[0].primary = true;
                                        obj.primaryCard = money[0];
                                        obj.cards = money;
                                    } else {
                                        obj.primaryCard = money;
                                    }
                                }


                                obj.hidePayment = (conf.payment && conf.payment.hidePayment) || false;
                                return _response.success(obj);
                            }
                            ,

                            function (error) {
                                _response.error(error.code, error.message);
                            }
                        );
                    }
                }
            },
            reportOfWeek: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["date", "offset"], _response)) {
                        let auxDate, mapWeek = {}, json = {
                            totalValue: 0,
                            week: [],
                            travels: 0,
                            cancelledByUser: 0,
                            cancelledByDriver: 0
                        };
                        let offset = _params.offset || conf.timezoneDefault || -180;
                        let date = new Date(_params.date);
                        let dateDiff = date.getDay() || 7;
                        let startDate = new Date(date.setDate(date.getDate() - (dateDiff)));
                        startDate = new Date(startDate.setHours((Math.abs(offset / 60) - 2), 0, 0, 0));

                        dateDiff = date.getDay() ? 8 - date.getDay() : 6;
                        let endDate = new Date(date.setDate(date.getDate() + dateDiff));
                        endDate = new Date(endDate.setHours(endDate.getHours() + 24));
                        let aux = new Date(startDate.valueOf());
                        while (aux.getTime() < endDate.getTime()) {
                            let dateAux = new Date(new Date(aux).setHours(12, 0, 0, 0));
                            mapWeek[utils.formatDate(aux)] = {date: dateAux, value: 0};
                            aux = new Date(aux.valueOf());
                            aux = new Date(aux.setDate(aux.getDate() + 1));
                        }

                        let userType = _currentUser.get("isDriverApp") ? "driver" : "user";
                        const queryCompleted = new Parse.Query(Define.Travel);
                        queryCompleted.lessThanOrEqualTo("endDate", endDate);
                        queryCompleted.greaterThanOrEqualTo("endDate", startDate);
                        queryCompleted.limit(100000);
                        queryCompleted.equalTo(userType, _currentUser);
                        queryCompleted.equalTo("status", "completed");
                        queryCompleted.ascending("endDate");
                        queryCompleted.select(["status", "cancelBy", "endDate", "valueDriver"]);

                        let promises = [];
                        promises.push(queryCompleted.find());
                        const queryCancelled = new Parse.Query(Define.Travel);
                        queryCancelled.lessThanOrEqualTo("cancelDate", endDate);
                        queryCancelled.greaterThanOrEqualTo("cancelDate", startDate);
                        queryCancelled.limit(100000);
                        queryCancelled.equalTo(userType, _currentUser);
                        queryCancelled.equalTo("status", "cancelled");
                        queryCancelled.ascending("cancelDate");
                        queryCancelled.select(["status", "cancelBy", "cancelDate", "valueDriver"]);
                        promises.push(queryCancelled.find());
                        return Promise.all(promises).then(function (resultPromises) {
                            let travelsCompleted = resultPromises[0];
                            let travelsCancelled = resultPromises[1];
                            json.travels = 0; //travels.length;
                            for (let i = 0; i < travelsCompleted.length; i++) {
                                json.travels++;
                                let dateString = utils.formatDate(utils.setTimezone(travelsCompleted[i].get('endDate'), offset));
                                if (mapWeek[dateString]) {
                                    mapWeek[dateString].value += travelsCompleted[i].get("valueDriver");
                                }
                                json.totalValue += travelsCompleted[i].get("valueDriver");
                            }
                            for (let i = 0; i < travelsCancelled.length; i++) {
                                if (travelsCancelled[i].get("status") === "cancelled") {
                                    if (travelsCancelled[i].get("cancelBy") === "passenger") json.cancelledByUser++;
                                    if (travelsCancelled[i].get("cancelBy") === "driver") json.cancelledByDriver++;
                                }
                            }
                            for (let key in mapWeek) {
                                json.week.push({date: mapWeek[key].date, value: mapWeek[key].value});
                            }
                            return _response.success(json);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            listDashboardData: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    // if (utils.verifyRequiredFields(_params, ["southwest", "northeast", "offset"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["offset"], _response)) {
                        if (cache && cache.date > new Date().getTime()) {
                            return _response.success(cache.data);
                        }
                        let _state;
                        let offset = _params.offset + new Date().getTimezoneOffset();
                        let output = {
                            approvedDrivers: 0,
                            reprovedDrivers: 0,
                            incompleteDrivers: 0,
                            waitingApprovement: 0,
                            totalDrivers: 0,
                            totalClients: 0
                        };
                        if (conf.appName === "Mova")
                            return _response.success({
                                approvedDrivers: 0,
                                availableDrivers: "Manutenção",
                                cancelledLastWeek: [],
                                cancelledTravels: "Manutenção",
                                completedLastWeek: [],
                                completedTravels: "Manutenção",
                                driversInTravel: 0,
                                incompleteDrivers: 0,
                                recentActivities: [],
                                reprovedDrivers: 0,
                                totalClients: 0,
                                totalDrivers: 0,
                                waitingApprovement: 0
                            });
                        let limit = _params.limit || 20000;
                        let page = (_params.page || 0) * limit;
                        let mapWeek = {};
                        let date = new Date(new Date().setHours(23, 59, 0));
                        let today = new Date(date.setMinutes(date.getMinutes()));

                        let aux = new Date(today.valueOf());
                        aux = new Date(today.valueOf());
                        let nowDate = new Date();
                        let sevenDaysAgo = new Date(nowDate.setHours(nowDate.getHours() + (offset / 60)));
                        sevenDaysAgo = new Date(nowDate.setHours(nowDate.getHours() - 144));
                        sevenDaysAgo = new Date(sevenDaysAgo.setHours(sevenDaysAgo.getHours() - sevenDaysAgo.getHours(), 0, 0, 0));

                        let endDate = new Date();
                        endDate = new Date(endDate.setHours(endDate.getHours() + (offset / 60)));
                        endDate = new Date(endDate.setHours(0, 0, 0, 0));
                        let aux2 = new Date(sevenDaysAgo.valueOf());
                        let mapWeekCompleted = {};
                        while (aux2.getTime() <= endDate) {
                            mapWeek[aux2.getTime()] = {date: aux2, amount: 0};
                            mapWeekCompleted[utils.formatDate(aux2)] = {date: aux2, amount: 0};
                            aux2 = new Date(aux2.valueOf());
                            aux2 = new Date(aux2.setDate(aux2.getDate() + 1));
                        }
                        // Object.assign(mapWeekCompleted, mapWeek);
                        let promises = [];
                        let query = new Parse.Query(Parse.User);
                        query.equalTo("isDriver", true);
                        if (_currentUser.get('admin_local')) {
                            if (_currentUser.get('admin_local').city) query.equalTo('city', _currentUser.get('admin_local').city);
                            if (_currentUser.get('admin_local').state) query.equalTo('state', _currentUser.get('admin_local').state)
                        }
                        // Obtem total de motoristas
                        promises.push(query.count());

                        query = new Parse.Query(Parse.User);
                        query.equalTo("isDriver", true);
                        query.equalTo("profileStage", "completeDocs");
                        query.equalTo("status", "pending");
                        if (_currentUser.get('admin_local')) {
                            if (_currentUser.get('admin_local').city) query.equalTo('city', _currentUser.get('admin_local').city);
                            if (_currentUser.get('admin_local').state) query.equalTo('state', _currentUser.get('admin_local').state)
                        }
                        if (conf.payment && conf.payment.needs_verification) query.equalTo("accountApproved", true);
                        // Obtem total de motoristas aguardando aprovação
                        promises.push(query.count());

                        query = new Parse.Query(Parse.User);
                        query.equalTo("isDriver", true);
                        query.equalTo("profileStage", "approvedDocs");
                        query.equalTo("status", "approved");
                        if (_currentUser.get('admin_local')) {
                            if (_currentUser.get('admin_local').city) query.equalTo('city', _currentUser.get('admin_local').city);
                            if (_currentUser.get('admin_local').state) query.equalTo('state', _currentUser.get('admin_local').state)
                        }
                        // Obtem total de motoristas aprovados
                        promises.push(query.count());

                        query = new Parse.Query(Parse.User);
                        query.equalTo("isDriver", true);
                        query.equalTo("profileStage", "completeDocs");
                        query.equalTo("status", "rejected");
                        if (_currentUser.get('admin_local')) {
                            if (_currentUser.get('admin_local').city) query.equalTo('city', _currentUser.get('admin_local').city);
                            if (_currentUser.get('admin_local').state) query.equalTo('state', _currentUser.get('admin_local').state)
                        }
                        // Obtem total de motoristas reprovados
                        promises.push(query.count());
                        query = new Parse.Query(Parse.User);
                        query.equalTo("isDriver", true);
                        if (conf.payment && conf.payment.needs_verification) {
                            // query.equalTo("accountApproved", false);//sem aprovação da iugu
                            query.containedIn("status", ["pending", "incomplete", undefined]);// não aprovados ou reje
                            query.containedIn("profileStage", ["approvedDocs", "phoneValidation", "legalConsent", "personalData", "category", "vehicleData", "incompleteDocs"]);
                        } else {
                            query.containedIn("profileStage", ["phoneValidation", "legalConsent", "personalData", "category", "vehicleData", "incompleteDocs"]);
                        }
                        if (_currentUser.get('admin_local')) {
                            if (_currentUser.get('admin_local').city) query.equalTo('city', _currentUser.get('admin_local').city);
                            if (_currentUser.get('admin_local').state) query.equalTo('state', _currentUser.get('admin_local').state)
                        }
                        // Obtem total de motoristas com cadastro incompleto
                        promises.push(query.count());

                        query = new Parse.Query(Parse.User);
                        query.equalTo("isPassenger", true);
                        // Obtem total de passageiros
                        promises.push(query.count());
                        if (_currentUser.get('admin_local')) {
                            promises.push(utils.findObject(Define.State, {sigla: _currentUser.get('admin_local').state}, true))
                        }
                        return Promise.all(promises).then(function (resultPromises) {
                            output.totalDrivers = resultPromises[0];
                            output.waitingApprovement = resultPromises[1];
                            output.approvedDrivers = resultPromises[2];
                            output.reprovedDrivers = resultPromises[3];
                            output.incompleteDrivers = resultPromises[4];
                            output.totalClients = resultPromises[5];
                            let query = new Parse.Query(Define.Travel);
                            query.equalTo("status", "cancelled");
                            query.containedIn("cancelBy", ["driver", "passenger"]);
                            query.limit(100000);
                            query.greaterThanOrEqualTo("cancelDate", sevenDaysAgo);
                            query.lessThanOrEqualTo("cancelDate", today);
                            if (_currentUser.get('admin_local')) {
                                _state = resultPromises[6].get('name');
                                query.equalTo('originJson.city', _currentUser.get('admin_local').city);
                                query.equalTo('originJson.state', resultPromises[6].get('name'))
                            }
                            return query.find()
                        }).then(function (cancelledTravels) {
                            output.cancelledTravels = cancelledTravels.length;
                            // for (let i = 0; i < cancelledTravels.length; i++) {
                            //
                            //     let auxDate = cancelledTravels[i].get("cancelDate");
                            //     if (mapWeekCompleted[utils.formatDate(auxDate)]) {
                            //         mapWeekCompleted[utils.formatDate(auxDate)].amount++;
                            //     }
                            // }
                            output.cancelledLastWeek = [];
                            // for (let key in mapWeekCompleted) {
                            //                             //     output.cancelledLastWeek.push(mapWeekCompleted[key].amount);
                            //                             //     mapWeekCompleted[key].amount = 0;
                            //                             // }
                            let query = new Parse.Query(Define.Travel);
                            query.equalTo("status", "completed");
                            query.limit(100000);
                            query.greaterThanOrEqualTo("endDate", sevenDaysAgo);
                            query.lessThanOrEqualTo("endDate", today);
                            if (_currentUser.get('admin_local')) {
                                query.equalTo('originJson.city', _currentUser.get('admin_local').city);
                                query.equalTo('originJson.state', _state)
                            }
                            return query.find();
                        }).then(function (travels) {
                            output.completedTravels = travels.length;
                            // for (let i = 0; i < travels.length; i++) {
                            //     let auxDate = travels[i].get("endDate");
                            //     if (mapWeekCompleted[utils.formatDate(auxDate)]) {
                            //         mapWeekCompleted[utils.formatDate(auxDate)].amount++;
                            //     }
                            // }
                            output.completedLastWeek = [];
                            // for (let key in mapWeekCompleted) {
                            //     output.completedLastWeek.push(mapWeekCompleted[key].amount);
                            // }
                            return utils.findObject(Define.Activity, null, false, null, null, "createdAt", null, null, 15);
                        }).then(function (activities) {
                            activities.totalActivities = activities.length; //COUNTING WITH LIMIT OF 9999999
                            activities = activities.slice(page).slice(0, limit); //MANUAL PAGINATION
                            output.recentActivities = utils.formatObjectArrayToJson(activities, ["type", "info", "message"], true);

                            let date = new Date();
                            date = new Date(date.setMinutes(date.getMinutes() + offset - (conf.MaxDiffTimeInMinutes || 1200)));
                            let condition = {
                                "isDriver": true,
                                "isDriverApp": true,
                                "isAvailable": true,
                                "profileStage": "approvedDocs",
                                "blocked": false,
                                "inTravel": false
                            };
                            if (_currentUser.get('admin_local')) {
                                condition.city = _currentUser.get('admin_local').city;
                                condition.state = _currentUser.get('admin_local').state;
                            }
                            return utils.countObject(Parse.User, condition, null, (conf.payment && conf.payment.module) ? ["location"] : ["location", "recipientId"], {"lastLocationDate": date});
                        }).then(function (availableDrivers) {
                            output.availableDrivers = availableDrivers;
                            let condition = {"isDriver": true, "inTravel": true};
                            if (_currentUser.get('admin_local')) {
                                condition.city = _currentUser.get('admin_local').city;
                                condition.state = _currentUser.get('admin_local').state;
                            }
                            return utils.countObject(Parse.User, condition);
                        }).then(function (driversInTravel) {
                            output.driversInTravel = driversInTravel;
                            if (conf.payment && conf.payment.needs_verification) {
                                query = new Parse.Query(Parse.User);
                                query.equalTo("isDriver", true);
                                query.equalTo("profileStage", "completeDocs");
                                query.equalTo("status", "pending");
                                query.equalTo("accountApproved", false);
                                if (_currentUser.get('admin_local')) {
                                    query.equalTo("city", _currentUser.get('admin_local').city);
                                    query.equalTo("state", _currentUser.get('admin_local').state);
                                }
                                return query.count();
                            } else return Promise.resolve()
                        }).then(function (iuguApproved) {
                            if (iuguApproved !== undefined) output.waitingGatwayApprovement = iuguApproved;
                            let date = new Date();
                            cache = {date: date.setMinutes(date.getMinutes() + 1), data: output};
                            return _response.success(output);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            listDashboardDataV2: async function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    // if (utils.verifyRequiredFields(_params, ["southwest", "northeast", "offset"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["offset"], _response)) {
                        let offset = _params.offset + new Date().getTimezoneOffset();
                        let output = {
                            approvedDrivers: 0,
                            reprovedDrivers: 0,
                            incompleteDrivers: 0,
                            waitingApprovement: 0,
                            totalDrivers: 0,
                            totalClients: 0
                        };
                        let limit = _params.limit || 20000;
                        let page = (_params.page || 0) * limit;
                        let mapWeek = {};
                        let date = new Date(new Date().setHours(23, 59, 0));
                        let today = new Date(date.setMinutes(date.getMinutes()));

                        let nowDate = new Date();
                        let sevenDaysAgo = new Date(nowDate.setHours(nowDate.getHours() - 144));
                        sevenDaysAgo = new Date(sevenDaysAgo.setHours(sevenDaysAgo.getHours() - sevenDaysAgo.getHours(), 0, 0, 0));

                        let endDate = new Date();
                        endDate = new Date(endDate.setHours(endDate.getHours() + (offset / 60)));
                        endDate = new Date(endDate.setHours(0, 0, 0, 0));
                        let aux2 = new Date(sevenDaysAgo.valueOf());
                        let mapWeekCompleted = {};
                        while (aux2.getTime() <= endDate) {
                            mapWeek[aux2.getTime()] = {date: aux2, amount: 0};
                            mapWeekCompleted[utils.formatDate(aux2)] = {date: aux2, amount: 0};
                            aux2 = new Date(aux2.valueOf());
                            aux2 = new Date(aux2.setDate(aux2.getDate() + 1));
                        }
                        // Object.assign(mapWeekCompleted, mapWeek);
                        let promises = [];
                        let query = new Parse.Query(Parse.User);
                        const isAdminLocal = _currentUser.get('admin_local');
                        const adminLocalState = isAdminLocal && _currentUser.get('admin_local').state ? _currentUser.get('admin_local').state : undefined;
                        const adminLocalCity = isAdminLocal && _currentUser.get('admin_local').city ? _currentUser.get('admin_local').city : undefined;
                        let adminStateFullName;
                        if (isAdminLocal) {
                            adminStateFullName = (await utils.findObject(Define.State, {"sigla": adminLocalState}, true)).get('name');
                            query.equalTo('state', adminLocalState);
                            if (adminLocalCity) query.equalTo('city', adminLocalCity);
                        }

                        // Obtem total de motoristas
                        promises.push(query.count());

                        query = new Parse.Query(Parse.User);
                        query.equalTo("isDriver", true);
                        query.equalTo("profileStage", "completeDocs");
                        query.equalTo("status", "pending");
                        if (isAdminLocal) {
                            query.equalTo('state', adminLocalState);
                            if (adminLocalCity) query.equalTo('city', adminLocalCity);
                        }
                        if (conf.payment && conf.payment.needs_verification) query.equalTo("accountApproved", true);
                        // Obtem total de motoristas aguardando aprovação
                        promises.push(query.count());

                        query = new Parse.Query(Parse.User);
                        query.equalTo("isDriver", true);
                        query.equalTo("profileStage", "approvedDocs");
                        query.equalTo("status", "approved");
                        if (isAdminLocal) {
                            query.equalTo('state', adminLocalState);
                            if (adminLocalCity) query.equalTo('city', adminLocalCity);
                        }
                        // Obtem total de motoristas aprovados
                        promises.push(query.count());

                        query = new Parse.Query(Parse.User);
                        query.equalTo("isDriver", true);
                        query.equalTo("profileStage", "completeDocs");
                        query.equalTo("status", "rejected");
                        if (isAdminLocal) {
                            query.equalTo('state', adminLocalState);
                            if (adminLocalCity) query.equalTo('city', adminLocalCity);
                        }
                        // Obtem total de motoristas reprovados
                        promises.push(query.count());
                        query = new Parse.Query(Parse.User);
                        query.equalTo("isDriver", true);
                        if (conf.payment && conf.payment.needs_verification) {
                            // query.equalTo("accountApproved", false);//sem aprovação da iugu
                            query.containedIn("status", ["pending", "incomplete", undefined]);// não aprovados ou reje
                            query.containedIn("profileStage", ["approvedDocs", "phoneValidation", "legalConsent", "personalData", "category", "vehicleData", "incompleteDocs"]);
                        } else {
                            query.containedIn("profileStage", ["phoneValidation", "legalConsent", "personalData", "category", "vehicleData", "incompleteDocs"]);
                        }
                        if (isAdminLocal) {
                            query.equalTo('state', adminLocalState);
                            if (adminLocalCity) query.equalTo('city', adminLocalCity);
                        }
                        // Obtem total de motoristas com cadastro incompleto
                        promises.push(query.count());

                        query = new Parse.Query(Parse.User);
                        query.equalTo("isPassenger", true);
                        // Obtem total de passageiros
                        promises.push(query.count());

                        return Promise.all(promises).then(function (resultPromises) {
                            output.totalDrivers = resultPromises[0];
                            output.waitingApprovement = resultPromises[1];
                            output.approvedDrivers = resultPromises[2];
                            output.reprovedDrivers = resultPromises[3];
                            output.incompleteDrivers = resultPromises[4];
                            output.totalClients = resultPromises[5];
                            let query = new Parse.Query(Define.Travel);
                            query.equalTo("status", "cancelled");
                            query.containedIn("cancelBy", ["driver", "passenger"]);
                            query.limit(100000);
                            query.greaterThanOrEqualTo("cancelDate", sevenDaysAgo);
                            query.lessThanOrEqualTo("cancelDate", today);
                            if (isAdminLocal) {
                                query.equalTo('originJson.state', adminStateFullName);
                                if (adminLocalCity) query.equalTo('originJson.city', adminLocalCity);
                            }
                            return query.count()
                        }).then(function (cancelledTravels) {
                            output.cancelledTravels = cancelledTravels;
                            let query = new Parse.Query(Define.Travel);
                            query.equalTo("status", "completed");
                            query.limit(100000);
                            query.greaterThanOrEqualTo("endDate", sevenDaysAgo);
                            query.lessThanOrEqualTo("endDate", today);
                            if (isAdminLocal) {
                                query.equalTo('originJson.state', adminStateFullName);
                                if (adminLocalCity) query.equalTo('originJson.city', adminLocalCity);
                            }
                            return query.count();
                        }).then(function (travels) {
                            output.completedTravels = travels;
                            return utils.findObject(Define.Activity, null, false, null, null, "createdAt", null, null, 15);
                        }).then(function (activities) {
                            activities.totalActivities = activities.length; //COUNTING WITH LIMIT OF 9999999
                            activities = activities.slice(page).slice(0, limit); //MANUAL PAGINATION
                            output.recentActivities = utils.formatObjectArrayToJson(activities, ["type", "info", "message"], true);

                            let date = new Date();
                            date = new Date(date.setMinutes(date.getMinutes() + offset - (conf.MaxDiffTimeInMinutes || 1200)));
                            let condition = {
                                "isDriver": true,
                                "isDriverApp": true,
                                "isAvailable": true,
                                "profileStage": "approvedDocs",
                                "blocked": false,
                                "inTravel": false
                            };
                            if (isAdminLocal) {
                                condition.state = adminLocalState;
                                if (adminLocalCity) condition.city = adminLocalCity;
                            }
                            return utils.countObject(Parse.User, condition, null, (conf.payment && conf.payment.module) ? ["location"] : ["location", "recipientId"], {"lastLocationDate": date});
                        }).then(function (availableDrivers) {
                            output.availableDrivers = availableDrivers;
                            let condition = {"isDriver": true, "inTravel": true};
                            if (isAdminLocal) {
                                condition.state = adminLocalState;
                                if (adminLocalCity) condition.city = adminLocalCity;
                            }
                            return utils.countObject(Parse.User, condition);
                        }).then(function (driversInTravel) {
                            output.driversInTravel = driversInTravel;
                            if (conf.payment && conf.payment.needs_verification) {
                                query = new Parse.Query(Parse.User);
                                query.equalTo("isDriver", true);
                                query.equalTo("profileStage", "completeDocs");
                                query.equalTo("status", "pending");
                                query.equalTo("accountApproved", false);
                                if (isAdminLocal) {
                                    query.equalTo("state", adminLocalState);
                                    if (adminLocalCity) query.equalTo("city", adminLocalCity);
                                }
                                return query.count();
                            } else return Promise.resolve()
                        }).then(function (iuguApproved) {
                            if (iuguApproved !== undefined) output.waitingGatwayApprovement = iuguApproved;

                            return _response.success(output);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            dismissTravel: async () => {
                if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["objectId"], _response)) {
                        try {
                            let travel = await utils.getObjectById(_params.objectId, Define.Travel);
                            let logs = travel.get("logDriversCall");
                            const driver = _currentUser;
                            const willBeOffline = await ConfigInstance.getConfig("willBeOffline", 3);
                            logs[_currentUser.id].dismiss = true;
                            const qConfig = await utils.findObject(Define.Config, null, true);
                            if (qConfig.get("splitCall") &&
                                !(qConfig.get("splitCall").callAllAfter &&
                                    qConfig.get("splitCall").callAllAfter <= (travel.get("driversReceivePush").length || 0)
                                )
                            ) {
                                travel.set("nextTimeToCall", new Date);
                            }
                            await travel.save();

                            driver.increment("countDriverRefusals");
                            await driver.save(null, {useMasterKey: true});
                            const countDriverRefusals = driver.get("countDriverRefusals") || 0;
                            if (willBeOffline > 0 && countDriverRefusals >= willBeOffline) {
                                RedisJobInstance.addJob("User", "willBeOfflineJob", {
                                    objectId: driver.id,
                                    language: _language,
                                    countDriverRefusals
                                });
                            }
                            if (_params.idReason)
                                await DismissTravel.travelCancellationReason(travel, _currentUser.id, _params.idReason);
                            await _super.travelInDismissArray(_currentUser, _params.objectId);
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        } catch (error) {
                            _response.error(error.code, error.message);
                        }
                    }
                }
            },

            cleanDismissArray: async function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                    if (utils.verifyRequiredFields(_params, [], _response)) {
                        try {
                            _currentUser.set("dismissArray", []);
                            await _currentUser.save(null, {useMasterKey: true});
                            FirebaseClass.instance().updateDriver(_currentUser.id, null, null, []);
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);

                        } catch (error) {
                            _response.error(error.code, error.message);
                        }
                    }
                }
            },

            relationDismissTravel: async () => {
                if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["idTravel", "listReasons", "offset"], _response)) {
                        try {
                            let listReasons = _params.listReasons || [];
                            let text = _params.text || undefined;
                            let travel = await utils.getObjectById(_params.idTravel, Define.Travel);
                            if (listReasons)
                                await DismissTravel.travelCancellationReason(travel, _currentUser, listReasons, text);
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        } catch (error) {
                            _response.error(error.code, error.message);
                        }
                    }
                }
            },

            testRequestScheduledTravel: function () {
                if (utils.verifyRequiredFields(_params, ["objectId"], _response)) {
                    return utils.getObjectById(_params.objectId, Define.Travel, ["origin", "destination", "user", "driver", "vehicle", "fare", "card"]).then(function (travel) {
                        if (!travel.get("isScheduled"))
                            return Promise.reject({code: 101, message: "Não é uma corrida agendada"});
                        if (travel.get("status") !== "new")
                            return Promise.reject({code: 101, message: "Viagem já realizada"});
                        return _super.requestScheduledTravel(travel);
                    }).then(function () {
                        return _response.success("Chamada realizada");
                    }, function (error) {
                        _response.error(error.code, error.message);
                    });
                }
            },
            testGetScheduledTravel: function () {
                let date = new Date();
                let promises = [];
                let _travels;
                const query = new Parse.Query(Define.Travel);
                query.equalTo("status", "newScheduled");
                query.equalTo("isScheduled", true);
                query.lessThanOrEqualTo("appointmentDate", date);
                query.limit(100);
                query.include(["nextDriversToCall", "category", "fare", "fare.category", "user", "card"]);
                query.select(["user", "destination", "origin", "card", "distance", "fare", "location", "originalValue", "time", "value"]);
                return query.find().then(function (travels) {
                    return _response.success(travels);
                }, function () {
                    _response.error(error.code, error.message);
                });
            },
            testRecalculate: async () => {
                try {
                    const travel = await utils.getObjectById(_params.travelId, Define.Travel);
                    const locationsOriginal = travel.get("originalListLocationInTravel") || travel.get("listLocationInTravel") || [];
                    await _super.verifyIntervalsListLocation(locationsOriginal, travel);
                    return _response.success("output")
                } catch (e) {
                    console.log("Error in verify intervals list location: ", e);
                    return _response.error(e);
                }
            },
        }
    };
    return _super;
}

exports.instance = Travel;
Parse.Cloud.beforeSave("Travel", async function (request) {
    await Travel(request).beforeSave();
});
// Parse.Cloud.afterSave("Travel", function (request) {
//     Travel(request).afterSave();
// });
Parse.Cloud.beforeDelete("Travel", async function (request) {
    await Travel(request).beforeDelete();
});

for (let key in Travel().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        if (conf.enableLog) utils.printLogAPI(request);
        if (conf.saveLocationInEndPoints)
            utils.saveUserLocation(request.params, request.user);
        return await Travel(request).publicMethods[request.functionName]();
    });
}
